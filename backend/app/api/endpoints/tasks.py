from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import datetime

from app.api.deps import get_db
from app.models.task import Task, TaskStatus, TaskPriority, TaskCategory

router = APIRouter()

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "Medium"
    category: str = "Uncategorized"
    due_date: Optional[str] = None          # ISO datetime string or None
    estimated_duration_minutes: Optional[int] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    due_date: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None

def _parse_dt(s: Optional[str]) -> Optional[datetime.datetime]:
    """Parse an ISO-format datetime string, return None if blank/invalid."""
    if not s:
        return None
    try:
        return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None

def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "priority": task.priority.value if task.priority else "Medium",
        "status": task.status.value if task.status else "Todo",
        "category": task.category.value if task.category else "Uncategorized",
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "estimated_duration_minutes": task.estimated_duration_minutes,
        "scheduled_start": task.scheduled_start.isoformat() if task.scheduled_start else None,
        "scheduled_end": task.scheduled_end.isoformat() if task.scheduled_end else None,
        "is_proposed": task.is_proposed,
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }

# ---------------------------------------------------------------------------
# List tasks
# ---------------------------------------------------------------------------

@router.get("/{user_id}")
def list_tasks(
    user_id: int,
    status: Optional[str] = Query(None, description="Filter by status: Todo, In Progress, Done"),
    category: Optional[str] = Query(None, description="Filter by category"),
    include_done: bool = Query(False, description="Include completed tasks"),
    db: Session = Depends(get_db)
):
    """List all tasks for a user with optional filters."""
    q = db.query(Task).filter(Task.user_id == user_id, Task.is_proposed == False)

    if status:
        try:
            q = q.filter(Task.status == TaskStatus(status))
        except ValueError:
            pass
    elif not include_done:
        q = q.filter(Task.status != TaskStatus.Done)

    if category:
        try:
            q = q.filter(Task.category == TaskCategory(category))
        except ValueError:
            pass

    tasks = q.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc()).all()
    return [_task_to_dict(t) for t in tasks]

# ---------------------------------------------------------------------------
# Create task
# ---------------------------------------------------------------------------

@router.post("/{user_id}")
def create_task(user_id: int, data: TaskCreate, db: Session = Depends(get_db)):
    """Manually create a new task."""
    try:
        priority = TaskPriority(data.priority)
    except ValueError:
        priority = TaskPriority.Medium

    try:
        category = TaskCategory(data.category)
    except ValueError:
        category = TaskCategory.Uncategorized

    task = Task(
        user_id=user_id,
        title=data.title,
        description=data.description,
        priority=priority,
        category=category,
        due_date=_parse_dt(data.due_date),
        estimated_duration_minutes=data.estimated_duration_minutes,
        scheduled_start=_parse_dt(data.scheduled_start),
        scheduled_end=_parse_dt(data.scheduled_end),
        is_proposed=False,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"status": "success", "task": _task_to_dict(task)}

# ---------------------------------------------------------------------------
# Update task
# ---------------------------------------------------------------------------

@router.put("/{task_id}")
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    """Update fields on an existing task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.priority is not None:
        try:
            task.priority = TaskPriority(data.priority)
        except ValueError:
            pass
    if data.status is not None:
        try:
            task.status = TaskStatus(data.status)
        except ValueError:
            pass
    if data.category is not None:
        try:
            task.category = TaskCategory(data.category)
        except ValueError:
            pass
    if data.due_date is not None:
        task.due_date = _parse_dt(data.due_date) if data.due_date != "" else None
    if data.estimated_duration_minutes is not None:
        task.estimated_duration_minutes = data.estimated_duration_minutes
    if data.scheduled_start is not None:
        task.scheduled_start = _parse_dt(data.scheduled_start) if data.scheduled_start != "" else None
    if data.scheduled_end is not None:
        task.scheduled_end = _parse_dt(data.scheduled_end) if data.scheduled_end != "" else None

    db.commit()
    return {"status": "success", "task": _task_to_dict(task)}

# ---------------------------------------------------------------------------
# Confirm proposed task
# ---------------------------------------------------------------------------

@router.post("/{task_id}/confirm")
def confirm_proposed_task(task_id: int, db: Session = Depends(get_db)):
    """Confirms a proposed task by setting is_proposed to False."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_proposed = False
    db.commit()
    return {"status": "success", "task_id": task.id}

# ---------------------------------------------------------------------------
# Delete task
# ---------------------------------------------------------------------------

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Deletes a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"status": "success"}
