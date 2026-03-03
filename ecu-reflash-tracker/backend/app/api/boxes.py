from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
import hashlib

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.schemas import (
    BoxCreate, BoxResponse,
    ECUContextResponse, FlashAttemptResponse,
    StartFlashRequest, FinishFlashRequest, StartReworkRequest,
    UploadResponse, HistoryEntry
)
from app.services.box_service import BoxService
from app.services.flash_service import FlashService
from app.services.s3 import s3_service
from app.models import Upload, History
from app.core.ws import emit_event
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select

router = APIRouter(prefix="/api/sessions/{session_id}/boxes", tags=["boxes"])


@router.get("", response_model=List[BoxResponse])
async def list_boxes(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BoxService.list_boxes(db, session_id)


@router.post("", response_model=BoxResponse, status_code=201)
async def create_box(
    session_id: UUID,
    body: BoxCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    box = await BoxService.create_box(db, session_id, body.box_serial, body.expected_ecu_count)
    await db.commit()
    await emit_event("BOX_UPDATED", jsonable_encoder(box))
    return box


@router.get("/{box_id}", response_model=BoxResponse)
async def get_box(
    session_id: UUID,
    box_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BoxService.get_box(db, session_id, box_id)


@router.post("/{box_id}/claim", response_model=BoxResponse)
async def claim_box(
    session_id: UUID,
    box_id: UUID,
    station_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    box = await BoxService.claim_box(db, session_id, box_id, station_id)
    await db.commit()
    await emit_event("BOX_UPDATED", jsonable_encoder(box))
    return box


@router.delete("/{box_id}", status_code=204)
async def delete_box(
    session_id: UUID,
    box_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await BoxService.delete_box(db, session_id, box_id)
    await db.commit()
    await emit_event("BOX_DELETED", {"session_id": str(session_id), "box_id": str(box_id)})


@router.get("/{box_id}/ecus", response_model=List[ECUContextResponse])
async def get_box_ecus(
    session_id: UUID,
    box_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await BoxService.get_box_ecus(db, box_id)


@router.post("/{box_id}/scan_ecu", response_model=ECUContextResponse, status_code=201)
async def scan_ecu(
    session_id: UUID,
    box_id: UUID,
    ecu_code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await BoxService.scan_ecu(db, session_id, box_id, ecu_code, user)
    await db.commit()
    await emit_event("ECU_UPDATED", jsonable_encoder(ctx))
    await emit_event("BOX_UPDATED", {"session_id": str(session_id), "box_id": str(box_id)})
    return ctx


@router.post("/{box_id}/freeze", response_model=BoxResponse)
async def freeze_inventory(
    session_id: UUID,
    box_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    box = await BoxService.freeze_inventory(db, session_id, box_id, user)
    await db.commit()
    await emit_event("BOX_UPDATED", jsonable_encoder(box))
    return box


@router.post("/{box_id}/start_flash", response_model=ECUContextResponse)
async def start_flash(
    session_id: UUID,
    box_id: UUID,
    body: StartFlashRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await FlashService.start_flash(
        db, session_id, box_id, body.ecu_code, body.expected_version, user
    )
    await db.commit()
    await emit_event("FLASH_STARTED", jsonable_encoder(ctx))
    await emit_event("ECU_UPDATED", jsonable_encoder(ctx))
    return ctx


@router.post("/{box_id}/finish_flash", response_model=ECUContextResponse)
async def finish_flash(
    session_id: UUID,
    box_id: UUID,
    body: FinishFlashRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await FlashService.finish_flash(
        db, session_id, box_id, body.ecu_code, body.result, body.notes, body.expected_version, user
    )
    await db.commit()
    await emit_event("FLASH_FINISHED", jsonable_encoder(ctx))
    await emit_event("ECU_UPDATED", jsonable_encoder(ctx))
    await emit_event("BOX_UPDATED", {"session_id": str(session_id), "box_id": str(box_id)})
    return ctx


@router.post("/{box_id}/start_rework", response_model=ECUContextResponse)
async def start_rework(
    session_id: UUID,
    box_id: UUID,
    body: StartReworkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await FlashService.start_rework(db, session_id, box_id, body.ecu_code, user)
    await db.commit()
    await emit_event("ECU_UPDATED", jsonable_encoder(ctx))
    return ctx


@router.get("/{box_id}/ecus/{ecu_context_id}/attempts", response_model=List[FlashAttemptResponse])
async def get_attempts(
    session_id: UUID,
    box_id: UUID,
    ecu_context_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await FlashService.get_attempts(db, ecu_context_id)


@router.post("/{box_id}/ecus/{ecu_context_id}/uploads", response_model=UploadResponse, status_code=201)
async def upload_file(
    session_id: UUID,
    box_id: UUID,
    ecu_context_id: UUID,
    file: UploadFile = File(...),
    kind: str = Form("log"),
    notes: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    sha = hashlib.sha256(content).hexdigest()
    s3_key = f"sessions/{session_id}/boxes/{box_id}/ecus/{ecu_context_id}/{file.filename}"
    await s3_service.upload_file(content, s3_key, file.content_type or "application/octet-stream")

    upload = Upload(
        ecu_context_id=ecu_context_id,
        uploader_id=user.id,
        filename=file.filename,
        s3_key=s3_key,
        file_size=len(content),
        checksum_sha256=sha,
        kind=kind,
        notes=notes,
    )
    db.add(upload)

    hist = History(
        session_id=session_id,
        box_id=box_id,
        ecu_context_id=ecu_context_id,
        user_id=user.id,
        action="upload_added",
        data={"filename": file.filename, "kind": kind},
    )
    db.add(hist)
    await db.flush()
    await db.commit()
    await emit_event("UPLOAD_ADDED", {"ecu_context_id": str(ecu_context_id), "filename": file.filename})
    return upload


@router.get("/{box_id}/ecus/{ecu_context_id}/uploads", response_model=List[UploadResponse])
async def get_ecu_uploads(
    session_id: UUID,
    box_id: UUID,
    ecu_context_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Upload)
        .where(Upload.ecu_context_id == ecu_context_id)
        .order_by(Upload.created_at)
    )
    return result.scalars().all()


@router.get("/{box_id}/ecus/{ecu_context_id}/history", response_model=List[HistoryEntry])
async def get_ecu_history(
    session_id: UUID,
    box_id: UUID,
    ecu_context_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(History)
        .where(History.ecu_context_id == ecu_context_id)
        .order_by(History.created_at)
    )
    return result.scalars().all()
