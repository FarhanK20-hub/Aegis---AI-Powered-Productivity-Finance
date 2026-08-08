from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import datetime

from app.api.deps import get_db
from app.models.habit import Habit, HabitLog, HabitFrequency

router = APIRouter()

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class HabitCreate(BaseModel):
    title: str
    description: Optional[str] = None
    frequency: str = "Daily"
    target_per_period: int = 1
    unit: Optional[str] = None
    total_units_target: Optional[int] = None

class HabitLogRequest(BaseModel):
    value: float = 1.0
    note: Optional[str] = None

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{user_id}")
def get_habits(user_id: int, db: Session = Depends(get_db)):
    """Get all active habits with today's progress."""
    habits = db.query(Habit).filter(Habit.user_id == user_id, Habit.is_active == True).all()
    today = datetime.date.today()
    
    result = []
    for h in habits:
        # Today's logged value
        today_logs = db.query(HabitLog).filter(
            HabitLog.habit_id == h.id,
            HabitLog.log_date == today
        ).all()
        today_value = sum(log.value for log in today_logs)
        
        result.append({
            "id": h.id,
            "title": h.title,
            "description": h.description,
            "frequency": h.frequency.value,
            "target_per_period": h.target_per_period,
            "unit": h.unit,
            "current_streak": h.current_streak,
            "longest_streak": h.longest_streak,
            "total_sessions": h.total_sessions,
            "total_progress_percent": h.total_progress_percent,
            "total_units_target": h.total_units_target,
            "last_completed_at": h.last_completed_at.isoformat() if h.last_completed_at else None,
            "today_value": today_value,
            "today_target": h.target_per_period,
            "today_complete": today_value >= h.target_per_period
        })
    
    return result

@router.post("/{user_id}")
def create_habit(user_id: int, data: HabitCreate, db: Session = Depends(get_db)):
    """Create a new habit."""
    try:
        freq = HabitFrequency(data.frequency)
    except ValueError:
        freq = HabitFrequency.Daily
    
    habit = Habit(
        user_id=user_id,
        title=data.title,
        description=data.description,
        frequency=freq,
        target_per_period=data.target_per_period,
        unit=data.unit,
        total_units_target=data.total_units_target
    )
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return {"status": "success", "habit_id": habit.id, "title": habit.title}

@router.post("/{user_id}/{habit_id}/log")
def log_habit(user_id: int, habit_id: int, data: HabitLogRequest, db: Session = Depends(get_db)):
    """Log progress for a habit. Updates streak and stats."""
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    today = datetime.date.today()
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # Create log entry
    log = HabitLog(
        habit_id=habit_id,
        user_id=user_id,
        value=data.value,
        note=data.note,
        log_date=today
    )
    db.add(log)
    
    # Update habit stats
    habit.total_sessions += 1
    habit.last_completed_at = now
    
    # Update progress percent if course-type
    if habit.total_units_target and habit.total_units_target > 0:
        all_logs = db.query(HabitLog).filter(HabitLog.habit_id == habit_id).all()
        total_done = sum(l.value for l in all_logs) + data.value
        habit.total_progress_percent = min(100.0, (total_done / habit.total_units_target) * 100)
    
    # Update streak
    yesterday = today - datetime.timedelta(days=1)
    yesterday_logs = db.query(HabitLog).filter(
        HabitLog.habit_id == habit_id,
        HabitLog.log_date == yesterday
    ).first()
    
    if yesterday_logs or habit.current_streak == 0:
        habit.current_streak += 1
    else:
        habit.current_streak = 1  # Reset streak if missed yesterday
    
    if habit.current_streak > habit.longest_streak:
        habit.longest_streak = habit.current_streak
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"Logged {data.value} {habit.unit or 'session(s)'} for '{habit.title}'.",
        "streak": habit.current_streak,
        "progress_percent": habit.total_progress_percent
    }

@router.delete("/{user_id}/{habit_id}")
def delete_habit(user_id: int, habit_id: int, db: Session = Depends(get_db)):
    """Archive (soft-delete) a habit."""
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    habit.is_active = False
    db.commit()
    return {"status": "success"}
