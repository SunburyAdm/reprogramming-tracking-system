from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from fastapi import HTTPException, status

from app.models import Session, Station, User


class SessionService:

    VALID_TRANSITIONS = {
        "draft": "ready",
        "ready": "active",
        "active": "completed",
        "completed": "archived",
    }

    @staticmethod
    async def create_session(
        db: AsyncSession,
        name: str,
        target_sw_version: str,
        user_id: UUID,
    ) -> Session:
        session = Session(
            name=name,
            target_sw_version=target_sw_version,
            status="draft",
            created_by=user_id,
        )
        db.add(session)
        await db.flush()
        return session

    @staticmethod
    async def update_session(
        db: AsyncSession,
        session_id: UUID,
        **kwargs,
    ) -> Session:
        result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        for key, value in kwargs.items():
            if value is not None:
                setattr(session, key, value)
        await db.flush()
        return session

    @staticmethod
    async def get_session(db: AsyncSession, session_id: UUID) -> Session:
        result = await db.execute(
            select(Session)
            .options(selectinload(Session.stations).selectinload(Station.members))
            .where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        return session

    @staticmethod
    async def list_sessions(
        db: AsyncSession,
        user_id: Optional[UUID] = None,
    ) -> List[Session]:
        query = select(Session).options(selectinload(Session.stations).selectinload(Station.members))
        if user_id is not None:
            query = query.where(Session.created_by == user_id)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def transition(
        db: AsyncSession,
        session_id: UUID,
        new_status: str,
        user_id: UUID,
    ) -> Session:
        result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        valid_next = SessionService.VALID_TRANSITIONS.get(session.status)
        if valid_next != new_status:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot transition from '{session.status}' to '{new_status}'. "
                    f"Expected next status: '{valid_next}'."
                ),
            )

        session.status = new_status
        now = datetime.utcnow()

        if new_status == "active":
            session.started_at = now
        elif new_status in ("completed", "archived"):
            if session.closed_at is None:
                session.closed_at = now

        await db.flush()
        return session

    @staticmethod
    async def add_station(
        db: AsyncSession,
        session_id: UUID,
        name: str,
        member_ids: List[UUID],
    ) -> Station:
        session_result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = session_result.scalar_one_or_none()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        station = Station(session_id=session_id, name=name)
        station.members = []  # initialize collection to avoid lazy-load on first append
        db.add(station)
        await db.flush()

        if member_ids:
            for uid in member_ids:
                user_result = await db.execute(
                    select(User).where(User.id == uid)
                )
                user = user_result.scalar_one_or_none()
                if user is not None:
                    station.members.append(user)

        await db.flush()

        # Re-fetch with eager-loaded members to avoid lazy-load MissingGreenlet on serialization
        refreshed = await db.execute(
            select(Station)
            .options(selectinload(Station.members))
            .where(Station.id == station.id)
        )
        return refreshed.scalar_one()

    @staticmethod
    async def get_stations(
        db: AsyncSession,
        session_id: UUID,
    ) -> List[Station]:
        result = await db.execute(
            select(Station)
            .options(selectinload(Station.members))
            .where(Station.session_id == session_id)
        )
        return result.scalars().all()

    @staticmethod
    async def delete_session(
        db: AsyncSession,
        session_id: UUID,
    ) -> None:
        result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        await db.delete(session)
        await db.flush()

    @staticmethod
    async def reopen_session(
        db: AsyncSession,
        session_id: UUID,
        user_id: UUID,
    ) -> Session:
        result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        if session.status not in ("completed", "archived"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot reopen session in status '{session.status}'. Only completed or archived sessions can be reopened.",
            )
        session.status = "active"
        session.closed_at = None
        await db.flush()
        return session
