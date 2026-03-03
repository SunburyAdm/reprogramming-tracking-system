from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from typing import List

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    verify_password,
)
from app.core.config import settings
from app.models.user import User
from app.services import UserService
from app.schemas import LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await UserService.get_user_by_email(db, request.email)
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.get("/users", response_model=List[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(User).order_by(User.name))
    return result.scalars().all()
