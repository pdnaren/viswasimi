from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class Question(Base):
    __tablename__ = "Question"

    id = Column(String, primary_key=True)
    topicId = Column(String, ForeignKey("Topic.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    prompt = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)
    correctIndex = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.utcnow)

    topic = relationship("Topic", back_populates="questions")
    attempts = relationship("AssessmentQuestion", back_populates="question", cascade="all, delete-orphan")


class Assessment(Base):
    __tablename__ = "Assessment"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    type = Column(String, nullable=False)  # TOPIC_QUIZ | CHAPTER_TEST
    topicId = Column(String, ForeignKey("Topic.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True)
    chapterId = Column(String, ForeignKey("Chapter.id", ondelete="SET NULL", onupdate="CASCADE"), nullable=True)
    status = Column(String, nullable=False, default="IN_PROGRESS")  # IN_PROGRESS | COMPLETED
    score = Column(Float, nullable=True)
    totalQuestions = Column(Integer, nullable=False, default=0)
    startedAt = Column(DateTime, nullable=False, default=datetime.utcnow)
    completedAt = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="assessments")
    topic = relationship("Topic")
    chapter = relationship("Chapter")
    items = relationship(
        "AssessmentQuestion", back_populates="assessment",
        cascade="all, delete-orphan", order_by="AssessmentQuestion.order",
    )


class AssessmentQuestion(Base):
    __tablename__ = "AssessmentQuestion"

    id = Column(String, primary_key=True)
    assessmentId = Column(String, ForeignKey("Assessment.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    questionId = Column(String, ForeignKey("Question.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    order = Column(Integer, nullable=False, default=0)
    selectedIndex = Column(Integer, nullable=True)
    isCorrect = Column(Boolean, nullable=True)
    answeredAt = Column(DateTime, nullable=True)

    assessment = relationship("Assessment", back_populates="items")
    question = relationship("Question", back_populates="attempts")


MISTAKE_CATEGORIES = [
    "SIGN_ERROR",
    "FORMULA_SELECTION",
    "UNIT_CONVERSION",
    "CALCULATION_ERROR",
    "CONCEPT_MISUNDERSTANDING",
    "OTHER",
]


class Mistake(Base):
    __tablename__ = "Mistake"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    topicId = Column(String, ForeignKey("Topic.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    assessmentQuestionId = Column(
        String, ForeignKey("AssessmentQuestion.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False,
    )
    category = Column(String, nullable=False, default="OTHER")
    createdAt = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="mistakes")
    topic = relationship("Topic")
    assessment_question = relationship("AssessmentQuestion")
