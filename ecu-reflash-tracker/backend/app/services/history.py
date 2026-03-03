from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from uuid import UUID
import json

from app.models.history import ECUHistory
from app.models.ecu import ECU
from app.models.user import User


class HistoryService:
    @staticmethod
    async def create_history(
        db: AsyncSession,
        ecu_id: UUID,
        action: str,
        user_id: Optional[UUID] = None,
        data: Optional[dict] = None,
    ) -> ECUHistory:
        """Create history entry."""
        history = ECUHistory(
            ecu_id=ecu_id,
            user_id=user_id,
            action=action,
            data=data,
        )
        db.add(history)
        await db.flush()
        return history

    @staticmethod
    async def get_ecu_history(db: AsyncSession, ecu_id: UUID) -> list:
        """Get history for ECU."""
        result = await db.execute(
            select(ECUHistory)
            .where(ECUHistory.ecu_id == ecu_id)
            .order_by(ECUHistory.created_at.desc())
        )
        return result.scalars().all()
