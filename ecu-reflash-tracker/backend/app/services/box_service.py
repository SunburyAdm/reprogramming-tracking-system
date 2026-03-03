from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from fastapi import HTTPException, status

from app.models import Session, Box, SessionBoxECU, History, User


class BoxService:

    @staticmethod
    async def create_box(
        db: AsyncSession,
        session_id: UUID,
        box_serial: str,
        expected_ecu_count: Optional[int] = None,
    ) -> Box:
        session_result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        if session.status != "active":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Session must be active to add boxes",
            )

        existing_result = await db.execute(
            select(Box).where(
                and_(
                    Box.session_id == session_id,
                    Box.box_serial == box_serial,
                )
            )
        )
        if existing_result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Box serial already exists in this session",
            )

        box = Box(
            session_id=session_id,
            box_serial=box_serial,
            expected_ecu_count=expected_ecu_count,
            learned_count=0,
            inventory_frozen=False,
            status="pending",
        )
        db.add(box)
        await db.flush()
        return box

    @staticmethod
    async def claim_box(
        db: AsyncSession,
        session_id: UUID,
        box_id: UUID,
        station_id: UUID,
    ) -> Box:
        result = await db.execute(
            select(Box).where(
                and_(Box.id == box_id, Box.session_id == session_id)
            )
        )
        box = result.scalar_one_or_none()
        if not box:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Box not found",
            )
        if box.assigned_station_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Box is already claimed by a station",
            )

        box.assigned_station_id = station_id
        box.status = "learning"
        await db.flush()
        return box

    @staticmethod
    async def scan_ecu(
        db: AsyncSession,
        session_id: UUID,
        box_id: UUID,
        ecu_code: str,
        user: User,
    ) -> SessionBoxECU:
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
        if box.status != "learning":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Box must be in 'learning' status to scan ECUs",
            )
        if box.inventory_frozen:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Box inventory is already frozen; cannot scan more ECUs",
            )

        existing_result = await db.execute(
            select(SessionBoxECU).where(
                and_(
                    SessionBoxECU.session_id == session_id,
                    SessionBoxECU.ecu_code == ecu_code,
                )
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ECU code already registered in this session (possibly in another box)",
            )

        ecu_context = SessionBoxECU(
            session_id=session_id,
            box_id=box_id,
            ecu_code=ecu_code,
            status="learned",
            attempts=0,
            last_station_id=box.assigned_station_id,
            last_user_id=user.id,
            total_time_seconds=0,
            version=1,
        )
        db.add(ecu_context)
        await db.flush()

        box.learned_count = (box.learned_count or 0) + 1
        await db.flush()

        history = History(
            session_id=session_id,
            box_id=box_id,
            ecu_context_id=ecu_context.id,
            user_id=user.id,
            action="ECU_SCANNED",
            data={"ecu_code": ecu_code, "box_id": str(box_id)},
        )
        db.add(history)
        await db.flush()

        return ecu_context

    @staticmethod
    async def freeze_inventory(
        db: AsyncSession,
        session_id: UUID,
        box_id: UUID,
        user: User,
    ) -> Box:
        result = await db.execute(
            select(Box).where(
                and_(Box.id == box_id, Box.session_id == session_id)
            )
        )
        box = result.scalar_one_or_none()
        if not box:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Box not found",
            )
        if box.inventory_frozen:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Box inventory is already frozen",
            )

        count_result = await db.execute(
            select(func.count()).select_from(SessionBoxECU).where(
                and_(
                    SessionBoxECU.box_id == box_id,
                    SessionBoxECU.session_id == session_id,
                )
            )
        )
        count = count_result.scalar() or 0

        now = datetime.utcnow()
        box.inventory_frozen = True
        box.frozen_at = now
        box.learned_count = count
        box.status = "in_progress"
        await db.flush()

        history = History(
            session_id=session_id,
            box_id=box_id,
            user_id=user.id,
            action="INVENTORY_FROZEN",
            data={"learned_count": count, "frozen_at": now.isoformat()},
        )
        db.add(history)
        await db.flush()

        return box

    @staticmethod
    async def get_box(
        db: AsyncSession,
        session_id: UUID,
        box_id: UUID,
    ) -> Box:
        result = await db.execute(
            select(Box).where(
                and_(Box.id == box_id, Box.session_id == session_id)
            )
        )
        box = result.scalar_one_or_none()
        if not box:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Box not found",
            )
        return box

    @staticmethod
    async def list_boxes(
        db: AsyncSession,
        session_id: UUID,
    ) -> List[Box]:
        result = await db.execute(
            select(Box).where(Box.session_id == session_id)
        )
        return result.scalars().all()

    @staticmethod
    async def get_box_ecus(
        db: AsyncSession,
        box_id: UUID,
    ) -> List[SessionBoxECU]:
        result = await db.execute(
            select(SessionBoxECU).where(SessionBoxECU.box_id == box_id)
        )
        return result.scalars().all()

    @staticmethod
    async def delete_box(
        db: AsyncSession,
        session_id: UUID,
        box_id: UUID,
    ) -> None:
        from app.models import Box as BoxModel
        result = await db.execute(
            select(BoxModel).where(
                and_(BoxModel.id == box_id, BoxModel.session_id == session_id)
            )
        )
        box = result.scalar_one_or_none()
        if not box:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Box not found",
            )
        await db.delete(box)
        await db.flush()

    @staticmethod
    async def _check_box_completion(
        db: AsyncSession,
        box_id: UUID,
    ) -> None:
        ecus_result = await db.execute(
            select(SessionBoxECU).where(SessionBoxECU.box_id == box_id)
        )
        ecus = ecus_result.scalars().all()

        if not ecus:
            return

        box_result = await db.execute(
            select(Box).where(Box.id == box_id)
        )
        box = box_result.scalar_one_or_none()
        if not box:
            return

        statuses = [e.status for e in ecus]

        if any(s == "failed" for s in statuses):
            box.status = "blocked"
        elif all(s == "success" for s in statuses):
            box.status = "completed"
            box.completed_at = datetime.utcnow()

        await db.flush()
