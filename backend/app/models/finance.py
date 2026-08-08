import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Enum, ForeignKey, Integer, DateTime, func, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class TransactionType(str, enum.Enum):
    Income = "Income"
    Expense = "Expense"
    Transfer = "Transfer"
    Savings = "Savings"
    Receivable = "Receivable"
    Payable = "Payable"

class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    amount: Mapped[float] = mapped_column(Float)
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Flexible subcategory strings — AI-populated, no dropdown required
    expense_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # e.g. "Food", "Travel"
    income_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)     # e.g. "Client", "Freelance"
    
    is_business: Mapped[bool] = mapped_column(Boolean, default=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

