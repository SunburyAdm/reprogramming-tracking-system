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

# UploadService removed – superseded by new box upload endpoint in api/boxes.py
