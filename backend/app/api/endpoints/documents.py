from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.document import Document
from app.models.task import Task
from app.services.document_processor import process_document

router = APIRouter()

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Uploads a PDF document and queues it for background processing (chunking and task extraction).
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    content = await file.read()
    
    # Using dummy user_id=1 for now, in a real app use auth dependency
    user_id = 1
    
    doc = Document(
        user_id=user_id,
        project_id=project_id,
        filename=file.filename,
        status="processing"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    background_tasks.add_task(process_document, doc.id, content, user_id, project_id)
    
    return {"message": "Document uploaded and processing started.", "document_id": doc.id}

@router.get("/")
def get_documents(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Retrieves all ingested documents, optionally filtered by project_id.
    """
    user_id = 1
    query = db.query(Document).filter(Document.user_id == user_id)
    if project_id:
        query = query.filter(Document.project_id == project_id)
        
    docs = query.order_by(Document.created_at.desc()).all()
    
    # Attach proposed tasks count or details if needed
    result = []
    for doc in docs:
        proposed_tasks = db.query(Task).filter(Task.document_id == doc.id, Task.is_proposed == True).all()
        result.append({
            "id": doc.id,
            "filename": doc.filename,
            "status": doc.status,
            "created_at": doc.created_at,
            "proposed_tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "description": t.description,
                    "due_date": t.due_date
                } for t in proposed_tasks
            ]
        })
        
    return result
