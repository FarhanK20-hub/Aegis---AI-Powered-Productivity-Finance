import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Enum, ForeignKey, DateTime, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class EventSource(str, enum.Enum):
    Manual = "manual"
    AIScheduled = "ai_scheduled"
    Google = "google"

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    title: Mapped[str] = mapped_column(String(255))
    start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    
    source: Mapped[EventSource] = mapped_column(Enum(EventSource), default=EventSource.Manual)
    reminded: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
