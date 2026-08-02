from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class SubscriptionPlan(Base):
    __tablename__ = "SubscriptionPlan"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    price = Column(Integer, nullable=True)
    isActive = Column(Boolean, nullable=False, default=True)

    subscriptions = relationship("UserSubscription", back_populates="plan")


class UserSubscription(Base):
    __tablename__ = "UserSubscription"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    planId = Column(String, ForeignKey("SubscriptionPlan.id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)
    startsAt = Column(DateTime, nullable=False, default=datetime.utcnow)
    endsAt = Column(DateTime, nullable=True)
    isActive = Column(Boolean, nullable=False, default=True)

    user = relationship("User", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")