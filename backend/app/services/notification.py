import json
import logging
import requests
import resend
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.core.config import settings
from app.models.user import User
from app.models.notification import NotificationEvent

logger = logging.getLogger(__name__)

if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

def send_web_push(subscription_info: dict, payload_data: dict) -> bool:
    if not settings.VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not set. Cannot send web push.")
        return False
        
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload_data),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={
                "sub": "mailto:admin@aegis.local"
            }
        )
        return True
    except WebPushException as ex:
        logger.error(f"Web push failed: {repr(ex)}")
        if ex.response and ex.response.json():
            logger.error(ex.response.json())
        return False
    except Exception as e:
        logger.error(f"Web push error: {e}")
        return False

def send_email(to_email: str, subject: str, body: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set. Mock sending email to {to_email}: {subject}")
        return True
        
    try:
        response = resend.Emails.send({
            "from": "Acme <onboarding@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "html": body
        })
        logger.info(f"Email sent: {response}")
        return True
    except Exception as e:
        logger.error(f"Email sending failed: {e}")
        return False

def send_telegram(chat_id: str, text: str) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning(f"TELEGRAM_BOT_TOKEN not set. Mock sending telegram to {chat_id}: {text}")
        return True
        
    try:
        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
        resp = requests.post(url, json={"chat_id": chat_id, "text": text})
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Telegram sending failed: {e}")
        return False

def send_whatsapp(phone_number: str, text: str) -> bool:
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_ID:
        logger.warning(f"WhatsApp env not set. Mock sending WhatsApp to {phone_number}: {text}")
        return True
        
    try:
        url = f"https://graph.facebook.com/v19.0/{settings.WHATSAPP_PHONE_ID}/messages"
        headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
            "Content-Type": "application/json"
        }
        data = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "text",
            "text": {"body": text}
        }
        resp = requests.post(url, headers=headers, json=data)
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"WhatsApp sending failed: {e}")
        if isinstance(e, requests.exceptions.HTTPError):
            logger.error(e.response.text)
        return False

def dispatch_notification(db: Session, user_id: int, notification_type: str, title: str, body: str) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.error(f"Cannot dispatch notification, user {user_id} not found.")
        return
        
    delivered_channels = []
    
    # 1. Web Push
    if user.notify_web_push and user.web_push_subscription:
        payload = {"title": title, "body": body}
        if send_web_push(user.web_push_subscription, payload):
            delivered_channels.append("web_push")
            
    # 2. Telegram
    if user.notify_telegram and user.telegram_chat_id:
        text = f"*{title}*\n{body}"
        if send_telegram(user.telegram_chat_id, text):
            delivered_channels.append("telegram")
            
    # 3. Email
    if user.notify_email and user.email:
        html_body = f"<h2>{title}</h2><p>{body}</p>"
        if send_email(user.email, title, html_body):
            delivered_channels.append("email")
            
    # 4. WhatsApp
    if user.notify_whatsapp and user.whatsapp_phone_number:
        # Check 24-hour window
        if user.whatsapp_window_start and datetime.now(timezone.utc) - user.whatsapp_window_start < timedelta(hours=24):
            text = f"*{title}*\n{body}"
            if send_whatsapp(user.whatsapp_phone_number, text):
                delivered_channels.append("whatsapp")
        else:
            logger.info(f"WhatsApp window closed for user {user.id}. Notification queued.")
            
    # Log NotificationEvent
    event = NotificationEvent(
        user_id=user.id,
        type=notification_type,
        payload={"title": title, "body": body},
        delivered_channels=delivered_channels
    )
    db.add(event)
    db.commit()
    logger.info(f"Dispatched notification to user {user_id} on channels: {delivered_channels}")

def process_whatsapp_message(db: Session, phone_number: str, text: str) -> None:
    """Handles an incoming message, opens the 24-hour window, and flushes queued notifications."""
    user = db.query(User).filter(User.whatsapp_phone_number == phone_number).first()
    if not user:
        logger.warning(f"Received WhatsApp message from unknown number {phone_number}")
        return
        
    # Open the 24-hour window
    now = datetime.now(timezone.utc)
    user.whatsapp_window_start = now
    
    # Send a quick acknowledgment
    response_text = f"Hello! You've successfully opened the 24-hour free message window.\n\n"
    
    # Find pending WhatsApp notifications (ones not delivered via WhatsApp)
    pending_events = db.query(NotificationEvent).filter(
        NotificationEvent.user_id == user.id,
        ~NotificationEvent.delivered_channels.contains(["whatsapp"]) # using jsonb contains or just array contains
    ).order_by(NotificationEvent.created_at.desc()).limit(10).all()
    
    # PostgreSQL JSON filtering is tricky with contains, let's filter in Python for safety if it's small, 
    # or just assume any recent one without 'whatsapp' in the list.
    queued = []
    for event in pending_events:
        if "whatsapp" not in event.delivered_channels:
            queued.append(event)
            
    if queued:
        response_text += "*Here are your pending notifications:*\n"
        for idx, event in enumerate(reversed(queued)):
            title = event.payload.get("title", "")
            body = event.payload.get("body", "")
            response_text += f"\n- *{title}*: {body}"
            # Mark as delivered
            channels = list(event.delivered_channels)
            channels.append("whatsapp")
            event.delivered_channels = channels
    else:
        response_text += "You have no pending notifications."
        
    send_whatsapp(phone_number, response_text)
    db.commit()
    logger.info(f"Processed WhatsApp message from user {user.id} and flushed {len(queued)} queued items.")

