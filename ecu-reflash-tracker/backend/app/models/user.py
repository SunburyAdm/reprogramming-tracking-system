import uuid
from sqlalchemy import Column, String, DateTime, Enum, Text
from datetime import datetime
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TECH = "tech"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    id            = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email         = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name          = Column(String, nullable=False)
    role          = Column(Enum(UserRole), nullable=False, default=UserRole.VIEWER)
    avatar        = Column(Text, nullable=True)
    avatar_color  = Column(String(7), nullable=True)
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow)
