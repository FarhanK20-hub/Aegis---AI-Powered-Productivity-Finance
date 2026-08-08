from datetime import datetime
from sqlalchemy import String, JSON, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class NotificationEvent(Base):
    __tablename__ = "notification_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    type: Mapped[str] = mapped_column(String(50))  # e.g., 'task_reminder', 'calendar_reminder'
    payload: Mapped[dict] = mapped_column(JSON)    # { "title": "...", "body": "..." }
    delivered_channels: Mapped[list] = mapped_column(JSON) # e.g., ["email", "telegram"]
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="notifications")
