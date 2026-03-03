from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from app.models.ecu import ECU
from app.models.user import User
from app.models.history import ECUHistory


class ECUService:
    @staticmethod
    async def create_or_update_ecu(
        db: AsyncSession,
        barcode: str,
        serial: Optional[str] = None,
        hw_part_no: Optional[str] = None,
        hw_version: Optional[str] = None,
        sw_version: Optional[str] = None,
    ) -> ECU:
        """Create new or update existing ECU by barcode."""
        result = await db.execute(select(ECU).where(ECU.barcode == barcode))
        ecu = result.scalars().first()

        if ecu:
            # Update existing
            ecu.last_seen = datetime.utcnow()
            ecu.updated_at = datetime.utcnow()
            if serial:
                ecu.serial = serial
            if hw_part_no:
                ecu.hw_part_no = hw_part_no
            if hw_version:
                ecu.hw_version = hw_version
            if sw_version:
                ecu.sw_version = sw_version
            
            # Create history entry
            history = ECUHistory(
                ecu_id=ecu.id,
                action="scanned",
                data={"barcode": barcode},
            )
            db.add(history)
        else:
            # Create new
            ecu = ECU(
                barcode=barcode,
                serial=serial,
                hw_part_no=hw_part_no,
                hw_version=hw_version,
                sw_version=sw_version,
                status="pending",
            )
            db.add(ecu)
            await db.flush()
            
            # Create history entry
            history = ECUHistory(
                ecu_id=ecu.id,
                action="created",
                data={"barcode": barcode},
            )
            db.add(history)

        await db.flush()
        await db.refresh(ecu)
        return ecu

    @staticmethod
    async def get_ecu(db: AsyncSession, ecu_id: UUID) -> Optional[ECU]:
        """Get ECU by ID."""
        result = await db.execute(select(ECU).where(ECU.id == ecu_id))
        return result.scalars().first()

    @staticmethod
    async def patch_ecu(
        db: AsyncSession,
        ecu_id: UUID,
        expected_version: int,
        user_id: UUID,
        barcode: Optional[str] = None,
        serial: Optional[str] = None,
        hw_part_no: Optional[str] = None,
        status: Optional[str] = None,
    ) -> ECU:
        """Edit ECU fields (barcode, serial, hw_part_no, status)."""
        result = await db.execute(select(ECU).where(ECU.id == ecu_id))
        ecu = result.scalars().first()
        if not ecu:
            raise HTTPException(status_code=404, detail="ECU not found")
        if ecu.version != expected_version:
            raise HTTPException(status_code=409, detail="Version conflict")

        changes: dict = {}
        if barcode is not None and barcode != ecu.barcode:
            ecu.barcode = barcode
            changes["barcode"] = barcode
        if serial is not None and serial != ecu.serial:
            ecu.serial = serial
            changes["serial"] = serial
        if hw_part_no is not None and hw_part_no != ecu.hw_part_no:
            ecu.hw_part_no = hw_part_no
            changes["hw_part_no"] = hw_part_no
        if status is not None and status != ecu.status:
            allowed = {"pending", "in_progress", "done", "blocked"}
            if status not in allowed:
                raise HTTPException(status_code=422, detail=f"Invalid status: {status}")
            ecu.status = status
            changes["status"] = status

        if changes:
            ecu.version += 1
            ecu.updated_at = datetime.utcnow()
            history = ECUHistory(
                ecu_id=ecu.id,
                action="edited",
                data={"changed_by": str(user_id), **changes},
            )
            db.add(history)
            await db.flush()
            await db.refresh(ecu)
        return ecu

    @staticmethod
    async def list_ecus(
        db: AsyncSession,
        status: Optional[str] = None,
        assignee_id: Optional[UUID] = None,
        search: Optional[str] = None,
    ) -> list:
        """List ECUs with filters."""
        query = select(ECU)
        
        if status:
            query = query.where(ECU.status == status)
        
        if assignee_id:
            query = query.where(ECU.assignee_id == assignee_id)
        
        if search:
            search_term = f"%{search}%"
            from sqlalchemy import or_
            query = query.where(
                or_(
                    ECU.barcode.ilike(search_term),
                    ECU.serial.ilike(search_term),
                    ECU.hw_part_no.ilike(search_term),
                )
            )
        
        query = query.order_by(ECU.last_seen.desc())
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def assign_ecu(
        db: AsyncSession,
        ecu_id: UUID,
        user_id: UUID,
        expected_version: int,
    ) -> ECU:
        """Assign ECU to user with optimistic locking."""
        ecu = await ECUService.get_ecu(db, ecu_id)
        
        if not ecu:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECU not found",
            )
        
        if ecu.version != expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ECU version mismatch. Another user may have modified it.",
            )
        
        ecu.assignee_id = user_id
        ecu.status = "in_progress"
        ecu.version += 1
        ecu.updated_at = datetime.utcnow()
        
        # Create history
        history = ECUHistory(
            ecu_id=ecu.id,
            user_id=user_id,
            action="assigned",
            data={"assignee_id": str(user_id)},
        )
        db.add(history)
        
        await db.flush()
        await db.refresh(ecu)
        return ecu

    @staticmethod
    async def release_ecu(db: AsyncSession, ecu_id: UUID, user_id: UUID) -> ECU:
        """Release ECU from user."""
        ecu = await ECUService.get_ecu(db, ecu_id)
        
        if not ecu:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECU not found",
            )
        
        if ecu.assignee_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only release ECUs assigned to you",
            )
        
        ecu.assignee_id = None
        ecu.status = "pending"
        ecu.version += 1
        ecu.updated_at = datetime.utcnow()
        
        # Create history
        history = ECUHistory(
            ecu_id=ecu.id,
            user_id=user_id,
            action="released",
            data={},
        )
        db.add(history)
        
        await db.flush()
        await db.refresh(ecu)
        return ecu

    @staticmethod
    async def update_status(
        db: AsyncSession,
        ecu_id: UUID,
        new_status: str,
        expected_version: int,
        user_id: UUID,
    ) -> ECU:
        """Update ECU status with optimistic locking."""
        ecu = await ECUService.get_ecu(db, ecu_id)
        
        if not ecu:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECU not found",
            )
        
        if ecu.version != expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ECU version mismatch",
            )
        
        old_status = ecu.status
        ecu.status = new_status
        ecu.version += 1
        ecu.updated_at = datetime.utcnow()
        
        # Create history
        history = ECUHistory(
            ecu_id=ecu.id,
            user_id=user_id,
            action="status_change",
            data={"from": old_status, "to": new_status},
        )
        db.add(history)
        
        await db.flush()
        await db.refresh(ecu)
        return ecu

    @staticmethod
    async def lock_ecu(
        db: AsyncSession,
        ecu_id: UUID,
        user_id: UUID,
        duration_minutes: int = 30,
    ) -> ECU:
        """Lock ECU for user."""
        ecu = await ECUService.get_ecu(db, ecu_id)
        
        if not ecu:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECU not found",
            )
        
        if ecu.lock_owner_id and ecu.lock_until > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ECU is already locked by another user",
            )
        
        ecu.lock_owner_id = user_id
        ecu.lock_until = datetime.utcnow() + timedelta(minutes=duration_minutes)
        
        history = ECUHistory(
            ecu_id=ecu.id,
            user_id=user_id,
            action="lock",
            data={"duration_minutes": duration_minutes},
        )
        db.add(history)
        
        await db.flush()
        await db.refresh(ecu)
        return ecu

    @staticmethod
    async def unlock_ecu(db: AsyncSession, ecu_id: UUID, user_id: UUID) -> ECU:
        """Unlock ECU."""
        ecu = await ECUService.get_ecu(db, ecu_id)
        
        if not ecu:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ECU not found",
            )
        
        if ecu.lock_owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only unlock ECUs you locked",
            )
        
        ecu.lock_owner_id = None
        ecu.lock_until = None
        
        history = ECUHistory(
            ecu_id=ecu.id,
            user_id=user_id,
            action="unlock",
            data={},
        )
        db.add(history)
        
        await db.flush()
        await db.refresh(ecu)
        return ecu

    @staticmethod
    async def cleanup_expired_locks(db: AsyncSession):
        """Clean up expired locks."""
        from sqlalchemy import update
        
        await db.execute(
            update(ECU)
            .where(
                and_(
                    ECU.lock_until.isnot(None),
                    ECU.lock_until < datetime.utcnow(),
                )
            )
            .values(lock_owner_id=None, lock_until=None)
        )
        await db.commit()
