from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import datetime

from app.api.deps import get_db
from app.models.finance import Transaction, TransactionType

router = APIRouter()

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TransactionCreate(BaseModel):
    amount: float
    transaction_type: str = "Expense"    # Income | Expense | Transfer | Savings | Receivable | Payable
    description: Optional[str] = None
    expense_category: Optional[str] = None
    income_source: Optional[str] = None
    is_business: bool = False
    is_recurring: bool = False
    date: Optional[str] = None           # ISO datetime string, defaults to now

def _parse_dt(s: Optional[str]) -> Optional[datetime.datetime]:
    if not s:
        return None
    try:
        return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None

def _tx_to_dict(tx: Transaction) -> dict:
    return {
        "id": tx.id,
        "amount": tx.amount,
        "type": tx.transaction_type.value if tx.transaction_type else "Expense",
        "description": tx.description,
        "expense_category": tx.expense_category,
        "income_source": tx.income_source,
        "is_business": tx.is_business,
        "is_recurring": tx.is_recurring,
        "date": tx.date.isoformat() if tx.date else None,
        "created_at": tx.created_at.isoformat() if tx.created_at else None,
    }

# ---------------------------------------------------------------------------
# List transactions
# ---------------------------------------------------------------------------

@router.get("/{user_id}")
def list_transactions(
    user_id: int,
    limit: int = Query(50, le=200),
    transaction_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """List transactions for a user."""
    q = db.query(Transaction).filter(Transaction.user_id == user_id)
    if transaction_type:
        try:
            q = q.filter(Transaction.transaction_type == TransactionType(transaction_type))
        except ValueError:
            pass
    txs = q.order_by(Transaction.date.desc()).limit(limit).all()
    return [_tx_to_dict(t) for t in txs]

# ---------------------------------------------------------------------------
# Create transaction
# ---------------------------------------------------------------------------

@router.post("/{user_id}")
def create_transaction(user_id: int, data: TransactionCreate, db: Session = Depends(get_db)):
    """Manually create a transaction."""
    try:
        tx_type = TransactionType(data.transaction_type)
    except ValueError:
        tx_type = TransactionType.Expense

    tx_date = _parse_dt(data.date) or datetime.datetime.now(datetime.timezone.utc)

    tx = Transaction(
        user_id=user_id,
        amount=data.amount,
        transaction_type=tx_type,
        description=data.description,
        expense_category=data.expense_category,
        income_source=data.income_source,
        is_business=data.is_business,
        is_recurring=data.is_recurring,
        date=tx_date,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return {"status": "success", "transaction": _tx_to_dict(tx)}

# ---------------------------------------------------------------------------
# Delete transaction
# ---------------------------------------------------------------------------

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Delete a transaction by ID."""
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    return {"status": "success"}
