from fastapi import APIRouter, Depends, Request, Response, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.core.config import settings
from app.services.notification import process_whatsapp_message

router = APIRouter()

@router.get("/webhook")
async def verify_webhook(request: Request):
    """
    Meta (WhatsApp) Webhook verification endpoint.
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode and token:
        if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
            return Response(content=challenge, media_type="text/plain")
        else:
            raise HTTPException(status_code=403, detail="Forbidden")
    return Response(status_code=400)

@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives incoming WhatsApp messages.
    """
    data = await request.json()
    
    if data.get("object") == "whatsapp_business_account":
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                messages = value.get("messages", [])
                
                for message in messages:
                    if message.get("type") == "text":
                        phone_number = message.get("from")
                        text = message.get("text", {}).get("body", "")
                        
                        # Process the message and open the 24-hour window
                        process_whatsapp_message(db, phone_number, text)
                        
        return Response(status_code=200)
    else:
        return Response(status_code=404)
