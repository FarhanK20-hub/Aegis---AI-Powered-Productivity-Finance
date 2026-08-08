# 🛡️ Aegis — System Design Document

> **Version:** 1.0  
> **Last Updated:** August 2026  
> **Author:** Farhan K  

---

## Table of Contents

1. [Overview](#1-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture](#4-backend-architecture)
5. [AI Agent Pipeline](#5-ai-agent-pipeline)
6. [Data Models & Database Design](#6-data-models--database-design)
7. [API Design](#7-api-design)
8. [Security Design](#8-security-design)
9. [Notification System](#9-notification-system)
10. [Deployment Topology](#10-deployment-topology)
11. [Performance & Rate Limiting](#11-performance--rate-limiting)
12. [Key Design Decisions](#12-key-design-decisions)

---

## 1. Overview

**Aegis** is an AI-powered personal productivity and life management platform. It is designed around a single core principle: **talk to it naturally, and it acts**.

Instead of clicking through menus to add a task, log an expense, or track a habit, the user simply types a message like:

> *"Bought a tripod for ₹4500 for business and add a task to test it tomorrow"*

Aegis parses this in a single AI inference call, creates the transaction AND the task simultaneously, and returns an instant, contextual response — all in under 2 seconds.

### Core Capabilities

| Domain | What Aegis Can Do |
|---|---|
| **Tasks** | Create, list, update, prioritize tasks with deadlines |
| **Finance** | Log income/expenses, set budgets, categorize spending |
| **Habits** | Create habits, log daily progress, track streaks |
| **Dashboard** | AI-generated daily summary with timeline, stats |
| **Conversations** | Handle chitchat, free time suggestions, motivational nudges |
| **Notifications** | Push notifications, Telegram bot, email reminders |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                              │
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │         Next.js 14 Frontend (Vercel CDN)                  │    │
│   │   - Single-page app (no page reloads)                     │    │
│   │   - Instant UI updates via React state                    │    │
│   │   - Service Worker for PWA + Push Notifications           │    │
│   └───────────────────────┬───────────────────────────────────┘    │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ HTTPS REST API calls
                            │ (CORS-protected)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Render Cloud)                     │
│                                                                     │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐ │
│   │  REST API   │   │  AI Agents  │   │  Background Scheduler   │ │
│   │  Endpoints  │──▶│  (LangGraph │   │  (APScheduler)          │ │
│   │             │   │  + Groq LLM)│   │  - Daily summaries      │ │
│   └──────┬──────┘   └─────────────┘   │  - Habit reminders      │ │
│          │                            └─────────────────────────┘ │
│          ▼                                                          │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐ │
│   │ SQLAlchemy  │   │  Middleware │   │  Notification Services  │ │
│   │  ORM Layer  │   │  - CORS     │   │  - Resend (Email)       │ │
│   │             │   │  - Rate Limit│  │  - Telegram Bot         │ │
│   └──────┬──────┘   │  - Timing   │   │  - Web Push (VAPID)     │ │
│          │          └─────────────┘   └─────────────────────────┘ │
└──────────┼──────────────────────────────────────────────────────────┘
           │ PostgreSQL connection (pgbouncer pool)
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Supabase (Managed PostgreSQL)                     │
│                                                                     │
│   users │ tasks │ transactions │ budgets │ habits │ habit_logs      │
│   conversations │ notifications │ documents │ projects              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

### Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR/SSG support, file-based routing |
| Language | TypeScript | Type safety, catches bugs at compile time |
| Styling | Tailwind CSS | Rapid development, utility-first |
| State | React useState / useEffect | Simple, no Redux needed for this scale |
| Hosting | Vercel | Zero-config Next.js deployment, global CDN |
| PWA | Service Worker + next-pwa | Install on home screen, offline support |

### Component Structure

```
frontend/
├── app/
│   ├── page.tsx               ← Main dashboard (single-page app)
│   ├── layout.tsx             ← Root layout (fonts, metadata, PWA)
│   └── globals.css            ← Design system tokens (CSS vars)
├── public/
│   ├── manifest.json          ← PWA manifest
│   └── sw.js                  ← Service Worker for push notifications
└── next.config.js
```

### UI/UX Design Principles

1. **Single-Page Architecture** — The entire app lives on one page. No navigation means no loading time between features.
2. **Optimistic UI** — The input box clears and shows a loading state immediately on submission, even before the backend responds, making the app feel instant.
3. **Skeleton Loading** — Dashboard data loads in the background with animated skeleton screens; no blank pages are ever shown.
4. **Dark Mode by Default** — Uses CSS custom properties (`var(--bg)`, `var(--text)`) for a consistent, premium dark aesthetic.
5. **PWA (Progressive Web App)** — Users can install Aegis on their phone home screen. Push notifications work even when the browser is closed.

### Data Flow (Frontend)

```
User types → submitCommand() → POST /agents/planner/parse
                                        ↓
                              AI parses & executes action
                                        ↓
                              Response: { message, intent, tasks_created, ... }
                                        ↓
                              Update chat bubble + refetch dashboard
                                        ↓
                              GET /agents/dashboard/{user_id}
                                        ↓
                              React re-renders dashboard widgets
```

---

## 4. Backend Architecture

### Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | FastAPI | Async Python, auto Swagger docs, Pydantic |
| Language | Python 3.11 | Latest stable, best AI library support |
| ORM | SQLAlchemy 2.0 | Type-safe DB queries |
| Migrations | Alembic | Version-controlled schema changes |
| Validation | Pydantic v2 | Input validation with clear error messages |
| Scheduler | APScheduler | In-process background job scheduling |
| LLM Orchestration | LangGraph | Stateful agent graphs |
| Hosting | Render | Free-tier cloud hosting with auto-deploy |

### Application Layers

```
app/
├── main.py                    ← FastAPI app, middleware, routers
├── core/
│   ├── config.py              ← Pydantic Settings (reads .env)
│   ├── database.py            ← SQLAlchemy engine + session factory
│   └── scheduler.py           ← APScheduler for background jobs
├── api/endpoints/
│   ├── agents.py              ← /agents/* (planner, dashboard, finances)
│   ├── habits.py              ← /habits/*
│   ├── tasks.py               ← /tasks/*
│   ├── notifications.py       ← /notifications/*
│   ├── documents.py           ← /documents/*
│   └── whatsapp.py            ← /notifications/whatsapp/*
├── agents/
│   ├── planner.py             ← Core LangGraph AI agent
│   └── dashboard.py           ← Dashboard data aggregator
├── models/                    ← SQLAlchemy ORM table definitions
├── schemas/                   ← Pydantic request/response schemas
└── services/                  ← Business logic (task, notification, memory)
```

### Middleware Stack (Request Processing Order)

Every HTTP request passes through middleware in this exact order:

```
Incoming Request
       │
       ▼
1. CORS Middleware          → Checks Origin header against ALLOWED_ORIGINS
       │                      Rejects cross-origin requests from untrusted domains
       ▼
2. Rate Limit Middleware    → Checks per-IP request counts (sliding window)
       │                      Returns 429 if threshold exceeded
       ▼
3. Timing Middleware        → Records start time
       │
       ▼
4. Route Handler            → Actual business logic executes here
       │
       ▼
5. Timing Middleware        → Adds X-Response-Time header to response
       │
       ▼
Outgoing Response
```

---

## 5. AI Agent Pipeline

This is the core intelligence of Aegis. Every natural language input goes through a **LangGraph state machine** backed by **Groq's LLaMA 3.1 8B Instant** model.

### Why Groq + LLaMA 3.1?

| Factor | Reason |
|---|---|
| **Speed** | Groq's hardware achieves ~750 tokens/second (vs ~30 for GPT-4) |
| **Cost** | Free tier with generous limits — ideal for this project |
| **JSON Mode** | Groq supports forced JSON output, eliminating parsing errors |
| **Accuracy** | LLaMA 3.1 8B is sufficient for intent classification and structured extraction |

### Intent Classification

The AI classifies every input into one of these intents:

| Intent | Example Input | Action Taken |
|---|---|---|
| `CREATE_TASK` | "Add a task to study ML" | Creates a new Task row in DB |
| `CREATE_TRANSACTION` | "Spent 500 on coffee" | Creates a new Transaction row |
| `MULTI_ACTION` | "Bought tripod 4500 and add task to test it" | Creates both simultaneously |
| `MANAGE_HABIT` | "Log 2 LeetCode problems done" | Finds/creates habit, logs progress |
| `FREE_TIME` | "I'm bored" | Returns personalized suggestion |
| `CONVERSATION` | Gibberish or general chat | Returns witty response, no DB write |

### LangGraph State Machine

```
START
  │
  ▼
agent_node (LLM call via Groq)
  │  Input: user text + current time + list of active tasks
  │  Output: { intent, message, task_extractions, transaction_extractions, habit_extractions }
  │
  ▼
execute_action_node (Database writes)
  │  Creates tasks, transactions, habits based on LLM output
  │  Each extraction is independently inserted into PostgreSQL
  │
  ▼
END → Returns { status, intent, message, tasks_created, transactions_created }
```

### Prompt Engineering

The system prompt given to the LLM includes:
- **Current time** — so it can calculate "tomorrow" or "next week" correctly
- **User's active tasks** — so FREE_TIME responses reference real tasks
- **Rules for each intent** — explicit examples of what triggers each intent
- **JSON schema** — forces the model to return a specific, parseable structure every time

### Retry & Resilience

The LLM call is wrapped with `tenacity` for automatic retries:
- **3 attempts maximum**
- **Exponential backoff:** 2s → 4s → 8s on rate limit (HTTP 429) errors
- **Re-raises** the error after all attempts fail so the user sees a clean error message

---

## 6. Data Models & Database Design

All data is stored in **PostgreSQL** (hosted on Supabase). The ORM layer uses **SQLAlchemy 2.0** with typed mapped columns.

### Entity Relationship Diagram

```
users (1)
  │
  ├──(many) tasks
  │           - title, category (enum), priority (H/M/L), status
  │           - deadline, estimated_minutes, project_id (optional FK)
  │
  ├──(many) transactions
  │           - amount, type (Income/Expense/etc.), category (enum)
  │           - description, is_business, is_recurring, date
  │
  ├──(many) budgets
  │           - category (enum), monthly_limit
  │
  ├──(many) habits
  │           │  - title, frequency (Daily/Weekly), target_per_period, unit
  │           │  - current_streak, longest_streak, total_sessions
  │           │  - total_progress_percent, total_units_target
  │           │  - last_completed_at, is_active
  │           │
  │           └──(many) habit_logs
  │                   - value (e.g., 2.0 = 2 problems solved)
  │                   - note, logged_at, log_date
  │
  ├──(many) conversations
  │           - role (user/assistant), content, created_at, project_id
  │
  ├──(many) notifications
  │           - title, body, type, is_read, push_subscription (JSON)
  │
  ├──(many) projects
  │           - name, description, status, color
  │
  └──(many) documents
              - filename, content_type, raw_text, summary, created_at
```

### Task Categories (Enum)

Tasks are organized into life domains to help with focus and balance:

`Necessities` | `College` | `Business` | `FRKProductions` | `Finance` | `Health` | `Learning` | `Content` | `Social` | `Household` | `Creative` | `Wellbeing` | `Travel` | `Maintenance` | `Growth` | `Uncategorized`

### Finance Categories

- **Transaction Types:** `Income`, `Expense`, `Transfer`, `Savings`, `Receivable`, `Payable`
- **Expense Categories:** `Food`, `Travel`, `Shopping`, `Health`, `Education`, `Business`, `Entertainment`, `Bills`, `Rent`, `Salary`, `Freelance`, `Other`

### Database Connection Strategy

| Environment | Connection Method | Why |
|---|---|---|
| Local Docker | Direct connection `db:5432` | Within Docker network, no latency overhead |
| Production (Render) | Supabase Session Pooler `pooler.supabase.com:5432` | Render is IPv4; Supabase direct is IPv6-only. Session pooler supports IPv4 and manages connection pooling |

---

## 7. API Design

### REST API Conventions

- **Base URL:** `https://aegis-backend-b1zi.onrender.com`
- **Format:** JSON for all requests and responses
- **Auth:** Currently user_id based (stateless)
- **Docs:** Interactive Swagger UI at `/docs`

### Core Endpoints

#### AI Agent (`/agents`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/agents/planner/parse` | Core: parse natural language, execute action |
| `GET` | `/agents/dashboard/{user_id}` | Full daily dashboard aggregation |
| `GET` | `/agents/finances/{user_id}` | Finance summary + recent transactions |
| `GET` | `/agents/tasks/{user_id}` | All tasks for user |
| `POST` | `/agents/tasks/{task_id}/complete` | Mark a task as complete |

#### Habits (`/habits`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/habits/{user_id}` | All habits with streak data |
| `POST` | `/habits` | Create a new habit |
| `POST` | `/habits/{habit_id}/log` | Log a daily progress entry |
| `GET` | `/habits/{habit_id}/logs` | Get full log history |

#### Notifications (`/notifications`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/notifications/subscribe` | Register a browser push subscription |
| `POST` | `/notifications/send` | Trigger a push notification |
| `GET` | `/notifications/{user_id}` | Get notification history |
| `POST` | `/notifications/whatsapp/webhook` | WhatsApp incoming message webhook |

#### System

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (used by Render's health monitoring) |
| `GET` | `/docs` | Interactive Swagger UI |
| `GET` | `/redoc` | ReDoc API documentation |

### Standard Response Format

```json
{
  "status": "success",
  "intent": "MULTI_ACTION",
  "message": "Logged ₹4500 expense for tripod and created task 'Test the tripod' for tomorrow.",
  "tasks_created": 1,
  "transactions_created": 1,
  "conversation_id": 42
}
```

---

## 8. Security Design

### CORS (Cross-Origin Resource Sharing)

The backend explicitly whitelists allowed frontend origins. Any request from an origin not in `ALLOWED_ORIGINS` is rejected at the middleware layer before any business logic runs. This prevents unauthorized websites from making API calls on behalf of a user.

```
Production:  ALLOWED_ORIGINS=https://aegis-frontend.vercel.app
Development: ALLOWED_ORIGINS=http://localhost:3000 (auto-added)
```

### Rate Limiting

An in-memory, per-IP sliding window prevents API abuse:

| Endpoint | Limit | Reason |
|---|---|---|
| `/agents/planner/parse` | 30 req/min | LLM calls are expensive; prevents runaway usage |
| `/agents/dashboard` | 20 req/min | Prevents excessive DB reads from auto-refresh |
| Everything else | 120 req/min | General protection |

On breach: `HTTP 429 Too Many Requests` with `Retry-After: 60` header.

### Secrets Management

- All secrets stored in environment variables, never hardcoded
- `.env` is in `.gitignore` and never committed
- `.env.example` documents all variable names for new developers
- Render and Vercel encrypt env vars at rest

### Future Security Roadmap

- [ ] JWT-based authentication (replace `user_id` path params)
- [ ] Input sanitization before sending to LLM
- [ ] Redis-backed rate limiting for multi-instance deployments
- [ ] Audit logging for sensitive operations

---

## 9. Notification System

Aegis has a multi-channel notification system to reach users wherever they are.

### Channel 1: Web Push Notifications (Primary)

Uses the **VAPID (Voluntary Application Server Identification)** standard for secure, end-to-end encrypted push messages:

```
Step 1: User clicks "Enable Notifications" in browser
Step 2: Browser generates a PushSubscription (endpoint + keys)
Step 3: Frontend sends subscription to backend → stored in DB
Step 4: Backend uses pywebpush + VAPID keys to send encrypted push
Step 5: Browser's Service Worker receives message (even with tab closed)
Step 6: Service Worker displays native OS notification
```

### Channel 2: Telegram Bot

```
Step 1: User sends /start to the Aegis Telegram bot
Step 2: Bot captures the chat_id, user links it to their account
Step 3: Backend sends messages via Telegram Bot API
Step 4: Used for: daily summaries, task reminders, habit nudges
```

### Channel 3: Email (Resend API)

- Used for weekly reports and important alerts
- Resend provides 3,000 free emails/month
- Clean HTML email templates

### Background Scheduler (APScheduler)

Runs inside the FastAPI process for automatic notifications:

| Job | Schedule | Action |
|---|---|---|
| Daily Summary | 8:00 AM daily | AI-generated day plan sent to all users |
| Habit Reminder | 7:00 PM daily | Nudge users with incomplete habits |
| Budget Alert | On transaction create | Warn if category spending exceeds 80% of budget |

---

## 10. Deployment Topology

### Production Infrastructure

```
                    ┌─────────────┐
                    │   GitHub    │
                    │(main branch)│
                    └──────┬──────┘
                           │ Auto-deploy on every push
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌───────────────┐
       │   Vercel    │          │    Render      │
       │  (Frontend) │          │   (Backend)    │
       │  Next.js 14 │          │   FastAPI      │
       │  Global CDN │          │   Free Tier    │
       └──────┬──────┘          └───────┬────────┘
              │                         │
              │ HTTPS API calls          │ PostgreSQL
              └─────────────────────────┤ (Session Pooler)
                                        ▼
                               ┌─────────────────┐
                               │    Supabase     │
                               │  (PostgreSQL 16)│
                               │  Free Tier      │
                               └─────────────────┘
```

### Cost Breakdown (Monthly)

| Service | Plan | Cost |
|---|---|---|
| Vercel (Frontend) | Hobby (Free) | $0 |
| Render (Backend) | Free Tier | $0 |
| Supabase (Database) | Free Tier (500MB) | $0 |
| Groq (LLM) | Free Tier | $0 |
| Resend (Email) | Free Tier (3k/month) | $0 |
| **Total** | | **$0/month** |

### Environment Configuration

| Variable | Local Dev | Production |
|---|---|---|
| `DATABASE_URL` | `postgresql://aegis:aegis@db:5432/aegis` | Supabase Session Pooler URL |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Vercel deployment URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Render backend URL |

---

## 11. Performance & Rate Limiting

### Latency Budget (Target: under 2 seconds end-to-end)

| Step | Target Time |
|---|---|
| Frontend → Backend network | ~50ms |
| CORS + Rate limit middleware | < 1ms |
| LLM inference (Groq LLaMA 3.1) | ~400ms |
| Database reads + writes | ~20ms |
| Backend → Frontend network | ~50ms |
| **Total** | **~521ms** |

### Why Groq is Critical

Traditional LLM APIs process ~30 tokens/second. Groq achieves ~750 tokens/second using custom LPU hardware. For a 500-token response:
- GPT-4 / Claude: ~16 seconds
- **Groq LLaMA 3.1: ~0.7 seconds**

This 20x speed difference is what makes Aegis feel instant.

### Dashboard Loading Strategy

The dashboard makes 3 parallel API calls on load:
1. `GET /agents/dashboard/{user_id}` — main data
2. `GET /habits/{user_id}` — habit streaks
3. `GET /agents/finances/{user_id}` — finance summary

All 3 run concurrently via `Promise.all()` in the frontend, reducing total load time to max(t1, t2, t3) instead of t1 + t2 + t3.

---

## 12. Key Design Decisions

### Decision 1: Single-Page App vs. Multi-Page

**Chosen:** Single-page app (all features on one page)

**Rationale:** Aegis is a command-driven interface. There is no need to navigate between pages. The input bar + dashboard is the entire UX. A single page eliminates navigation overhead and keeps the experience focused and fast.

---

### Decision 2: Groq LLaMA 3.1 vs. OpenAI GPT-4

**Chosen:** Groq LLaMA 3.1 8B Instant

**Rationale:** Speed (10x faster), cost (free tier), and sufficient accuracy for structured extraction from short user inputs. GPT-4 would be overkill and introduce unnecessary cost and latency.

---

### Decision 3: LangGraph vs. Plain Function

**Chosen:** LangGraph state machine

**Rationale:** Cleanly separates the LLM call (`agent_node`) from database writes (`execute_action_node`). Each node is independently testable. LangGraph also enables future multi-step agents (e.g., "research a topic, summarize it, and create a task").

---

### Decision 4: Supabase Session Pooler vs. Direct Connection

**Chosen:** Session Pooler (pgbouncer, port 5432)

**Rationale:** Render runs on IPv4 infrastructure. Supabase's direct database connection recently moved to IPv6-only. The session pooler remains IPv4-compatible and provides free connection pooling, which prevents connection exhaustion on the free tier.

---

### Decision 5: In-Memory Rate Limiting vs. Redis

**Chosen:** In-memory using `threading.Lock` + `collections.deque`

**Rationale:** Zero additional infrastructure. Works perfectly for a single-process deployment. The limitations (state lost on restart, doesn't scale across multiple instances) are acceptable at the current scale. A Redis upgrade path is straightforward when needed.

---

### Decision 6: No Authentication vs. JWT

**Current:** User ID passed as path parameter (e.g., `/dashboard/1`)

**Rationale:** Rapid prototyping. The system is currently single-user (personal use). The database schema already has a `users` table designed for multi-user support.

**Migration Path:** Add `Authorization: Bearer <JWT>` headers, extract user_id from token claims, and remove user_id from path parameters. The database layer requires no changes.

---

*For deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)*  
*For project overview and setup, see [README.md](../README.md)*
