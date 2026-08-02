from datetime import datetime
import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class StudyPlan(Base):
    __tablename__ = "StudyPlan"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    active = Column(Boolean, nullable=False, default=True)

    user = relationship("User", back_populates="study_plans")
    items = relationship("PlanItem", back_populates="plan", cascade="all, delete-orphan")


class PlanItem(Base):
    __tablename__ = "PlanItem"

    id = Column(String, primary_key=True)
    planId = Column(String, ForeignKey("StudyPlan.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    topicId = Column(String, ForeignKey("Topic.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    startsAt = Column(DateTime, nullable=False)
    endsAt = Column(DateTime, nullable=False)
    state = Column(String, nullable=False, default="SCHEDULED")
    targetMastery = Column(Integer, nullable=False, default=3)

    plan = relationship("StudyPlan", back_populates="items")
    topic = relationship("Topic", back_populates="plan_items")


class TutorSession(Base):
    __tablename__ = "TutorSession"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    mode = Column(String, nullable=False)
    topicId = Column(String, ForeignKey("Topic.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True)
    startedAt = Column(DateTime, nullable=False, default=datetime.utcnow)
    endedAt = Column(DateTime, nullable=True)
    costCents = Column(Integer, nullable=False, default=0)
    sttSec = Column(Integer, nullable=False, default=0)
    ttsChars = Column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="tutor_sessions")
    topic = relationship("Topic", back_populates="tutor_sessions")


class VoiceQuota(Base):
    __tablename__ = "VoiceQuota"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    date = Column(DateTime, nullable=False)
    sttSec = Column(Integer, nullable=False, default=0)
    ttsChars = Column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="voice_quotas")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = Column("user_id", String, ForeignKey("User.id", ondelete="CASCADE"), index=True, nullable=False)
    topicId = Column("topic_id", String, index=True, nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    createdAt = Column("created_at", DateTime(timezone=True), default=datetime.utcnow)