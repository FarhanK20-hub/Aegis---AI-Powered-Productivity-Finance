import enum
from sqlalchemy import String, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class ProjectType(str, enum.Enum):
    FRK = "FRK"
    Freelance = "Freelance"
    College = "College"
    Research = "Research"
    Personal = "Personal"

class ProjectStatus(str, enum.Enum):
    Active = "Active"
    Archived = "Archived"
    Completed = "Completed"

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[ProjectType] = mapped_column(Enum(ProjectType))
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.Active)
    
    user = relationship("User", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
