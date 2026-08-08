from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.api.deps import get_db
from app.models.user import User
from app.models.notification import NotificationEvent

router = APIRouter()

# Schema for settings
class NotificationSettings(BaseModel):
    notify_email: bool
    notify_web_push: bool
    notify_telegram: bool
    telegram_chat_id: Optional[str] = None
    notify_whatsapp: bool
    whatsapp_phone_number: Optional[str] = None

class WebPushSubscription(BaseModel):
    endpoint: str
    keys: dict

# Mock auth dependency - using user_id=1 for now
def get_current_user_id() -> int:
    return 1

@router.get("/settings", response_model=NotificationSettings)
def get_settings(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "notify_email": user.notify_email,
        "notify_web_push": user.notify_web_push,
        "notify_telegram": user.notify_telegram,
        "telegram_chat_id": user.telegram_chat_id,
        "notify_whatsapp": user.notify_whatsapp,
        "whatsapp_phone_number": user.whatsapp_phone_number
    }

@router.put("/settings")
def update_settings(settings: NotificationSettings, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.notify_email = settings.notify_email
    user.notify_web_push = settings.notify_web_push
    user.notify_telegram = settings.notify_telegram
    if settings.telegram_chat_id is not None:
        user.telegram_chat_id = settings.telegram_chat_id
    user.notify_whatsapp = settings.notify_whatsapp
    if settings.whatsapp_phone_number is not None:
        user.whatsapp_phone_number = settings.whatsapp_phone_number
        
    db.commit()
    return {"status": "success"}

@router.post("/subscribe")
def subscribe_web_push(subscription: WebPushSubscription, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.web_push_subscription = subscription.dict()
    db.commit()
    return {"status": "success"}

@router.get("/history")
def get_history(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    events = db.query(NotificationEvent).filter(NotificationEvent.user_id == user_id).order_by(NotificationEvent.created_at.desc()).limit(20).all()
    return events
