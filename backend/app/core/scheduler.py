import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import or_

from app.core.database import SessionLocal
from app.models.task import Task
from app.models.calendar_event import CalendarEvent
from app.services.notification import dispatch_notification

logger = logging.getLogger(__name__)

def check_due_items():
    logger.info("Scheduler checking for due items...")
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        # Look ahead 15 minutes
        lookahead = now + timedelta(minutes=15)
        
        # Check Tasks
        due_tasks = db.query(Task).filter(
            Task.due_date != None,
            Task.due_date <= lookahead,
            Task.reminded == False
        ).all()
        
        for task in due_tasks:
            dispatch_notification(
                db=db,
                user_id=task.user_id,
                notification_type="task_reminder",
                title="Task Due Soon",
                body=f"Your task '{task.title}' is due at {task.due_date.strftime('%Y-%m-%d %H:%M')}."
            )
            task.reminded = True
            db.commit()
            
        # Check Calendar Events
        due_events = db.query(CalendarEvent).filter(
            CalendarEvent.start != None,
            CalendarEvent.start <= lookahead,
            CalendarEvent.reminded == False
        ).all()
        
        for event in due_events:
            dispatch_notification(
                db=db,
                user_id=event.user_id,
                notification_type="event_reminder",
                title="Event Starting Soon",
                body=f"Your event '{event.title}' starts at {event.start.strftime('%Y-%m-%d %H:%M')}."
            )
            event.reminded = True
            db.commit()
            
    except Exception as e:
        logger.error(f"Error in check_due_items: {e}")
    finally:
        db.close()

scheduler = BackgroundScheduler()
scheduler.add_job(check_due_items, IntervalTrigger(minutes=1), id="check_due_items_job", replace_existing=True)
