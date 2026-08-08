from datetime import datetime
from sqlalchemy import String, JSON, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    
    # Notification Settings
    web_push_subscription: Mapped[dict] = mapped_column(JSON, nullable=True)
    telegram_chat_id: Mapped[str] = mapped_column(String(50), nullable=True)
    whatsapp_phone_number: Mapped[str] = mapped_column(String(20), nullable=True)
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_web_push: Mapped[bool] = mapped_column(Boolean, default=False)
    notify_telegram: Mapped[bool] = mapped_column(Boolean, default=False)
    notify_whatsapp: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("NotificationEvent", back_populates="user", cascade="all, delete-orphan")
