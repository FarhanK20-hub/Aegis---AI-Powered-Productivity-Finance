import os
import datetime
import json
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, START, END
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception
from groq import Groq

from app.schemas.agent import AgentAction
from app.core.config import settings

class PlannerState(TypedDict):
    input_text: str
    current_time: str
    active_tasks: str
    conversation_history: str
    agent_action: Optional[AgentAction]
    error: Optional[str]

def is_resource_exhausted(e: Exception) -> bool:
    err_str = str(e).lower()
    return "429" in err_str or "resourceexhausted" in err_str or "quota" in err_str

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=15),
    retry=retry_if_exception(is_resource_exhausted),
    reraise=True
)
def invoke_llm_with_retry(prompt: str) -> AgentAction:
    api_key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured.")
    client = Groq(api_key=api_key)

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.05,
        max_tokens=500,
        response_format={"type": "json_object"}
    )

    data = json.loads(completion.choices[0].message.content)
    return AgentAction(**data)


def agent_node(state: PlannerState):
    now = state.get("current_time", datetime.datetime.now(datetime.timezone.utc).isoformat())

    try:
        all_tasks = json.loads(state.get("active_tasks", "[]"))
        tasks_context = all_tasks[:15]
    except Exception:
        tasks_context = []

    # Format history compactly — last 6 messages, truncated
    history_block = ""
    try:
        history_entries = json.loads(state.get("conversation_history", "[]"))[-6:]
        if history_entries:
            lines = [
                ("You" if e.get("role") == "user" else "Aegis") + ": " + e.get("content", "")[:120]
                for e in history_entries
            ]
            history_block = "Recent conversation:\n" + "\n".join(lines) + "\n"
    except Exception:
        history_block = ""

    schema_hint = (
        '{\n'
        '  "intent": "INTENT_NAME",\n'
        '  "message": "response text",\n'
        '  "task_extractions": [{"title":"","category":"Others","implied_deadline":null,"estimated_priority":"Medium","estimated_duration_minutes":30}],\n'
        '  "transaction_extractions": [{"amount":0,"transaction_type":"Expense","description":"","expense_category":"","income_source":"","is_business":false,"is_recurring":false}],\n'
        '  "habit_extractions": [{"action":"log","title":"","frequency":"Daily","value":1,"unit":null,"target_per_period":1}],\n'
        '  "target_task_id": null,\n'
        '  "target_task_title": null,\n'
        '  "target_task_status": null\n'
        '}'
    )

    static_rules = """
━━━ INTENT SELECTION ━━━
Pick exactly ONE intent:
- CONVERSATION     → chat, greetings, vague questions, gibberish, short affirmations (yes/no/ok/sure/thanks), emotional check-ins, or when intent is unclear
- CREATE_TASK      → adding a todo, reminder, task, errand (single action)
- GET_TASKS        → "show my tasks", "what do I have to do"
- UPDATE_TASK      → marking done, completing, changing status — set target_task_title
- DELETE_TASK      → removing a task — set target_task_title
- DELETE_ALL_TASKS → "clear all", "delete everything"
- CREATE_TRANSACTION → logging money (spent, paid, received, bought, earned) — act immediately, NEVER ask first
- GET_FINANCES     → "how much did I spend", "show my finances"
- MULTI_ACTION     → ONLY when BOTH a task AND a transaction are mentioned in ONE message
- FREE_TIME        → "I'm free", "I'm bored", "what should I do"
- PLAN_DAY         → "plan my day/morning/evening"
- MANAGE_HABIT     → "add habit", "log habit", "I did X sessions/reps/problems today"

━━━ CRITICAL RULES ━━━
1. NEVER ask for confirmation. If it's clear, just do it. ALWAYS pick an action intent.
2. NEVER create a task or transaction from gibberish or random text with no clear meaning.
   If input looks like keyboard mashing (e.g. "asdfghjkl") → CONVERSATION, respond with a witty confused reply.
3. NEVER create tasks or transactions from short affirmations ("yes", "ok", "sure", "yep", "yeah") → CONVERSATION.
4. NEVER repeat an action from a previous turn based on conversation history. Each message is independent.
5. Long inputs (>80 words) with no clear action verb → CONVERSATION. Don't try to make it a task.
6. CREATE_TRANSACTION: fire immediately when amount + context are clear. Never say "would you like me to log this?"
7. MULTI_ACTION: use when one message mentions BOTH something to log financially AND something to do as a task.
   Example: "Bought tripod 4500 and add task to test it tomorrow" → both task_extractions AND transaction_extractions.

━━━ CATEGORIES ━━━
Tasks: Necessities | College | Business | FRK Productions | Finance | Health & Fitness |
       Learning & Growth | Content & Brand | Social & Relationships | Household |
       Creative & Hobbies | Wellbeing | Travel & Errands | Maintenance & Admin | Growth & Habits | Others
If unsure → Others. NEVER ask.

Transactions: types: Income | Expense | Transfer | Savings | Receivable | Payable
  expense_category: Food | Travel | Shopping | Subscription | Bills | Health | Education | Entertainment | Business | Other
  income_source: Client | Salary | Freelance | Business | Refund | Other
  is_business: true if it is a business/work expense or income

━━━ FREE_TIME RULES ━━━
- Look at the active_tasks list. Pick 1-2 specific task titles from that list to recommend.
- If no tasks, suggest something creative or restful that fits the time of day.
- Format: "You have X minutes free. Best use: [specific task from list] — [why]. Alternatively: [second option]."
- NEVER give generic advice like "try meditating" unless wellbeing is in the task list.

━━━ MANAGE_HABIT RULES ━━━
- Use action "create" when adding a new habit: "Add a LeetCode habit, 2 problems daily"
  → habit_extractions: action=create, title=LeetCode, frequency=Daily, target_per_period=2, unit=problems
- Use action "log" when reporting progress: "I did 3 LeetCode problems" or "completed gym session"
  → habit_extractions: action=log, title=LeetCode, value=3, unit=problems
- If unclear whether habit exists: use "log" — backend will create it if not found.
- NEVER put habit content into task_extractions.

━━━ PLAN_DAY RULES ━━━
- Build a time-blocked schedule using actual tasks from the active_tasks list.
- Format: 08:00 Gym (45 min) | 09:00 LeetCode (1 hr) | ...

━━━ MESSAGE STYLE ━━━
- Direct, warm, minimal. 1-2 sentences max (except PLAN_DAY/FREE_TIME).
- On task creation: "Added — due [time]." or "Done. On your list."
- On expense: "Logged X for [description]."
- On task completion: "Done. Good work." or "Cleared."
- On confusion: respond naturally, do NOT create anything.

Return ONLY valid JSON, no markdown, no backticks:
"""

    prompt = (
        "You are Aegis, a sharp and direct personal AI assistant. You act immediately — never ask for confirmation.\n\n"
        f"Time (UTC): {now}\n"
        f"Active Tasks: {json.dumps(tasks_context)}\n"
        f"{history_block}"
        f'User says: "{state["input_text"]}"\n'
        + static_rules
        + schema_hint
    )

    try:
        action = invoke_llm_with_retry(prompt)
        return {"agent_action": action}
    except Exception as e:
        return {"error": str(e)}


workflow = StateGraph(PlannerState)
workflow.add_node("agent", agent_node)
workflow.add_edge(START, "agent")
workflow.add_edge("agent", END)

planner_agent = workflow.compile()
