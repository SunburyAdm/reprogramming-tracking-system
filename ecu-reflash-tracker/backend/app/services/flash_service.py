from typing import List
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from fastapi import HTTPException, status

from app.models import Box, SessionBoxECU, FlashAttempt, History, User
from app.services.box_service import BoxService


class FlashService:

    @staticmethod
    async def start_flash(
        db: AsyncSession,
        session_id: UUID,
        box_id: UUID,
        ecu_code: str,
        expected_version: int,
        user: User,
    ) -> SessionBoxECU:
        # Fetch and validate box
        box_result = await db.execute(
            select(Box).where(
                and_(Box.id == box_id, Box.session_id == session_id)
            )
        )
        box = box_result.scalar_one_or_none()
        if not box:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Box not found",
            )
        if not box.inventory_frozen:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Box inventory must be frozen before flashing can begin",
            )

        # Fetch and validate ECU context
        ecu_result = await db.execute(
            select(SessionBoxECU).where(
                and_(
                    SessionBoxECU.session_id == session_id,
                    SessionBoxECU.box_id == box_id,
                    SessionBoxECU.ecu_code == ecu_code,
                )
            )
        )
        ecu_context = ecu_result.scalar_one_or_none()
        if not ecu_context:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ECU not found in this box/session combination",
            )

        if ecu_context.status not in ("learned", "rework_pending"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"ECU cannot be flashed from its current status '{ecu_context.status}'. "
                    f"Allowed statuses: learned, rework_pending."
                ),
            )

        if ecu_context.version != expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Optimistic lock version mismatch: "
                    f"client sent {expected_version}, server has {ecu_context.version}."
                ),
            )

        now = datetime.utcnow()
        attempt_no = (ecu_context.attempts or 0) + 1

        flash_attempt = FlashAttempt(
            session_id=session_id,
            box_id=box_id,
            ecu_context_id=ecu_context.id,
            attempt_no=attempt_no,
            started_at=now,
            result="in_progress",
            user_id=user.id,
            station_id=box.assigned_station_id,
        )
        db.add(flash_attempt)
        await db.flush()

        ecu_context.status = "flashing"
        ecu_context.current_attempt_started_at = now
        ecu_context.last_station_id = box.assigned_station_id
        ecu_context.last_user_id = user.id
        ecu_context.version += 1
        await db.flush()

        history = History(
            session_id=session_id,
            box_id=box_id,
            ecu_context_id=ecu_context.id,
            user_id=user.id,
            action="FLASH_STARTED",
            data={
                "ecu_code": ecu_code,
                "attempt_no": attempt_no,
                "flash_attempt_id": str(flash_attempt.id),
                "station_id": str(box.assigned_station_id) if box.assigned_station_id else None,
            },
        )
        db.add(history)
        await db.flush()

        return ecu_context

    @staticmethod
    async def finish_flash(
        db: AsyncSession,
        session_id: UUID,
        box_id: UUID,
        ecu_code: str,
        result: str,
        notes: str,
        expected_version: int,
        user: User,
    ) -> SessionBoxECU:
        if result not in ("success", "failed"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Result must be 'success' or 'failed'",
            )

        # Fetch ECU context
        ecu_result = await db.execute(
            select(SessionBoxECU).where(
                and_(
                    SessionBoxECU.session_id == session_id,
                    SessionBoxECU.box_id == box_id,
                    SessionBoxECU.ecu_code == ecu_code,
                )
            )
        )
        ecu_context = ecu_result.scalar_one_or_none()
        if not ecu_context:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECU not found in this box/session",
            )
        if ecu_context.status != "flashing":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"ECU is not currently being flashed "
                    f"(current status: '{ecu_context.status}')"
                ),
            )
        if ecu_context.version != expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Optimistic lock version mismatch: "
                    f"client sent {expected_version}, server has {ecu_context.version}."
                ),
            )

        # Find the in-progress flash attempt
        attempt_result = await db.execute(
            select(FlashAttempt).where(
                and_(
                    FlashAttempt.ecu_context_id == ecu_context.id,
                    FlashAttempt.result == "in_progress",
                )
            )
        )
        attempt = attempt_result.scalar_one_or_none()
        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No in-progress flash attempt found for this ECU",
            )

        now = datetime.utcnow()
        # Strip timezone if asyncpg returns it as offset-aware (DateTime columns are stored naive)
        started_naive = attempt.started_at.replace(tzinfo=None) if attempt.started_at and attempt.started_at.tzinfo else attempt.started_at
        duration_seconds = int((now - started_naive).total_seconds()) if started_naive else 0

        # Close flash attempt
        attempt.ended_at = now
        attempt.result = result
        attempt.duration_seconds = duration_seconds
        attempt.notes = notes
        await db.flush()

        # Update ECU context
        ecu_context.status = result  # 'success' or 'failed'
        ecu_context.last_attempt_duration_seconds = duration_seconds
        ecu_context.total_time_seconds = (ecu_context.total_time_seconds or 0) + duration_seconds
        ecu_context.attempts = (ecu_context.attempts or 0) + 1
        ecu_context.current_attempt_started_at = None
        ecu_context.version += 1
        await db.flush()

        history = History(
            session_id=session_id,
            box_id=box_id,
            ecu_context_id=ecu_context.id,
            user_id=user.id,
            action="FLASH_FINISHED",
            data={
                "ecu_code": ecu_code,
                "result": result,
                "duration_seconds": duration_seconds,
                "attempt_no": attempt.attempt_no,
                "notes": notes,
            },
        )
        db.add(history)
        await db.flush()

        # Trigger box completion check
        await BoxService._check_box_completion(db, box_id)

        return ecu_context

    @staticmethod
    async def start_rework(
        db: AsyncSession,
        session_id: UUID,
        box_id: UUID,
        ecu_code: str,
        user: User,
    ) -> SessionBoxECU:
        ecu_result = await db.execute(
            select(SessionBoxECU).where(
                and_(
                    SessionBoxECU.session_id == session_id,
                    SessionBoxECU.box_id == box_id,
                    SessionBoxECU.ecu_code == ecu_code,
                )
            )
        )
        ecu_context = ecu_result.scalar_one_or_none()
        if not ecu_context:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECU not found in this box/session",
            )
        if ecu_context.status != "failed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"ECU must be in 'failed' status to start rework. "
                    f"Current status: '{ecu_context.status}'."
                ),
            )

        ecu_context.status = "rework_pending"
        ecu_context.version += 1
        await db.flush()

        # Box stays 'blocked' — _check_box_completion is not called here on purpose;
        # the box will be re-evaluated only after the rework flash attempt completes.
        history = History(
            session_id=session_id,
            box_id=box_id,
            ecu_context_id=ecu_context.id,
            user_id=user.id,
            action="REWORK_STARTED",
            data={"ecu_code": ecu_code},
        )
        db.add(history)
        await db.flush()

        return ecu_context

    @staticmethod
    async def get_attempts(
        db: AsyncSession,
        ecu_context_id: UUID,
    ) -> List[FlashAttempt]:
        result = await db.execute(
            select(FlashAttempt)
            .where(FlashAttempt.ecu_context_id == ecu_context_id)
            .order_by(FlashAttempt.attempt_no)
        )
        return result.scalars().all()
