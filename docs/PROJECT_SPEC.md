# Aegis Project Specification

Aegis is a personal AI assistant project structured as a monorepo containing a Next.js frontend, a FastAPI backend, and deployment infrastructure configurations.

## Architecture

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS. Designed for deployment on Vercel. Connects to the backend via `NEXT_PUBLIC_API_URL`.
- **Backend**: FastAPI (Python 3.11+). Handles business logic, AI agent coordination (via LangGraph), and database interactions (SQLAlchemy + Alembic). Exposes REST endpoints (e.g., `/health`) with CORS configured for the frontend domain.
- **Database**: PostgreSQL 16 with the `pgvector` extension for vector storage and semantic search capabilities.
- **Infrastructure**: Docker Compose for local development (Postgres + Backend) and a separate Docker Compose configuration for production deployment (e.g., on an Oracle Cloud Always Free VM).

## Directory Structure

- `/frontend`: Next.js web application.
- `/backend`: FastAPI service.
  - `/app/api`: API routers and endpoints.
  - `/app/models`: SQLAlchemy ORM models.
  - `/app/schemas`: Pydantic schemas for data validation.
  - `/app/services`: Core business logic.
  - `/app/agents`: LangGraph agent definitions.
  - `/app/core`: Configuration, database sessions, security middleware.
- `/infra`: Docker and Docker Compose configurations (`docker-compose.yml` for dev, `docker-compose.prod.yml` for prod).
- `/docs`: Project documentation (`PROJECT_SPEC.md`, `DEPLOYMENT.md`).

## Environment Variables
The system requires specific environment variables for database connections, AI services, and external integrations (e.g., Telegram, WhatsApp, Email). Refer to `.env.example` for the complete list.
