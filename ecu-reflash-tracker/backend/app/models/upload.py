import uuid
from sqlalchemy import Column, String, DateTime, BigInteger, ForeignKey
from datetime import datetime
from sqlalchemy.orm import relationship

from app.core.database import Base


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ecu_context_id = Column(String(36), ForeignKey("session_box_ecus.id", ondelete="CASCADE"), nullable=False, index=True)
    uploader_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    s3_key = Column(String(1000), nullable=False)
    file_size = Column(BigInteger, default=0)
    checksum_sha256 = Column(String(64), nullable=True)
    kind = Column(String(50), nullable=False, default="log")  # dump, log, config
    notes = Column(String(1000), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    ecu_context = relationship("SessionBoxECU", back_populates="uploads")
    uploader = relationship("User", foreign_keys=[uploader_id])
