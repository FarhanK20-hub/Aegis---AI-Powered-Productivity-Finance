from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class IntentType(str, Enum):
    CONVERSATION = "CONVERSATION"
    CREATE_TASK = "CREATE_TASK"
    GET_TASKS = "GET_TASKS"
    UPDATE_TASK = "UPDATE_TASK"
    DELETE_TASK = "DELETE_TASK"
    DELETE_ALL_TASKS = "DELETE_ALL_TASKS"
    CREATE_TRANSACTION = "CREATE_TRANSACTION"
    GET_FINANCES = "GET_FINANCES"
    MULTI_ACTION = "MULTI_ACTION"
    FREE_TIME = "FREE_TIME"
    PLAN_DAY = "PLAN_DAY"
    MANAGE_HABIT = "MANAGE_HABIT"

class TaskExtraction(BaseModel):
    title: str = Field(description="A clear, concise title for the task.")
    description: Optional[str] = Field(None, description="Optional short description of what the task involves.")
    category: str = Field(
        description="The exact TaskCategory value. If unsure, use 'Others'. NEVER ask the user.",
        default="Others"
    )
    implied_deadline: Optional[datetime] = Field(None, description="Absolute date/time deadline if implied in text.")
    estimated_priority: str = Field(default="Medium", description="One of: Low, Medium, High, Urgent")
    estimated_duration_minutes: int = Field(default=30, description="Estimated minutes to complete.")

class TransactionExtraction(BaseModel):
    amount: float = Field(description="The numeric amount of the transaction.")
    transaction_type: str = Field(description="One of: Income, Expense, Transfer, Savings, Receivable, Payable")
    description: Optional[str] = Field(None, description="Short description of the transaction.")
    expense_category: Optional[str] = Field(None, description="For expenses: Food, Travel, Shopping, Subscription, Bills, Health, Education, Entertainment, Business, Other")
    income_source: Optional[str] = Field(None, description="For income: Client, Salary, Freelance, Business, Refund, Other")
    is_business: bool = Field(default=False, description="True if this is a business transaction.")
    is_recurring: bool = Field(default=False, description="True if this is a recurring subscription/payment.")

class HabitExtraction(BaseModel):
    action: str = Field(default="log", description="'create' to create a new habit, 'log' to log progress.")
    title: str = Field(description="The name of the habit.")
    frequency: str = Field(default="Daily", description="Daily or Weekly.")
    value: float = Field(default=1.0, description="Amount to log (problems, sessions, chapters, etc.).")
    unit: Optional[str] = Field(None, description="Unit: problems, sessions, chapters, km, minutes, etc.")
    target_per_period: int = Field(default=1, description="Daily/weekly target (e.g. 2 for '2 problems daily').")

class AgentAction(BaseModel):
    intent: IntentType = Field(description="The detected intent of the user's message.")
    message: str = Field(description="A warm, direct conversational response to the user. Speak like an intelligent personal assistant — confident, brief, personal.")
    
    task_extractions: List[TaskExtraction] = Field(default_factory=list, description="Tasks to create.")
    transaction_extractions: List[TransactionExtraction] = Field(default_factory=list, description="Transactions to create.")
    habit_extractions: List[HabitExtraction] = Field(default_factory=list, description="Habits to create or log. Use for MANAGE_HABIT intent.")
    
    target_task_id: Optional[int] = Field(None, description="The ID of the task to update or delete.")
    target_task_title: Optional[str] = Field(None, description="The title of the task to update, delete, or mark done.")
    target_task_status: Optional[str] = Field(None, description="The new status: done, in_progress, todo")

class TaskParseRequest(BaseModel):
    raw_text: str
    user_id: int
    conversation_id: Optional[int] = None  # if provided, history is loaded and stored

