# 🛡️ Aegis

**Aegis** is a blazing-fast, AI-powered personal productivity and life-management assistant. Built to be your central hub for tasks, finances, habits, and daily planning, Aegis understands natural language and acts instantly.

---

## ✨ Key Features

- **🧠 Natural Language Processing:** Talk to Aegis naturally. It automatically detects your intent (e.g., adding tasks, logging expenses, or planning your day).
- **✅ Smart Task Management:** Organize tasks by category, priority, and deadline. Mark them complete or ask Aegis to clear your schedule.
- **💸 Financial Tracking:** Log income and expenses instantly. Aegis categorizes transactions and tracks business vs. personal spending.
- **📈 Habit Tracking:** Build and monitor daily or weekly habits. Aegis tracks your streaks and total sessions automatically.
- **📊 Dynamic Dashboard:** Get a real-time, AI-generated summary of your day, outstanding tasks, financial health, and life areas.
- **🎙️ Voice Input:** Speak your commands directly using the built-in voice interface.
- **⚡ Insanely Fast:** Optimized with in-memory caching, parallel data fetching, and compact LLM prompts for sub-2-second response times.

---

## 🏗️ Architecture & Tech Stack

Aegis is built with a modern, scalable, and decoupled architecture.

### **Frontend**
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Vanilla CSS for custom animations and glassmorphism)
- **UI:** Optimistic updates, instant feedback bubbles, and responsive design

### **Backend**
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL (via SQLAlchemy & Alembic)
- **AI Agent:** LangGraph & Groq (`llama-3.1-8b-instant`)
- **Resilience:** Tenacity for automatic retries, in-memory rate limiting

### **Infrastructure**
- **Containerization:** Docker & Docker Compose
- **Vector DB:** Qdrant (Ready for semantic search/memory expansion)

---

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)
- A Groq API Key

### Installation & Running

1. **Clone the repository** (if you haven't already).
2. **Environment Variables:**
   Copy the example environment file and add your credentials:
   ```bash
   cp .env.example .env
   ```
   *Make sure to add your `GROQ_API_KEY` to the `.env` file.*

3. **Start with Docker Compose:**
   Run the entire stack (PostgreSQL, Backend, Frontend) with one command:
   ```bash
   cd infra
   docker-compose up --build
   ```

4. **Access the App:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 💬 What can you say to Aegis?

Aegis uses a sophisticated intent classification system. Here are some examples of how you can interact with it:

- **Tasks:**
  - *"Add a task to buy groceries tomorrow at 5 PM"*
  - *"Mark the grocery task as done"*
  - *"Show my tasks"*
  - *"Delete everything"*
- **Finances:**
  - *"I spent ₹500 on coffee"*
  - *"Bought a tripod for ₹4500 for business"*
  - *"How much did I spend this month?"*
- **Habits:**
  - *"Add a LeetCode habit, 2 problems daily"*
  - *"I did 3 LeetCode problems today"*
- **Planning & Free Time:**
  - *"I'm free for 30 minutes, what should I do?"*
  - *"Plan my day"*
- **Multi-Action:**
  - *"Bought a tripod for 4500 and add a task to test it tomorrow"* (Logs expense AND creates task)
- **Conversation:**
  - *"I'm feeling overwhelmed today"* (Aegis will act as a supportive assistant)

---

## 📁 Project Structure

```text
aegis/
├── frontend/             # Next.js frontend application
│   ├── app/              # App router (page.tsx, globals.css, layout.tsx)
│   └── components/       # Reusable UI components
├── backend/              # FastAPI backend application
│   ├── alembic/          # Database migrations
│   └── app/              
│       ├── api/          # API endpoints (agents, tasks, finances, habits)
│       ├── agents/       # LLM Agent logic (planner, dashboard)
│       ├── models/       # SQLAlchemy database models
│       ├── schemas/      # Pydantic validation schemas
│       └── services/     # Core business logic
└── infra/                # Docker and infrastructure configs
    └── docker-compose.yml
```

---

*Designed for personal excellence. Built with ❤️ and AI.*
