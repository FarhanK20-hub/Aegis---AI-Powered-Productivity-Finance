import os
import json
import time
import logging
import threading
from groq import Groq
from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are Aegis AI. Analyze user tasks and finances. "
    "Return ONE short, actionable sentence of insight or advice. "
    "Be direct. No pleasantries. "
    "Return JSON: {\"insight\": \"your sentence here\"}"
)

# ---------------------------------------------------------------------------
# Simple in-memory cache: insight cached for 2 minutes per user
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[str, float]] = {}  # user_key -> (insight, timestamp)
_cache_lock = threading.Lock()
CACHE_TTL = 120  # seconds


class DashboardAgent:
    def __init__(self):
        self.model_name = "llama-3.1-8b-instant"

    def _get_cached(self, cache_key: str) -> str | None:
        with _cache_lock:
            entry = _cache.get(cache_key)
            if entry and time.time() - entry[1] < CACHE_TTL:
                return entry[0]
        return None

    def _set_cached(self, cache_key: str, insight: str) -> None:
        with _cache_lock:
            _cache[cache_key] = (insight, time.time())

    def invoke(self, state: dict) -> dict:
        try:
            # Build compact cache key from task count + finance totals
            tasks = json.loads(state.get("active_tasks", "[]"))
            finances = json.loads(state.get("finances_summary", "{}"))
            task_count = len(tasks)
            expense_total = round(finances.get("monthly_expenses", 0))
            overdue_count = sum(1 for t in tasks if t.get("due_date") and t.get("due_date", "") < state.get("current_time", ""))
            cache_key = f"{task_count}:{expense_total}:{overdue_count}"

            cached = self._get_cached(cache_key)
            if cached:
                logger.debug("Dashboard insight served from cache.")
                return {"insight": cached, "error": None}

            api_key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
            if not api_key:
                return {"insight": None, "error": "GROQ_API_KEY not set"}

            client = Groq(api_key=api_key)

            # Send a minimal context — only what's needed for a one-sentence insight
            compact = {
                "time": state.get("current_time", "")[:16],
                "tasks": task_count,
                "overdue": overdue_count,
                "top_tasks": [t.get("title", "") for t in tasks[:5]],
                "income": finances.get("monthly_income", 0),
                "expenses": finances.get("monthly_expenses", 0),
                "payables": finances.get("payables", 0),
            }

            response = client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(compact)}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=80,   # one sentence = ~20 tokens, 80 is generous
            )

            parsed = json.loads(response.choices[0].message.content)
            insight = parsed.get("insight", "")
            self._set_cached(cache_key, insight)
            return {"insight": insight, "error": None}

        except Exception as e:
            logger.error(f"Dashboard insight error: {e}")
            return {"insight": None, "error": str(e)}


dashboard_agent = DashboardAgent()
