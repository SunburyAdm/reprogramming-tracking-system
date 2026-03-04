from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.schemas import (
    SessionCreate, SessionUpdate, SessionResponse,
    StationCreate, StationResponse, StationMembersUpdate,
    StationSetupCreate, StationSetupUpdate, StationSetupResponse,
)
from app.services.session_service import SessionService
from app.core.ws import emit_event
from fastapi.encoders import jsonable_encoder

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    session = await SessionService.create_session(db, body.name, body.target_sw_version, user.id)
    await db.commit()
    await emit_event("SESSION_UPDATED", jsonable_encoder(session))
    return await SessionService.get_session(db, session.id)


@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await SessionService.list_sessions(db)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await SessionService.get_session(db, session_id)


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: UUID,
    body: SessionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    session = await SessionService.update_session(
        db, session_id,
        name=body.name,
        target_sw_version=body.target_sw_version,
    )
    await db.commit()
    await emit_event("SESSION_UPDATED", jsonable_encoder(session))
    return await SessionService.get_session(db, session_id)


@router.post("/{session_id}/ready", response_model=SessionResponse)
async def set_ready(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    s = await SessionService.transition(db, session_id, "ready", user.id)
    await db.commit()
    await emit_event("SESSION_UPDATED", jsonable_encoder(s))
    return await SessionService.get_session(db, session_id)


@router.post("/{session_id}/start", response_model=SessionResponse)
async def start_session(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    s = await SessionService.transition(db, session_id, "active", user.id)
    await db.commit()
    await emit_event("SESSION_UPDATED", jsonable_encoder(s))
    return await SessionService.get_session(db, session_id)


@router.post("/{session_id}/close", response_model=SessionResponse)
async def close_session(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    s = await SessionService.transition(db, session_id, "completed", user.id)
    await db.commit()
    await emit_event("SESSION_UPDATED", jsonable_encoder(s))
    return await SessionService.get_session(db, session_id)


@router.post("/{session_id}/reopen", response_model=SessionResponse)
async def reopen_session(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    s = await SessionService.reopen_session(db, session_id, user.id)
    await db.commit()
    await emit_event("SESSION_UPDATED", jsonable_encoder(s))
    return await SessionService.get_session(db, session_id)


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await SessionService.delete_session(db, session_id)
    await db.commit()
    await emit_event("SESSION_DELETED", {"session_id": str(session_id)})


@router.get("/{session_id}/stations", response_model=List[StationResponse])
async def get_stations(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await SessionService.get_stations(db, session_id)


@router.post("/{session_id}/stations", response_model=StationResponse, status_code=201)
async def add_station(
    session_id: UUID,
    body: StationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    station = await SessionService.add_station(db, session_id, body.name, body.member_ids)
    await db.commit()
    await emit_event("SESSION_UPDATED", {"session_id": str(session_id)})
    return station


@router.get("/{session_id}/stations/{station_id}", response_model=StationResponse)
async def get_station(
    session_id: UUID,
    station_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await SessionService.get_station(db, station_id)


@router.put("/{session_id}/stations/{station_id}/members", response_model=StationResponse)
async def update_station_members(
    session_id: UUID,
    station_id: UUID,
    body: StationMembersUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    station = await SessionService.update_station_members(db, station_id, body.member_ids)
    await db.commit()
    await emit_event("SESSION_UPDATED", {"session_id": str(session_id)})
    return station

# ─────────────────────────────────────── Station Setups ───────────────────────────────────────

@router.get("/{session_id}/stations/{station_id}/setups", response_model=List[StationSetupResponse])
async def get_setups(
    session_id: UUID,
    station_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await SessionService.get_station_setups(db, station_id)


@router.post("/{session_id}/stations/{station_id}/setups", response_model=StationSetupResponse, status_code=201)
async def create_setup(
    session_id: UUID,
    station_id: UUID,
    body: StationSetupCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value not in ("admin", "tech"):
        raise HTTPException(status_code=403, detail="Admin or tech only")
    setup = await SessionService.create_station_setup(db, station_id, body)
    await db.commit()
    await emit_event("SESSION_UPDATED", {"session_id": str(session_id)})
    return setup


@router.patch("/{session_id}/stations/{station_id}/setups/{setup_id}", response_model=StationSetupResponse)
async def update_setup(
    session_id: UUID,
    station_id: UUID,
    setup_id: UUID,
    body: StationSetupUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value not in ("admin", "tech"):
        raise HTTPException(status_code=403, detail="Admin or tech only")
    setup = await SessionService.update_station_setup(db, setup_id, body)
    await db.commit()
    return setup


@router.delete("/{session_id}/stations/{station_id}/setups/{setup_id}", status_code=204)
async def delete_setup(
    session_id: UUID,
    station_id: UUID,
    setup_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value not in ("admin", "tech"):
        raise HTTPException(status_code=403, detail="Admin or tech only")
    await SessionService.delete_station_setup(db, setup_id)
    await db.commit()