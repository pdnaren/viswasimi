from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base


class Progress(Base):
    __tablename__ = "Progress"
    __table_args__ = (
        Index("Progress_userId_ts_idx", "userId", "ts"),
        Index("Progress_topicId_idx", "topicId"),
    )

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    topicId = Column(String, ForeignKey("Topic.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    event = Column(String, nullable=False)
    score = Column(Float, nullable=True)
    seconds = Column(Integer, nullable=False, default=0)
    ts = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="progress_events")
    topic = relationship("Topic", back_populates="progress_events")


class Mastery(Base):
    __tablename__ = "Mastery"
    __table_args__ = (
        UniqueConstraint("userId", "topicId", name="Mastery_userId_topicId_key"),
        Index("Mastery_nextReviewAt_idx", "nextReviewAt"),
    )

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    topicId = Column(String, ForeignKey("Topic.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    value = Column(Integer, nullable=False, default=0)
    nextReviewAt = Column(DateTime, nullable=True)
    ef = Column(Float, nullable=False, default=2.5)
    streak = Column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="masteries")
    topic = relationship("Topic", back_populates="masteries")


class DailyProgress(Base):
    __tablename__ = "DailyProgress"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    date = Column(DateTime, nullable=False)
    topicsCompleted = Column(Integer, nullable=False, default=0)
    minutes = Column(Integer, nullable=False, default=0)
    streak = Column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="daily_progress")