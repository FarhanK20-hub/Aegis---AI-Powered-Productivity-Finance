import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Enum, ForeignKey, Integer, DateTime, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class TaskPriority(str, enum.Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"
    Urgent = "Urgent"

class TaskStatus(str, enum.Enum):
    Todo = "Todo"
    InProgress = "In Progress"
    Done = "Done"

class TaskSource(str, enum.Enum):
    Manual = "manual"
    Email = "email"
    Chat = "chat"
    PDF = "pdf"
    Calendar = "calendar"
    Voice = "voice"

class TaskCategory(str, enum.Enum):
    Necessities = "Necessities"
    College = "College"
    Business = "Business"
    FRKProductions = "FRK Productions"
    Finance = "Finance"
    Health = "Health & Fitness"
    Learning = "Learning & Growth"
    Content = "Content & Brand"
    Social = "Social & Relationships"
    Household = "Household"
    Creative = "Creative & Hobbies"
    Wellbeing = "Wellbeing"
    Travel = "Travel & Errands"
    Maintenance = "Maintenance & Admin"
    Growth = "Growth & Habits"
    Others = "Others"
    Uncategorized = "Uncategorized"  # kept for backwards compatibility

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[Optional[int]] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority), default=TaskPriority.Medium)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.Todo)
    category: Mapped[TaskCategory] = mapped_column(Enum(TaskCategory), default=TaskCategory.Uncategorized)
    
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    scheduled_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    source: Mapped[TaskSource] = mapped_column(Enum(TaskSource), default=TaskSource.Manual)
    reminded: Mapped[bool] = mapped_column(Boolean, default=False)
    is_proposed: Mapped[bool] = mapped_column(Boolean, default=False)
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="tasks")
    document = relationship("Document", back_populates="tasks")
