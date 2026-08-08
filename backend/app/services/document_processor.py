import io
import json
import logging
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session
from pypdf import PdfReader
from tenacity import retry, wait_exponential, stop_after_attempt
import os
from groq import Groq

from app.core.config import settings
from app.models.document import Document
from app.models.task import Task, TaskSource, TaskPriority
from app.services.memory import memory_service
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)

def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 200) -> list[str]:
    """Splits text into chunks of `chunk_size` characters with `overlap` overlap."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start += chunk_size - overlap
    return chunks

@retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(3))
def extract_tasks_with_groq(text: str) -> list[dict]:
    """Uses Groq API to extract potential tasks from document text."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set, cannot extract tasks.")
        return []
        
    client = Groq(api_key=api_key)
    
    prompt = f"""
    Analyze the following text and extract any tasks, action items, or deadlines.
    Format your response strictly as a JSON object containing a 'tasks' key which holds a list of objects.
    Each object must have these keys:
    - title: A short description of the task.
    - description: Additional details or context.
    - due_date: The deadline if mentioned (ISO 8601 format like YYYY-MM-DDTHH:MM:SSZ), otherwise null.
    - estimated_duration_minutes: An integer estimate of how long it takes, or null.
    
    Text:
    {text[:10000]}
    """
    
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        response_format={"type": "json_object"}
    )
    
    try:
        raw_text = completion.choices[0].message.content.strip()
        tasks_data = json.loads(raw_text)
        
        if isinstance(tasks_data, dict):
            for v in tasks_data.values():
                if isinstance(v, list):
                    return v
            return []
        elif isinstance(tasks_data, list):
            return tasks_data
        return []
    except Exception as e:
        logger.error(f"Failed to parse Groq task extraction output: {e}")
        return []

async def process_document(document_id: int, file_content: bytes, user_id: int, project_id: int = None):
    """Background task to process a PDF, chunk it, and extract tasks."""
    db = SessionLocal()
    try:
        # 1. Parse PDF
        logger.info(f"Starting processing for document {document_id}")
        pdf_file = io.BytesIO(file_content)
        reader = PdfReader(pdf_file)
        full_text = ""
        for page in reader.pages:
            full_text += page.extract_text() + "\n"
            
        # 2. Chunk & Store in Mem0
        chunks = chunk_text(full_text)
        logger.info(f"Generated {len(chunks)} chunks for document {document_id}")
        
        for idx, chunk in enumerate(chunks):
            metadata = {
                "source_type": "document",
                "document_id": document_id,
                "project_id": project_id,
                "chunk_index": idx
            }
            # memory_service.store handles interaction with vector DB
            memory_service.store(chunk, user_id=str(user_id), metadata=metadata)
            
        # 3. Extract Tasks
        tasks_data = extract_tasks_with_groq(full_text)
        logger.info(f"Extracted {len(tasks_data)} proposed tasks for document {document_id}")
        
        # 4. Save Proposed Tasks
        for t in tasks_data:
            due_date = None
            if t.get("due_date"):
                try:
                    due_date = datetime.fromisoformat(t["due_date"].replace('Z', '+00:00'))
                except ValueError:
                    pass
                    
            task = Task(
                user_id=user_id,
                project_id=project_id,
                title=t.get("title", "Untitled Task")[:255],
                description=t.get("description"),
                due_date=due_date,
                estimated_duration_minutes=t.get("estimated_duration_minutes"),
                source=TaskSource.PDF,
                is_proposed=True,
                document_id=document_id,
                priority=TaskPriority.Medium
            )
            db.add(task)
            
        # 5. Mark Document Ready
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = "ready"
            
        db.commit()
        logger.info(f"Finished processing document {document_id}")
        
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {e}")
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = "error"
            db.commit()
    finally:
        db.close()
