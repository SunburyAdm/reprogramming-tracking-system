from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "viewer"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    avatar: Optional[str] = None
    avatar_color: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: str
    avatar: Optional[str] = None
    avatar_color: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Session ─────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    name: str
    target_sw_version: str

class SessionUpdate(BaseModel):
    name: Optional[str] = None
    target_sw_version: Optional[str] = None

class StationCreate(BaseModel):
    name: str
    member_ids: List[UUID] = []

class StationMembersUpdate(BaseModel):
    member_ids: List[UUID]

# ─── Station Setup ────────────────────────────────────────────────────────────

class StationSetupCreate(BaseModel):
    name: str
    attributes: dict[str, str] = {}

class StationSetupUpdate(BaseModel):
    name: Optional[str] = None
    attributes: Optional[dict[str, str]] = None

class StationSetupResponse(BaseModel):
    id: UUID
    station_id: UUID
    name: str
    attributes: dict[str, str] = {}
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class StationResponse(BaseModel):
    id: UUID
    session_id: UUID
    name: str
    created_at: datetime
    members: List[UserResponse] = []
    setups: List[StationSetupResponse] = []
    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: UUID
    name: str
    target_sw_version: str
    status: str
    created_by: UUID
    created_at: datetime
    started_at: Optional[datetime]
    closed_at: Optional[datetime]
    stations: List[StationResponse] = []
    class Config:
        from_attributes = True


# ─── Box ─────────────────────────────────────────────────────────────────────

class BoxCreate(BaseModel):
    box_serial: str
    expected_ecu_count: Optional[int] = None

class BoxStatusUpdate(BaseModel):
    status: str

class BoxResponse(BaseModel):
    id: UUID
    session_id: UUID
    box_serial: str
    expected_ecu_count: Optional[int]
    learned_count: int
    inventory_frozen: bool
    status: str
    assigned_station_id: Optional[UUID]
    frozen_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    failed_count: int = 0
    scratch_count: int = 0
    assigned_station_name: Optional[str] = None
    class Config:
        from_attributes = True


# ─── ECU context ─────────────────────────────────────────────────────────────

class ECUContextResponse(BaseModel):
    id: UUID
    session_id: UUID
    box_id: UUID
    ecu_code: str
    status: str
    attempts: int
    last_station_id: Optional[UUID]
    last_user_id: Optional[UUID]
    current_attempt_started_at: Optional[datetime]
    last_attempt_duration_seconds: Optional[float]
    total_time_seconds: float
    created_at: datetime
    updated_at: datetime
    version: int
    class Config:
        from_attributes = True


# ─── Flash ───────────────────────────────────────────────────────────────────

class StartFlashRequest(BaseModel):
    ecu_code: str
    expected_version: int

class FinishFlashRequest(BaseModel):
    ecu_code: str
    result: str  # success | failed
    notes: Optional[str] = None
    expected_version: int

class StartReworkRequest(BaseModel):
    ecu_code: str

class FlashAttemptResponse(BaseModel):
    id: UUID
    attempt_no: int
    started_at: datetime
    ended_at: Optional[datetime]
    result: str
    duration_seconds: Optional[float]
    user_id: Optional[UUID]
    station_id: Optional[UUID]
    notes: Optional[str]
    class Config:
        from_attributes = True


# ─── Upload ──────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    id: UUID
    ecu_context_id: UUID
    uploader_id: UUID
    filename: str
    file_size: int
    kind: str
    notes: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# ─── History ─────────────────────────────────────────────────────────────────

class HistoryEntry(BaseModel):
    id: UUID
    session_id: Optional[UUID]
    box_id: Optional[UUID]
    ecu_context_id: Optional[UUID]
    user_id: Optional[UUID]
    action: str
    data: Optional[dict]
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Analytics ───────────────────────────────────────────────────────────────

class BoxKPI(BaseModel):
    box_id: UUID
    box_serial: str
    station_name: Optional[str]
    total_ecus: int
    success_count: int
    failed_count: int
    rework_count: int
    avg_flash_seconds: Optional[float]
    total_duration_seconds: Optional[float]
    status: str

class SessionAnalytics(BaseModel):
    session_id: UUID
    total_boxes: int
    total_ecus: int
    completed_boxes: int
    blocked_boxes: int
    success_ecus: int
    failed_ecus: int
    overall_failure_rate: float
    boxes: List[BoxKPI] = []
