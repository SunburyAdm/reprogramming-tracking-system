from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.user import User
from app.core.security import get_password_hash


class UserService:
    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
        """Get user by email."""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalars().first()

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[User]:
        """Get user by ID."""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalars().first()

    @staticmethod
    async def create_user(
        db: AsyncSession,
        email: str,
        password: str,
        name: str,
        role: str = "viewer",
    ) -> User:
        """Create new user."""
        existing = await UserService.get_user_by_email(db, email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User already exists",
            )
        
        user = User(
            email=email,
            password_hash=get_password_hash(password),
            name=name,
            role=role,
        )
        db.add(user)
        await db.flush()
        return user

    @staticmethod
    async def update_user(
        db: AsyncSession,
        user_id: UUID,
        name: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
        role: Optional[str] = None,
    ) -> User:
        user = await UserService.get_user_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if name is not None:
            user.name = name
        if email is not None:
            existing = await UserService.get_user_by_email(db, email)
            if existing and str(existing.id) != str(user_id):
                raise HTTPException(status_code=409, detail="Email already in use")
            user.email = email
        if password:
            user.password_hash = get_password_hash(password)
        if role is not None:
            user.role = role
        await db.flush()
        return user

    @staticmethod
    async def delete_user(db: AsyncSession, user_id: UUID, current_user_id: UUID) -> None:
        if str(user_id) == str(current_user_id):
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        user = await UserService.get_user_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        await db.delete(user)
        await db.flush()

# UploadService removed – superseded by new box upload endpoint in api/boxes.py
