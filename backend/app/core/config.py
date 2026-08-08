from pydantic_settings import BaseSettings
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Aegis"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    DATABASE_URL: str = "postgresql://aegis:aegis@db:5432/aegis"
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    JWT_SECRET: str = "supersecret"
    TELEGRAM_BOT_TOKEN: str = ""
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = ""
    RESEND_API_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

if settings.JWT_SECRET == "supersecret":
    logger.warning("SECURITY: JWT_SECRET is using the default weak value. Set a strong secret in .env for any non-local deployment.")
