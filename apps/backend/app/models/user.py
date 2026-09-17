from datetime import datetime
from sqlalchemy import Column, DateTime, Index, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "User"
    __table_args__ = (Index("User_grade_idx", "grade"),)

    id = Column(String, primary_key=True)
    role = Column(String, nullable=False, default="STUDENT")
    grade = Column(String, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    # Nullable because Google-signed-up accounts have no password until the
    # user sets one via the forgot-password flow.
    passwordHash = Column(String, nullable=True)
    googleId = Column(String, nullable=True, unique=True)
    locale = Column(String, nullable=False, default="en-IN")
    timezone = Column(String, nullable=False, default="Asia/Kolkata")
    createdAt = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    study_plans = relationship("StudyPlan", back_populates="user", cascade="all, delete-orphan")
    progress_events = relationship("Progress", back_populates="user", cascade="all, delete-orphan")
    masteries = relationship("Mastery", back_populates="user", cascade="all, delete-orphan")
    tutor_sessions = relationship("TutorSession", back_populates="user", cascade="all, delete-orphan")
    voice_quotas = relationship("VoiceQuota", back_populates="user", cascade="all, delete-orphan")
    daily_progress = relationship("DailyProgress", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("UserSubscription", back_populates="user", cascade="all, delete-orphan")
    assessments = relationship("Assessment", back_populates="user", cascade="all, delete-orphan")