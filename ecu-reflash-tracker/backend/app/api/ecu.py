from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
import hashlib

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas import (
    ECUCreate,
    ECUResponse,
    ECUStatusUpdate,
    ECUAssign,
    ECUEditRequest,
    UploadCreate,
    UploadResponse,
    HistoryEntry,
)
from app.services.ecu import ECUService
from app.services import UserService, UploadService
from app.services.s3 import s3_service
from app.services.history import HistoryService
from app.core.ws import emit_event
from fastapi.encoders import jsonable_encoder

router = APIRouter(prefix="/api", tags=["ecu"])


@router.post("/ecus", response_model=ECUResponse)
async def scan_or_create_ecu(
    request: ECUCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scan/create ECU by barcode."""
    ecu = await ECUService.create_or_update_ecu(
        db,
        barcode=request.barcode,
        serial=request.serial,
        hw_part_no=request.hw_part_no,
        hw_version=request.hw_version,
        sw_version=request.sw_version,
    )
    await db.commit()
    await emit_event("ECU_CREATED", jsonable_encoder(ecu))
    return ecu


@router.get("/ecus", response_model=list[ECUResponse])
async def list_ecus(
    status: Optional[str] = None,
    assignee_id: Optional[UUID] = None,
    search: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List ECUs with filters."""
    if assignee_id == UUID("00000000-0000-0000-0000-000000000001"):
        # Special value for "my ECUs"
        assignee_id = user.id
    elif isinstance(assignee_id, str) and assignee_id == "mine":
        assignee_id = user.id
    
    ecus = await ECUService.list_ecus(
        db,
        status=status,
        assignee_id=assignee_id,
        search=search,
    )
    return ecus


@router.get("/ecus/{ecu_id}", response_model=ECUResponse)
async def get_ecu(
    ecu_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get ECU details."""
    ecu = await ECUService.get_ecu(db, ecu_id)
    if not ecu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ECU not found",
        )
    return ecu


@router.post("/ecus/{ecu_id}/assign", response_model=ECUResponse)
async def assign_ecu(
    ecu_id: UUID,
    request: ECUAssign,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign ECU to current user."""
    ecu = await ECUService.assign_ecu(db, ecu_id, user.id, request.expected_version)
    await db.commit()
    await emit_event("ECU_UPDATED", jsonable_encoder(ecu))
    return ecu


@router.post("/ecus/{ecu_id}/release", response_model=ECUResponse)
async def release_ecu(
    ecu_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Release ECU from current user."""
    ecu = await ECUService.release_ecu(db, ecu_id, user.id)
    await db.commit()
    await emit_event("ECU_UPDATED", jsonable_encoder(ecu))
    return ecu


@router.post("/ecus/{ecu_id}/status", response_model=ECUResponse)
async def update_ecu_status(
    ecu_id: UUID,
    request: ECUStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update ECU status."""
    ecu = await ECUService.update_status(
        db, ecu_id, request.status, request.expected_version, user.id
    )
    await db.commit()
    await emit_event("ECU_UPDATED", jsonable_encoder(ecu))
    return ecu


@router.patch("/ecus/{ecu_id}", response_model=ECUResponse)
async def edit_ecu(
    ecu_id: UUID,
    request: ECUEditRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit ECU fields (barcode, serial, hw_part_no, status)."""
    ecu = await ECUService.patch_ecu(
        db,
        ecu_id,
        expected_version=request.expected_version,
        user_id=user.id,
        barcode=request.barcode,
        serial=request.serial,
        hw_part_no=request.hw_part_no,
        status=request.status,
    )
    await db.commit()
    await emit_event("ECU_UPDATED", jsonable_encoder(ecu))
    return ecu


@router.post("/ecus/{ecu_id}/lock", response_model=ECUResponse)
async def lock_ecu(
    ecu_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lock ECU for current user."""
    ecu = await ECUService.lock_ecu(db, ecu_id, user.id)
    await db.commit()
    await emit_event("ECU_UPDATED", jsonable_encoder(ecu))
    return ecu


@router.post("/ecus/{ecu_id}/unlock", response_model=ECUResponse)
async def unlock_ecu(
    ecu_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlock ECU."""
    ecu = await ECUService.unlock_ecu(db, ecu_id, user.id)
    await db.commit()
    await emit_event("ECU_UPDATED", jsonable_encoder(ecu))
    return ecu


@router.post("/ecus/{ecu_id}/uploads", response_model=UploadResponse)
async def upload_file(
    ecu_id: UUID,
    file: UploadFile = File(...),
    kind: str = Form(...),
    notes: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload file to ECU."""
    # Check ECU exists
    ecu = await ECUService.get_ecu(db, ecu_id)
    if not ecu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ECU not found",
        )
    
    # Read file
    file_data = await file.read()
    
    # Calculate checksum
    checksum = hashlib.sha256(file_data).hexdigest()
    
    # Upload to S3
    s3_key = f"ecus/{ecu_id}/uploads/{file.filename}"
    await s3_service.upload_file(file_data, file.filename, s3_key)
    
    # Save upload record
    upload = await UploadService.create_upload(
        db,
        ecu_id=ecu_id,
        uploader_id=user.id,
        filename=file.filename,
        s3_key=s3_key,
        file_size=len(file_data),
        checksum_sha256=checksum,
        kind=kind,
        notes=notes,
    )
    
    await db.commit()
    return upload


@router.get("/uploads/{upload_id}/download")
async def download_file(
    upload_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get presigned download URL for file."""
    upload = await UploadService.get_upload(db, upload_id)
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found",
        )
    
    url = await s3_service.get_presigned_url(upload.s3_key, expires=3600)
    return {"download_url": url}


@router.get("/ecus/{ecu_id}/history", response_model=list[HistoryEntry])
async def get_ecu_history(
    ecu_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get history for ECU."""
    ecu = await ECUService.get_ecu(db, ecu_id)
    if not ecu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ECU not found",
        )
    
    history = await HistoryService.get_ecu_history(db, ecu_id)
    return history


@router.get("/ecus/{ecu_id}/uploads", response_model=list[UploadResponse])
async def get_ecu_uploads(
    ecu_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get uploads for ECU."""
    ecu = await ECUService.get_ecu(db, ecu_id)
    if not ecu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ECU not found",
        )
    
    uploads = await UploadService.get_ecu_uploads(db, ecu_id)
    return uploads
