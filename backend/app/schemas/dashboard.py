from pydantic import BaseModel, Field
from typing import List, Optional

class DashboardTask(BaseModel):
    id: int = Field(description="The original task ID")
    title: str = Field(description="The task title")
    tag: Optional[str] = Field(None, description="The life area or project name (e.g., 'Client Work')")
    due: Optional[str] = Field(None, description="Formatted due string (e.g., 'today', 'in 2 hours', 'tomorrow at 5 PM')")
    estimated: Optional[str] = Field(None, description="Formatted estimated duration (e.g., '2h', '30m')")

class TimelineEvent(BaseModel):
    time: str = Field(description="Time string (e.g., '09:00', '14:30')")
    title: str = Field(description="The event or task title")

class LifeArea(BaseModel):
    name: str = Field(description="Name of the area (e.g., 'College', 'FRK')")
    task_count: int = Field(description="Total tasks in this area")
    overdue_count: int = Field(description="Overdue tasks in this area", default=0)

class ProgressMetrics(BaseModel):
    percentage: int = Field(description="0-100 percentage of tasks completed today")
    completed_count: int = Field(description="Number of completed tasks today")
    total_count: int = Field(description="Total number of tasks for today")

class FinanceMetrics(BaseModel):
    monthly_income: float = Field(description="Total income this month")
    monthly_expenses: float = Field(description="Total expenses this month")
    monthly_savings: float = Field(description="Total savings this month")
    receivables: float = Field(description="Total money owed to you")
    payables: float = Field(description="Total money you need to pay")

class DashboardState(BaseModel):
    greeting_brief: str = Field(description="E.g. 'Good morning, Farhan.'")
    task_summary: str = Field(description="E.g. 'You have 7 tasks today. 2 need attention'")
    now_task: Optional[DashboardTask] = Field(None, description="The single most critical task to do RIGHT NOW.")
    next_tasks: List[DashboardTask] = Field(description="The next 2-3 upcoming tasks.")
    timeline: List[TimelineEvent] = Field(description="Chronological schedule for today.")
    life_areas: List[LifeArea] = Field(description="Summary of active projects/areas.")
    needs_attention: List[str] = Field(description="List of issues (e.g., 'Assignment overdue', 'Bill due in 2 days')")
    ai_insight: Optional[str] = Field(None, description="Proactive AI suggestion/insight.")
    progress: ProgressMetrics = Field(description="Daily progress stats.")
    finances: FinanceMetrics = Field(description="Financial analytics")
