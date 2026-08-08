from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.task import Task

router = APIRouter()

@router.post("/{task_id}/confirm")
def confirm_proposed_task(task_id: int, db: Session = Depends(get_db)):
    """
    Confirms a proposed task by setting is_proposed to False.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.is_proposed = False
    db.commit()
    
    return {"status": "success", "task_id": task.id}

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """
    Deletes a task (used to dismiss a proposed task).
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    db.delete(task)
    db.commit()
    
    return {"status": "success"}
