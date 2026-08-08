import enum
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Text, Enum, ForeignKey, Integer, DateTime, Date, func, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class HabitFrequency(str, enum.Enum):
    Daily = "Daily"
    Weekly = "Weekly"

class Habit(Base):
    """A recurring growth activity (e.g. LeetCode, AI course, LinkedIn posts)."""
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # How often and how much
    frequency: Mapped[HabitFrequency] = mapped_column(Enum(HabitFrequency), default=HabitFrequency.Daily)
    target_per_period: Mapped[int] = mapped_column(Integer, default=1)  # e.g. 2 problems/day
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "problems", "chapters", "minutes"
    
    # Progress tracking
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    total_sessions: Mapped[int] = mapped_column(Integer, default=0)
    
    # For course-type habits: % progress
    total_progress_percent: Mapped[float] = mapped_column(Float, default=0.0)
    total_units_target: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # e.g. total chapters
    
    last_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")


class HabitLog(Base):
    """A single completion/progress entry for a habit."""
    __tablename__ = "habit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    value: Mapped[float] = mapped_column(Float, default=1.0)  # e.g. 2.0 (problems solved)
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    log_date: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    
    habit = relationship("Habit", back_populates="logs")
