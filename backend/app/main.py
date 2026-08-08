from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from contextlib import asynccontextmanager
import logging
import time

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate Limiting (lightweight, no extra dependencies)
# In-memory per-IP sliding window: 60 req/min for planner, 300 req/min global
# ---------------------------------------------------------------------------

from collections import defaultdict, deque
import threading

_rate_lock = threading.Lock()
_request_log: dict[str, deque] = defaultdict(deque)

RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMITS: dict[str, int] = {
    "/agents/planner/parse": 30,   # 30 LLM calls/min max (expensive endpoint)
    "/agents/dashboard": 20,        # 20 dashboard refreshes/min
    "default": 120,                 # 120 req/min for everything else
}

def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def _is_rate_limited(ip: str, path: str) -> bool:
    now = time.time()
    # Find which limit applies
    limit = RATE_LIMITS["default"]
    for prefix, lim in RATE_LIMITS.items():
        if prefix != "default" and path.startswith(prefix):
            limit = lim
            break

    key = f"{ip}:{path}"
    with _rate_lock:
        dq = _request_log[key]
        # Remove entries older than window
        while dq and now - dq[0] > RATE_LIMIT_WINDOW:
            dq.popleft()
        if len(dq) >= limit:
            return True
        dq.append(now)
    return False


# ---------------------------------------------------------------------------
# CORS helpers
# ---------------------------------------------------------------------------

def _get_allowed_origins() -> list[str]:
    raw = settings.ALLOWED_ORIGINS
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    # Always include localhost variants for development
    dev_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ]
    all_origins = list(dict.fromkeys(origins + dev_origins))  # deduplicate, preserve order
    return all_origins


# ---------------------------------------------------------------------------
# App + Lifespan
# ---------------------------------------------------------------------------

from app.api.endpoints import agents, notifications
from app.core.scheduler import scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Aegis starting up...")
    scheduler.start()
    yield
    logger.info("Aegis shutting down...")
    scheduler.shutdown()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
allowed_origins = _get_allowed_origins()
logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
    max_age=600,
)

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    ip = _get_client_ip(request)
    path = request.url.path

    # Skip rate limiting for health checks and static assets
    if path in ("/health", "/favicon.ico", "/docs", "/redoc", "/openapi.json"):
        return await call_next(request)

    if _is_rate_limited(ip, path):
        logger.warning(f"Rate limit exceeded for {ip} on {path}")
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please slow down."},
            headers={"Retry-After": str(RATE_LIMIT_WINDOW)}
        )
    return await call_next(request)

# Request timing middleware
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    response.headers["X-Response-Time"] = f"{duration:.1f}ms"
    return response


# ---------------------------------------------------------------------------
# Health + Memory endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME}

from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.memory import memory_service

class MemoryStoreRequest(BaseModel):
    content: str
    user_id: str
    metadata: Optional[Dict[str, Any]] = None

@app.post("/memory")
def store_memory(req: MemoryStoreRequest):
    try:
        result = memory_service.store(req.content, req.user_id, req.metadata)
        return {"status": "success", "result": result}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memory/search")
def search_memory(q: str, user_id: str):
    try:
        results = memory_service.search(q, user_id=user_id)
        return {"status": "success", "results": results}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

from app.api.endpoints import agents, whatsapp, documents, tasks, habits
app.include_router(agents.router, prefix="/agents", tags=["Agents"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
app.include_router(whatsapp.router, prefix="/notifications/whatsapp", tags=["WhatsApp"])
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
app.include_router(habits.router, prefix="/habits", tags=["Habits"])
