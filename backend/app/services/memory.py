import os
from urllib.parse import urlparse
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class MemoryService:
    def __init__(self):
        self._available = False
        try:
            from mem0 import Memory
            db_url = settings.DATABASE_URL
            parsed = urlparse(db_url)
            
            api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
            if not api_key:
                logger.warning("GEMINI_API_KEY not set. Memory service will be disabled.")
                return
            
            config = {
                "vector_store": {
                    "provider": "pgvector",
                    "config": {
                        "dbname": parsed.path.lstrip("/"),
                        "user": parsed.username,
                        "password": parsed.password,
                        "host": parsed.hostname,
                        "port": parsed.port or 5432,
                        "collection_name": "memories"
                    }
                },
                "llm": {
                    "provider": "gemini",
                    "config": {"api_key": api_key}
                },
                "embedder": {
                    "provider": "gemini",
                    "config": {"api_key": api_key}
                }
            }
            
            self.memory = Memory.from_config(config)
            self._available = True
            logger.info("Memory service initialized successfully.")
        except Exception as e:
            logger.warning(f"Memory service failed to initialize (will be disabled): {e}")
    
    def store(self, content: str, user_id: str, metadata: dict = None):
        if not self._available:
            return {"status": "skipped", "reason": "memory_service not available"}
        try:
            return self.memory.add(content, user_id=user_id, metadata=metadata)
        except Exception as e:
            logger.error(f"Memory store failed: {e}")
            return None
        
    def search(self, query: str, user_id: str):
        if not self._available:
            return []
        try:
            return self.memory.search(query, filters={"user_id": user_id})
        except Exception as e:
            logger.error(f"Memory search failed: {e}")
            return []
            
memory_service = MemoryService()
