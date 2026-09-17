from sqlalchemy import Column, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from app.db.base import Base


class Subject(Base):
    __tablename__ = "Subject"
    __table_args__ = (UniqueConstraint("grade", "name", name="Subject_grade_name_key"),)

    id = Column(String, primary_key=True)
    grade = Column(String, nullable=False)
    name = Column(String, nullable=False)

    chapters = relationship("Chapter", back_populates="subject", cascade="all, delete-orphan")


class Chapter(Base):
    __tablename__ = "Chapter"
    __table_args__ = (UniqueConstraint("subjectId", "order", name="Chapter_subjectId_order_key"),)

    id = Column(String, primary_key=True)
    subjectId = Column(String, ForeignKey("Subject.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    order = Column(Integer, nullable=False)

    subject = relationship("Subject", back_populates="chapters")
    topics = relationship("Topic", back_populates="chapter", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "Topic"
    __table_args__ = (
        UniqueConstraint("chapterId", "order", name="Topic_chapterId_order_key"),
        Index("Topic_chapterId_idx", "chapterId"),
    )

    id = Column(String, primary_key=True)
    chapterId = Column(String, ForeignKey("Chapter.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    order = Column(Integer, nullable=False)
    durationM = Column(Integer, nullable=False)
    prereqIds = Column(ARRAY(String), nullable=False, default=list)
    contentRef = Column(String, nullable=True)

    chapter = relationship("Chapter", back_populates="topics")
    progress_events = relationship("Progress", back_populates="topic")
    masteries = relationship("Mastery", back_populates="topic")
    plan_items = relationship("PlanItem", back_populates="topic")
    tutor_sessions = relationship("TutorSession", back_populates="topic")
    questions = relationship("Question", back_populates="topic", cascade="all, delete-orphan")