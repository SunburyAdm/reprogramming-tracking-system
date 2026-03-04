# ECU model kept minimal - the rich data is in SessionBoxECU
import uuid
from sqlalchemy import Column, String, DateTime
from datetime import datetime

from app.core.database import Base


class ECU(Base):
    """Global ECU identity; uniqueness is at the ecu_code level (no session context)."""
    __tablename__ = "ecus"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ecu_code = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
