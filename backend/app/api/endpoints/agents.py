from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import datetime
import json
import difflib

from app.api.deps import get_db
from app.schemas.agent import TaskParseRequest, IntentType
from app.agents.planner import planner_agent
from app.agents.dashboard import dashboard_agent
from app.services.task import create_task_from_extraction, get_user_tasks
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.finance import Transaction, TransactionType
from app.models.habit import Habit, HabitLog, HabitFrequency

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_aware(dt: datetime.datetime) -> datetime.datetime:
    """Ensure a datetime is timezone-aware (UTC). Returns None if input is None."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt

def _fuzzy_find_task(db: Session, user_id: int, title: str) -> Task | None:
    """Find a task by fuzzy title match when no ID is available."""
    tasks = get_user_tasks(db, user_id)
    if not tasks:
        return None
    task_titles = [t.title for t in tasks]
    matches = difflib.get_close_matches(title, task_titles, n=1, cutoff=0.4)
    if matches:
        return next((t for t in tasks if t.title == matches[0]), None)
    # Fallback: substring match
    title_lower = title.lower()
    for t in tasks:
        if title_lower in t.title.lower() or t.title.lower() in title_lower:
            return t
    return None


# ---------------------------------------------------------------------------
# POST /agents/planner/parse
# ---------------------------------------------------------------------------

@router.post("/planner/parse")
def parse_task(request: TaskParseRequest, db: Session = Depends(get_db)):
    from app.models.conversation import Conversation, Message

    active_tasks = get_user_tasks(db, request.user_id)
    active_tasks_context = [
        {
            "id": t.id,
            "title": t.title,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "priority": t.priority.value,
            "category": t.category.value if t.category else None,
            "description": t.description,
            "status": t.status.value
        }
        for t in active_tasks
    ]

    # --- CONVERSATION HISTORY ---
    # Auto-create or reuse a conversation for this user
    conv_id = request.conversation_id
    if not conv_id:
        # Use the most recent conversation for this user, or create one
        conv = db.query(Conversation).filter(
            Conversation.user_id == request.user_id
        ).order_by(Conversation.created_at.desc()).first()
        if not conv:
            conv = Conversation(user_id=request.user_id, title="Main")
            db.add(conv)
            db.commit()
            db.refresh(conv)
        conv_id = conv.id
    else:
        conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
        if not conv:
            conv = Conversation(user_id=request.user_id, title="Main")
            db.add(conv)
            db.commit()
            db.refresh(conv)

    # Load last 8 messages (4 turns) for context
    recent_messages = db.query(Message).filter(
        Message.conversation_id == conv_id
    ).order_by(Message.created_at.desc()).limit(8).all()
    recent_messages = list(reversed(recent_messages))  # oldest first

    history_for_prompt = json.dumps([
        {"role": m.role, "content": m.content}
        for m in recent_messages
    ])

    state = {
        "input_text": request.raw_text,
        "current_time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "active_tasks": json.dumps(active_tasks_context),
        "conversation_history": history_for_prompt,
        "agent_action": None,
        "error": None
    }

    result = planner_agent.invoke(state)

    if result.get("error"):
        raise HTTPException(status_code=500, detail=f"Agent error: {result['error']}")

    action = result.get("agent_action")
    if not action:
        raise HTTPException(status_code=400, detail="Could not extract intent.")


    tasks_created = []
    transactions_created = []

    # --- CREATE_TASK / MULTI_ACTION ---
    if action.intent in [IntentType.CREATE_TASK, IntentType.MULTI_ACTION]:
        for t_ext in action.task_extractions:
            db_task = create_task_from_extraction(db, request.user_id, t_ext)
            tasks_created.append(db_task)

    # --- CREATE_TRANSACTION / MULTI_ACTION ---
    if action.intent in [IntentType.CREATE_TRANSACTION, IntentType.MULTI_ACTION]:
        for tr_ext in action.transaction_extractions:
            try:
                tx_type = TransactionType(tr_ext.transaction_type)
            except (ValueError, AttributeError):
                tx_type = TransactionType.Expense
            tx = Transaction(
                user_id=request.user_id,
                amount=tr_ext.amount,
                transaction_type=tx_type,
                description=tr_ext.description,
                expense_category=getattr(tr_ext, "expense_category", None),
                income_source=getattr(tr_ext, "income_source", None),
                is_business=tr_ext.is_business,
                is_recurring=tr_ext.is_recurring
            )
            db.add(tx)
            transactions_created.append(tx)
        if transactions_created:
            db.commit()
            # If MULTI_ACTION, also try to find and mark related task done
            if action.intent == IntentType.MULTI_ACTION and action.target_task_title:
                task = _fuzzy_find_task(db, request.user_id, action.target_task_title)
                if task:
                    task.status = TaskStatus.Done
                    db.commit()

    # --- GET_TASKS ---
    elif action.intent == IntentType.GET_TASKS:
        tasks = get_user_tasks(db, request.user_id)
        if tasks:
            task_list_str = "\n".join(
                f"- [{t.priority.value}] {t.title}" + (f" (due {t.due_date.strftime('%b %d, %H:%M')})" if t.due_date else "")
                for t in tasks
            )
            action.message = (action.message or "Here are your active tasks:") + f"\n\n{task_list_str}"
        else:
            action.message = "You have no active tasks. Your slate is clean."

    # --- UPDATE_TASK ---
    elif action.intent == IntentType.UPDATE_TASK:
        task = None
        if action.target_task_id:
            task = db.query(Task).filter(Task.id == action.target_task_id, Task.user_id == request.user_id).first()
        if not task and action.target_task_title:
            task = _fuzzy_find_task(db, request.user_id, action.target_task_title)
        
        if task:
            if action.target_task_status and action.target_task_status.lower() in ("done", "complete", "completed", "finished"):
                task.status = TaskStatus.Done
            if action.target_task_title and action.intent == IntentType.UPDATE_TASK and not action.target_task_status:
                task.title = action.target_task_title
            db.commit()
            action.message = action.message or f"Done. '{task.title}' has been marked complete."
        else:
            action.message = "I couldn't find that task. Try being more specific."

    # --- DELETE_TASK ---
    elif action.intent == IntentType.DELETE_TASK:
        task = None
        if action.target_task_id:
            task = db.query(Task).filter(Task.id == action.target_task_id, Task.user_id == request.user_id).first()
        if not task and action.target_task_title:
            task = _fuzzy_find_task(db, request.user_id, action.target_task_title)
        
        if task:
            title = task.title
            db.delete(task)
            db.commit()
            action.message = action.message or f"Gone. '{title}' has been deleted."
        else:
            action.message = "I couldn't find that task to delete."

    # --- DELETE_ALL_TASKS ---
    elif action.intent == IntentType.DELETE_ALL_TASKS:
        tasks = db.query(Task).filter(Task.user_id == request.user_id).all()
        count = len(tasks)
        for t in tasks:
            db.delete(t)
        db.commit()
        action.message = action.message or f"Cleared. All {count} tasks have been deleted."

    # --- GET_FINANCES ---
    elif action.intent == IntentType.GET_FINANCES:
        today = datetime.date.today()
        first_day = today.replace(day=1)
        first_day_dt = datetime.datetime.combine(first_day, datetime.time.min, tzinfo=datetime.timezone.utc)
        
        transactions = db.query(Transaction).filter(
            Transaction.user_id == request.user_id,
            Transaction.date >= first_day_dt
        ).all()
        
        income = sum(t.amount for t in transactions if t.transaction_type == TransactionType.Income)
        expenses = sum(t.amount for t in transactions if t.transaction_type == TransactionType.Expense)
        savings = sum(t.amount for t in transactions if t.transaction_type == TransactionType.Savings)
        
        all_tx = db.query(Transaction).filter(Transaction.user_id == request.user_id).all()
        receivables = sum(t.amount for t in all_tx if t.transaction_type == TransactionType.Receivable)
        payables = sum(t.amount for t in all_tx if t.transaction_type == TransactionType.Payable)
        
        action.message = (
            f"This month: Income ₹{income:,.0f} | Expenses ₹{expenses:,.0f} | Savings ₹{savings:,.0f}. "
            f"Outstanding: ₹{receivables:,.0f} receivable, ₹{payables:,.0f} payable."
        )

    # --- MANAGE_HABIT ---
    elif action.intent == IntentType.MANAGE_HABIT:
        habits_done = []
        for h_ext in action.habit_extractions:
            title = h_ext.title.strip()
            if h_ext.action == "create":
                try:
                    freq = HabitFrequency(h_ext.frequency)
                except ValueError:
                    freq = HabitFrequency.Daily
                existing = db.query(Habit).filter(
                    Habit.user_id == request.user_id,
                    Habit.title.ilike(f"%{title}%"),
                    Habit.is_active == True
                ).first()
                if not existing:
                    habit = Habit(
                        user_id=request.user_id,
                        title=title,
                        frequency=freq,
                        target_per_period=h_ext.target_per_period,
                        unit=h_ext.unit
                    )
                    db.add(habit)
                    db.commit()
                    db.refresh(habit)
                    habits_done.append(f"Created habit '{title}'")
                else:
                    habits_done.append(f"'{title}' already exists")
            else:  # log
                # Find habit by title (fuzzy)
                habit = db.query(Habit).filter(
                    Habit.user_id == request.user_id,
                    Habit.is_active == True
                ).all()
                matched = None
                title_lower = title.lower()
                for h in habit:
                    if title_lower in h.title.lower() or h.title.lower() in title_lower:
                        matched = h
                        break
                if not matched and habit:
                    import difflib
                    names = [h.title for h in habit]
                    close = difflib.get_close_matches(title, names, n=1, cutoff=0.3)
                    if close:
                        matched = next(h for h in habit if h.title == close[0])

                if matched:
                    log = HabitLog(
                        habit_id=matched.id,
                        user_id=request.user_id,
                        value=h_ext.value,
                        log_date=datetime.date.today()
                    )
                    db.add(log)
                    matched.total_sessions += 1
                    matched.last_completed_at = datetime.datetime.now(datetime.timezone.utc)
                    # Streak
                    yesterday = datetime.date.today() - datetime.timedelta(days=1)
                    had_yesterday = db.query(HabitLog).filter(
                        HabitLog.habit_id == matched.id,
                        HabitLog.log_date == yesterday
                    ).first()
                    if had_yesterday or matched.current_streak == 0:
                        matched.current_streak += 1
                    else:
                        matched.current_streak = 1
                    if matched.current_streak > matched.longest_streak:
                        matched.longest_streak = matched.current_streak
                    db.commit()
                    habits_done.append(f"Logged {h_ext.value} {h_ext.unit or 'session(s)'} for '{matched.title}' (streak: {matched.current_streak}d)")
                else:
                    # No matching habit found — create it and log immediately
                    new_habit = Habit(
                        user_id=request.user_id,
                        title=title,
                        frequency=HabitFrequency.Daily,
                        target_per_period=max(1, int(h_ext.value)),
                        unit=h_ext.unit
                    )
                    db.add(new_habit)
                    db.commit()
                    db.refresh(new_habit)
                    log = HabitLog(
                        habit_id=new_habit.id,
                        user_id=request.user_id,
                        value=h_ext.value,
                        log_date=datetime.date.today()
                    )
                    db.add(log)
                    new_habit.total_sessions = 1
                    new_habit.current_streak = 1
                    new_habit.longest_streak = 1
                    new_habit.last_completed_at = datetime.datetime.now(datetime.timezone.utc)
                    db.commit()
                    habits_done.append(f"Created and logged '{title}' (first session)")

        if habits_done and not action.message:
            action.message = " | ".join(habits_done) + ". Keep it up."

    # --- CONVERSATION / FREE_TIME / PLAN_DAY ---
    elif action.intent in [IntentType.CONVERSATION, IntentType.FREE_TIME, IntentType.PLAN_DAY]:
        pass

    # --- PERSIST CONVERSATION HISTORY ---
    final_message = action.message or "Got it."
    try:
        from app.models.conversation import Message
        user_msg = Message(conversation_id=conv_id, role="user", content=request.raw_text)
        assistant_msg = Message(conversation_id=conv_id, role="assistant", content=final_message)
        db.add(user_msg)
        db.add(assistant_msg)
        db.commit()
    except Exception:
        pass  # Never fail the main response due to history persistence

    return {
        "status": "success",
        "intent": action.intent,
        "message": final_message,
        "tasks_created": len(tasks_created),
        "transactions_created": len(transactions_created),
        "conversation_id": conv_id
    }


# ---------------------------------------------------------------------------
# GET /agents/dashboard/{user_id}
# ---------------------------------------------------------------------------

@router.get("/dashboard/{user_id}")
def get_dashboard_state(user_id: int, db: Session = Depends(get_db)):
    from app.schemas.dashboard import DashboardState
    
    active_tasks = get_user_tasks(db, user_id)

    # tz-aware NOW
    now = datetime.datetime.now(datetime.timezone.utc)
    today = datetime.date.today()

    # Finance metrics — fix date comparison by using datetime
    first_day = datetime.datetime.combine(today.replace(day=1), datetime.time.min, tzinfo=datetime.timezone.utc)

    transactions = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.date >= first_day
    ).all()

    monthly_income = sum(t.amount for t in transactions if t.transaction_type == TransactionType.Income)
    monthly_expenses = sum(t.amount for t in transactions if t.transaction_type == TransactionType.Expense)
    monthly_savings = sum(t.amount for t in transactions if t.transaction_type == TransactionType.Savings)

    all_transactions = db.query(Transaction).filter(Transaction.user_id == user_id).all()
    receivables = sum(t.amount for t in all_transactions if t.transaction_type == TransactionType.Receivable)
    payables = sum(t.amount for t in all_transactions if t.transaction_type == TransactionType.Payable)

    finances_context = {
        "monthly_income": monthly_income,
        "monthly_expenses": monthly_expenses,
        "monthly_savings": monthly_savings,
        "receivables": receivables,
        "payables": payables
    }

    # --- NATIVE DASHBOARD CONSTRUCTION ---

    # 1. Greeting (IST-aware using UTC+5:30)
    ist_offset = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    ist_now = now.astimezone(ist_offset)
    hour = ist_now.hour
    if hour < 12:
        greeting = "Good morning, Farhan."
    elif hour < 17:
        greeting = "Good afternoon, Farhan."
    else:
        greeting = "Good evening, Farhan."

    # 2. Timeline - tasks due today (timezone-safe comparison)
    today_tasks = []
    for t in active_tasks:
        if t.due_date:
            due_aware = _make_aware(t.due_date)
            if due_aware.astimezone(ist_offset).date() == today:
                today_tasks.append(t)

    timeline = []
    for t in sorted(today_tasks, key=lambda x: _make_aware(x.due_date)):
        due_ist = _make_aware(t.due_date).astimezone(ist_offset)
        timeline.append({"time": due_ist.strftime("%H:%M"), "title": t.title})

    # 3. Sort all active tasks: priority first, then due date
    priority_map = {TaskPriority.Urgent: 0, TaskPriority.High: 1, TaskPriority.Medium: 2, TaskPriority.Low: 3}
    
    def sort_key(t):
        p = priority_map.get(t.priority, 99)
        d = _make_aware(t.due_date) if t.due_date else datetime.datetime(9999, 12, 31, tzinfo=datetime.timezone.utc)
        return (p, d)
    
    sorted_tasks = sorted(active_tasks, key=sort_key)

    dashboard_tasks = []
    for t in sorted_tasks:
        due_str = None
        if t.due_date:
            due_aware = _make_aware(t.due_date)
            due_ist = due_aware.astimezone(ist_offset)
            if due_aware < now:
                due_str = f"Overdue ({due_ist.strftime('%b %d')})"
            elif due_aware.date() == today:
                due_str = f"Today {due_ist.strftime('%H:%M')}"
            elif (due_aware.date() - today).days == 1:
                due_str = f"Tomorrow {due_ist.strftime('%H:%M')}"
            else:
                due_str = due_ist.strftime("%b %d")
        
        dashboard_tasks.append({
            "id": t.id,
            "title": t.title,
            "tag": t.category.value if t.category else None,
            "due": due_str,
            "estimated": f"{t.estimated_duration_minutes}m" if t.estimated_duration_minutes else None
        })

    now_task = dashboard_tasks[0] if dashboard_tasks else None
    next_tasks = dashboard_tasks[1:5] if len(dashboard_tasks) > 1 else []

    # 4. Life Areas
    category_counts: dict[str, int] = {}
    overdue_counts: dict[str, int] = {}

    for t in active_tasks:
        cat_name = t.category.value if t.category else "Others"
        category_counts[cat_name] = category_counts.get(cat_name, 0) + 1
        if t.due_date and _make_aware(t.due_date) < now:
            overdue_counts[cat_name] = overdue_counts.get(cat_name, 0) + 1

    life_areas = [
        {"name": k, "task_count": v, "overdue_count": overdue_counts.get(k, 0)}
        for k, v in sorted(category_counts.items(), key=lambda x: -x[1])
    ]

    # 5. Needs Attention
    needs_attention = []
    overdue_tasks = [t for t in active_tasks if t.due_date and _make_aware(t.due_date) < now]
    urgent_tasks = [t for t in active_tasks if t.priority == TaskPriority.Urgent]
    
    if overdue_tasks:
        titles = ", ".join(f"'{t.title}'" for t in overdue_tasks[:3])
        suffix = f" (+{len(overdue_tasks)-3} more)" if len(overdue_tasks) > 3 else ""
        needs_attention.append(f"{len(overdue_tasks)} overdue: {titles}{suffix}")
    if urgent_tasks:
        needs_attention.append(f"{len(urgent_tasks)} task(s) marked Urgent.")
    if payables > 0:
        needs_attention.append(f"₹{payables:,.0f} in pending payments.")

    # 6. Progress
    done_today_tasks = db.query(Task).filter(
        Task.user_id == user_id, Task.status == TaskStatus.Done
    ).all()
    completed_today = sum(
        1 for t in done_today_tasks
        if t.due_date and _make_aware(t.due_date).astimezone(ist_offset).date() == today
    )
    total_today_count = len(today_tasks) + completed_today
    percentage = int((completed_today / total_today_count) * 100) if total_today_count > 0 else 0

    progress = {
        "percentage": percentage,
        "completed_count": completed_today,
        "total_count": total_today_count
    }

    # 7. Task summary
    task_summary = f"You have {len(active_tasks)} active task{'s' if len(active_tasks) != 1 else ''}."
    if urgent_tasks:
        task_summary += f" {len(urgent_tasks)} urgent."
    if overdue_tasks:
        task_summary += f" {len(overdue_tasks)} overdue."

    # 8. AI Insight (fast, single-sentence LLM call)
    insight_context = {
        "current_time": ist_now.strftime("%H:%M"),
        "active_task_count": len(active_tasks),
        "overdue_count": len(overdue_tasks),
        "urgent_count": len(urgent_tasks),
        "today_task_count": len(today_tasks),
        "monthly_income": monthly_income,
        "monthly_expenses": monthly_expenses,
        "receivables": receivables,
        "top_tasks": [{"title": t["title"], "due": t["due"], "tag": t["tag"]} for t in dashboard_tasks[:3]],
        "finances": finances_context
    }
    
    active_tasks_context = [
        {
            "id": t.id,
            "title": t.title,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "priority": t.priority.value,
            "category": t.category.value if t.category else None
        }
        for t in active_tasks
    ]

    agent_state = {
        "current_time": now.isoformat(),
        "active_tasks": json.dumps(active_tasks_context),
        "finances_summary": json.dumps(finances_context),
        "projects": "[]"
    }

    ai_result = dashboard_agent.invoke(agent_state)
    ai_insight = ai_result.get("insight") if ai_result else None

    final_state = DashboardState(
        greeting_brief=greeting,
        task_summary=task_summary,
        now_task=now_task,
        next_tasks=next_tasks,
        timeline=timeline,
        life_areas=life_areas,
        needs_attention=needs_attention,
        ai_insight=ai_insight,
        progress=progress,
        finances=finances_context
    )

    return final_state.model_dump()


# ---------------------------------------------------------------------------
# GET /agents/finances/{user_id} — Transaction history
# ---------------------------------------------------------------------------

@router.get("/finances/{user_id}")
def get_finance_history(user_id: int, limit: int = 50, db: Session = Depends(get_db)):
    """Return recent transaction history for the finance panel."""
    transactions = db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).order_by(Transaction.date.desc()).limit(limit).all()
    
    return [
        {
            "id": t.id,
            "amount": t.amount,
            "type": t.transaction_type.value,
            "description": t.description,
            "expense_category": getattr(t, "expense_category", None),
            "income_source": getattr(t, "income_source", None),
            "is_business": t.is_business,
            "is_recurring": t.is_recurring,
            "date": t.date.isoformat()
        }
        for t in transactions
    ]


# ---------------------------------------------------------------------------
# DELETE /agents/finances/transaction/{tx_id}
# ---------------------------------------------------------------------------

@router.delete("/finances/transaction/{tx_id}")
def delete_transaction(tx_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    """Delete a transaction."""
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == user_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    db.delete(tx)
    db.commit()
    return {"status": "success", "deleted_id": tx_id}
