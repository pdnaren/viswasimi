from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class Session(Base):
    __tablename__ = "Session"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    token = Column(String, nullable=False, unique=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.utcnow)
    expiresAt = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "PasswordResetToken"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    token = Column(String, nullable=False, unique=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.utcnow)
    expiresAt = Column(DateTime, nullable=False)
    usedAt = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="password_reset_tokens")