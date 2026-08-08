from sqlalchemy.orm import Session
from app.models.task import Task, TaskPriority, TaskSource, TaskCategory
from app.schemas.agent import TaskExtraction

def create_task_from_extraction(db: Session, user_id: int, extraction: TaskExtraction) -> Task:
    priority_enum = TaskPriority.Medium
    try:
        if extraction.estimated_priority:
            priority_enum = TaskPriority(extraction.estimated_priority)
    except ValueError:
        pass
        
    category_enum = TaskCategory.Uncategorized
    try:
        if extraction.category:
            category_enum = TaskCategory(extraction.category)
    except ValueError:
        pass

    db_task = Task(
        user_id=user_id,
        title=extraction.title,
        priority=priority_enum,
        category=category_enum,
        due_date=extraction.implied_deadline,
        estimated_duration_minutes=extraction.estimated_duration_minutes,
        source=TaskSource.Manual
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def get_user_tasks(db: Session, user_id: int) -> list[Task]:
    from app.models.task import TaskStatus
    return db.query(Task).filter(Task.user_id == user_id, Task.status != TaskStatus.Done).all()
