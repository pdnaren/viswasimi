from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class ParentAccessToken(Base):
    """An unguessable, revocable link a student generates from their profile
    so a parent can view a read-only progress summary without needing a
    parent account of their own — PRD §33's Parent Dashboard, scoped down
    from a full parent-login/role system (see README 'Parent Dashboard')."""

    __tablename__ = "ParentAccessToken"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    token = Column(String, nullable=False, unique=True)
    label = Column(String, nullable=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.utcnow)
    revokedAt = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="parent_access_tokens")
