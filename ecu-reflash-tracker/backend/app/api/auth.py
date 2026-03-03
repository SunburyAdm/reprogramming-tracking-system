from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from typing import List

from uuid import UUID
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    verify_password,
    get_password_hash,
)
from app.core.config import settings
from app.models.user import User
from app.services import UserService
from app.schemas import LoginRequest, TokenResponse, UserResponse, UserCreate, UserUpdate, ProfileUpdate

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


@router.patch("/auth/me", response_model=UserResponse)
async def update_me(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Any authenticated user can update their own profile."""
    # Email uniqueness check
    if body.email and body.email != current_user.email:
        existing = await UserService.get_user_by_email(db, body.email)
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")

    # Password change requires current password verification
    if body.new_password:
        if not body.current_password:
            raise HTTPException(status_code=422, detail="current_password is required to set a new password")
        if not verify_password(body.current_password, current_user.password_hash):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

    if body.name is not None:
        current_user.name = body.name
    if body.email is not None:
        current_user.email = body.email
    if body.new_password:
        current_user.password_hash = get_password_hash(body.new_password)
    if body.avatar is not None:
        current_user.avatar = body.avatar
    if body.avatar_color is not None:
        current_user.avatar_color = body.avatar_color

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/users", response_model=List[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(User).order_by(User.name))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if body.role not in ("admin", "tech", "viewer"):
        raise HTTPException(status_code=422, detail="Invalid role. Must be admin, tech or viewer")
    user = await UserService.create_user(db, body.email, body.password, body.name, body.role)
    await db.commit()
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if body.role is not None and body.role not in ("admin", "tech", "viewer"):
        raise HTTPException(status_code=422, detail="Invalid role")
    user = await UserService.update_user(db, user_id, body.name, body.email, body.password, body.role)
    await db.commit()
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await UserService.delete_user(db, user_id, current_user.id)
    await db.commit()
