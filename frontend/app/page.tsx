"use client";

import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardTask {
  id: number; title: string; tag?: string; due?: string; estimated?: string;
}
interface TimelineEvent { time: string; title: string; }
interface LifeArea { name: string; task_count: number; overdue_count: number; }
interface ProgressMetrics { percentage: number; completed_count: number; total_count: number; }
interface FinanceMetrics {
  monthly_income: number; monthly_expenses: number; monthly_savings: number;
  receivables: number; payables: number;
}
interface DashboardState {
  greeting_brief: string; task_summary: string;
  now_task?: DashboardTask; next_tasks: DashboardTask[];
  timeline: TimelineEvent[]; life_areas: LifeArea[];
  needs_attention: string[]; ai_insight?: string;
  progress: ProgressMetrics; finances: FinanceMetrics;
}
interface Habit {
  id: number; title: string; frequency: string;
  target_per_period: number; unit?: string;
  current_streak: number; total_progress_percent: number;
  today_value: number; today_complete: boolean; description?: string;
}
interface Transaction {
  id: number; amount: number; type: string;
  description?: string; expense_category?: string;
  income_source?: string; is_business: boolean; date: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const API = "http://localhost:8000";
const USER_ID = 1;

const CATEGORY_EMOJI: Record<string, string> = {
  "Necessities": "🍽️", "College": "🎓", "Business": "💼",
  "FRK Productions": "🚀", "Finance": "💰", "Health & Fitness": "🏋️",
  "Learning & Growth": "🧠", "Content & Brand": "📱",
  "Social & Relationships": "👥", "Household": "🏠",
  "Creative & Hobbies": "🎨", "Wellbeing": "🧘",
  "Travel & Errands": "✈️", "Maintenance & Admin": "🔧",
  "Growth & Habits": "🔄", "Others": "📦", "Uncategorized": "📦",
};

const SUGGESTIONS = [
  "What should I do right now?",
  "I'm free for an hour.",
  "Plan my evening.",
  "Show my tasks.",
  "How much did I spend this month?",
];

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonDashboard() {
  return (
    <div className="flex flex-col gap-8 animate-fade-in" aria-hidden="true">
      <div>
        <div className="skeleton h-10 w-80 mb-3" />
        <div className="skeleton h-5 w-56" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[1,2,3].map(i => <div key={i} className="card skeleton h-48" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card skeleton h-56" />
        <div className="flex flex-col gap-5">
          <div className="card skeleton h-24" />
          <div className="card skeleton h-28" />
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onPrompt }: { onPrompt: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in text-center">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
          <img src="/logo1.png" alt="Aegis" className="w-10 h-10 object-contain" />
        </div>
        <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" style={{ animationDuration: '3s' }} />
      </div>
      <div>
        <h2 className="text-3xl font-bold mb-2">Welcome to Aegis.</h2>
        <p className="text-[var(--text-secondary)] max-w-sm">Your command center is ready. Start by telling me what you need to do.</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {["Add gym tomorrow at 6 AM", "I spent ₹350 on lunch", "What should I focus on?", "Create a task for the client edit"].map(s => (
          <button key={s} onClick={() => onPrompt(s)}
            className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-all hover:border-white/20">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Habits Widget ────────────────────────────────────────────────────────────

function HabitsWidget({ habits, onLog }: { habits: Habit[]; onLog: (id: number, title: string) => void }) {
  if (!habits.length) return (
    <section className="card">
      <div className="section-label">
        <span>🔄</span> Growth & Habits
      </div>
      <p className="text-[var(--text-muted)] text-sm italic">
        No habits yet. Try: <em>&quot;Add LeetCode 2 problems daily&quot;</em>
      </p>
    </section>
  );

  return (
    <section className="card animate-fade-in">
      <div className="section-label"><span>🔄</span> Growth & Habits</div>
      <div className="flex flex-col gap-4">
        {habits.map(h => {
          const pct = h.total_progress_percent > 0
            ? h.total_progress_percent
            : Math.min(100, (h.today_value / h.target_per_period) * 100);
          const isCourseLike = h.total_progress_percent > 0;
          return (
            <div key={h.id} className="flex flex-col gap-2 p-3 rounded-2xl bg-white/[.02] hover:bg-white/[.04] transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-200">{h.title}</span>
                    {h.current_streak > 0 && (
                      <span className="tag tag-orange">🔥 {h.current_streak}d</span>
                    )}
                    {h.today_complete && (
                      <span className="tag tag-green">✓ Done</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {isCourseLike
                      ? `${pct.toFixed(0)}% complete`
                      : `${h.today_value} / ${h.target_per_period} ${h.unit || "sessions"} today`}
                  </p>
                </div>
                <button
                  onClick={() => onLog(h.id, h.title)}
                  className="icon-btn green flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Log progress"
                  aria-label={`Log ${h.title}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                </button>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 progress-bar-fill transition-all"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Finance Panel ───────────────────────────────────────────────────────────

function FinanceWidget({
  finances, transactions, showHistory, onToggleHistory
}: {
  finances: FinanceMetrics;
  transactions: Transaction[];
  showHistory: boolean;
  onToggleHistory: () => void;
}) {
  const net = finances.monthly_income - finances.monthly_expenses;
  return (
    <section className="card animate-fade-in" style={{ borderColor: 'rgba(16,185,129,0.15)' }}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-8 -mt-8" style={{ background: 'rgba(16,185,129,0.05)' }} />
      <div className="section-label relative z-10"><span>💰</span> Finances · This Month</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 relative z-10">
        {[
          { label: "Income", val: finances.monthly_income, color: "#34d399" },
          { label: "Expenses", val: finances.monthly_expenses, color: "#f87171" },
          { label: "Savings", val: finances.monthly_savings, color: "#60a5fa" },
          { label: "Net", val: net, color: net >= 0 ? "#34d399" : "#f87171" },
        ].map(({ label, val, color }) => (
          <div key={label}>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-xl font-bold mt-0.5" style={{ color }}>₹{Math.abs(val).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
      {(finances.receivables > 0 || finances.payables > 0) && (
        <div className="flex gap-4 mt-4 pt-4 border-t border-white/[.06] relative z-10">
          {finances.receivables > 0 && (
            <div>
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Receivable</p>
              <p className="text-sm font-semibold" style={{ color: '#34d399' }}>₹{finances.receivables.toLocaleString("en-IN")}</p>
            </div>
          )}
          {finances.payables > 0 && (
            <div>
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Payable</p>
              <p className="text-sm font-semibold" style={{ color: '#f87171' }}>₹{finances.payables.toLocaleString("en-IN")}</p>
            </div>
          )}
        </div>
      )}
      <button onClick={onToggleHistory}
        className="mt-4 text-xs font-semibold text-[var(--text-muted)] hover:text-white transition-colors flex items-center gap-1 relative z-10">
        {showHistory ? "Hide" : "View"} transactions
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {showHistory && transactions.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 max-h-48 overflow-y-auto relative z-10 animate-fade-in">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/[.04] last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 truncate">{tx.description || tx.expense_category || tx.income_source || tx.type}</p>
                <p className="text-xs text-[var(--text-muted)]">{new Date(tx.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} · {tx.type}</p>
              </div>
              <span className={`text-sm font-semibold ml-3 flex-shrink-0 ${tx.type === "Income" ? "text-green-400" : tx.type === "Expense" ? "text-red-400" : "text-gray-400"}`}>
                {tx.type === "Expense" ? "-" : tx.type === "Income" ? "+" : ""}₹{tx.amount.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      )}
      {showHistory && transactions.length === 0 && (
        <p className="mt-3 text-sm text-[var(--text-muted)] italic animate-fade-in">No transactions yet. Try: &quot;Spent ₹350 on lunch&quot;</p>
      )}
    </section>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [showFinanceHistory, setShowFinanceHistory] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loadingCommand, setLoadingCommand] = useState(false);
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [pendingInput, setPendingInput] = useState<string | null>(null); // shows immediately while processing
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Live clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }));
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) { setLoadingDashboard(true); setLoadError(false); }
    try {
      const res = await fetch(`${API}/agents/dashboard/${USER_ID}`);
      if (res.ok) {
        setDashboard(await res.json());
      } else if (!silent) {
        setLoadError(true);
      }
    } catch {
      if (!silent) setLoadError(true);
    }
    if (!silent) setLoadingDashboard(false);
  }, []);

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch(`${API}/habits/${USER_ID}`);
      if (res.ok) setHabits(await res.json());
    } catch { /* silently fail */ }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/agents/finances/${USER_ID}?limit=20`);
      if (res.ok) setTransactions(await res.json());
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    // Load all data in parallel on mount
    Promise.all([
      fetchDashboard(),
      fetchHabits(),
      fetchTransactions()
    ]);

    // Voice setup
    if (typeof window !== "undefined") {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsRecording(false);
          submitCommand(transcript);
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
        recognitionRef.current = recognition;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const showResponse = useCallback((msg: string) => {
    setAgentResponse(msg);
    clearTimeout(responseTimerRef.current);
    responseTimerRef.current = setTimeout(() => setAgentResponse(null), 10000);
  }, []);

  const submitCommand = useCallback(async (textToSubmit: string) => {
    if (!textToSubmit.trim()) return;
    setInput("");
    setLoadingCommand(true);
    setPendingInput(textToSubmit);   // show immediately while waiting
    setAgentResponse(null);
    clearTimeout(responseTimerRef.current);
    try {
      const body: Record<string, unknown> = { raw_text: textToSubmit, user_id: USER_ID };
      if (conversationId) body.conversation_id = conversationId;
      const res = await fetch(`${API}/agents/planner/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      setPendingInput(null);
      if (res.ok) {
        const data = await res.json();
        showResponse(data.message || "Done.");
        if (data.conversation_id) setConversationId(data.conversation_id);
        const needsReload = ["CREATE_TASK","UPDATE_TASK","DELETE_TASK","DELETE_ALL_TASKS","CREATE_TRANSACTION","MULTI_ACTION"].includes(data.intent);
        if (needsReload) {
          Promise.all([fetchDashboard(true), fetchTransactions()]);
        }
        if (data.intent === "MANAGE_HABIT") fetchHabits();
      } else if (res.status === 429) {
        showResponse("⏳ Slow down — you've sent too many messages. Wait a moment and try again.");
      } else {
        const err = await res.json().catch(() => ({}));
        showResponse(err.detail || "Something went wrong. Try again.");
      }
    } catch {
      setPendingInput(null);
      showResponse("Can't reach Aegis right now. Check your connection.");
    }
    setLoadingCommand(false);
  }, [fetchDashboard, fetchTransactions, fetchHabits, showResponse, conversationId]);

  const handleLogHabit = useCallback(async (habitId: number, title: string) => {
    try {
      const res = await fetch(`${API}/habits/${USER_ID}/${habitId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 1 })
      });
      if (res.ok) {
        fetchHabits();
        showResponse(`Logged "${title}". Keep it up.`);
      }
    } catch { /* silent */ }
  }, [fetchHabits, showResponse]);

  const handleMarkDone = useCallback((id: number) => {
    submitCommand(`Mark task with ID ${id} as done`);
  }, [submitCommand]);

  const handleDeleteTask = useCallback((id: number) => {
    submitCommand(`Delete task with ID ${id}`);
  }, [submitCommand]);

  const isFirstRun = !loadingDashboard && !loadError && dashboard && 
    dashboard.next_tasks.length === 0 && !dashboard.now_task && 
    dashboard.life_areas.length === 0;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

      {/* HEADER */}
      <header className="sticky top-0 z-10 px-6 md:px-8 py-4 flex justify-between items-center"
        style={{ background: 'rgba(6,6,8,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <img src="/logo1.png" alt="Aegis" className="w-7 h-7 object-contain" />
          <span className="font-bold tracking-tight text-lg" style={{ letterSpacing: '-0.02em' }}>Aegis</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm hidden sm:block" style={{ color: 'var(--text-muted)' }}>{currentTime}</span>
          <button className="icon-btn" aria-label="Notifications" title="Notifications">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          </button>
          <button className="icon-btn" aria-label="Settings" title="Settings">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.75 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-8 pb-36 max-w-5xl mx-auto w-full flex flex-col gap-7">

        {loadingDashboard ? (
          <SkeletonDashboard />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p className="text-gray-500">Couldn&apos;t connect to Aegis backend.</p>
            <button onClick={() => fetchDashboard()}
              className="px-6 py-2.5 rounded-full border border-white/10 text-sm font-semibold hover:bg-white/5 transition">
              Retry
            </button>
          </div>
        ) : isFirstRun ? (
          <EmptyState onPrompt={submitCommand} />
        ) : dashboard ? (
          <>
            {/* GREETING */}
            <section className="animate-fade-in" style={{ animationDelay: '0ms' }}>
              <h1 className="text-4xl font-extrabold tracking-tight mb-1.5" style={{ letterSpacing: '-0.03em' }}>
                {dashboard.greeting_brief}
              </h1>
              <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>{dashboard.task_summary}</p>
            </section>

            {/* NEEDS ATTENTION (only if there's something) */}
            {dashboard.needs_attention.length > 0 && (
              <section className="card animate-fade-in" style={{ borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.02)', animationDelay: '50ms' }}>
                <div className="section-label" style={{ color: '#f87171' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Needs Attention
                </div>
                <ul className="flex flex-col gap-2">
                  {dashboard.needs_attention.map((issue, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#f87171' }} />
                      {issue}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* NOW + UPCOMING */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* NOW TASK */}
              {dashboard.now_task && (
                <section className="card group animate-fade-in" style={{ borderColor: 'rgba(59,130,246,0.2)', animationDelay: '100ms' }}>
                  <div className="absolute top-0 right-0 w-28 h-28 rounded-full blur-3xl -mr-8 -mt-8 opacity-40 group-hover:opacity-70 transition-opacity" style={{ background: 'rgba(59,130,246,0.15)' }} />
                  <div className="section-label relative z-10">
                    <div className="relative flex items-center justify-center w-3 h-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
                      <div className="absolute w-3 h-3 rounded-full opacity-70 animate-ping" style={{ background: '#3b82f6', animationDuration: '2s' }} />
                    </div>
                    Now
                    <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleMarkDone(dashboard.now_task!.id)} className="icon-btn green" title="Mark done" aria-label="Mark done">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button onClick={() => handleDeleteTask(dashboard.now_task!.id)} className="icon-btn red" title="Delete" aria-label="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold relative z-10" style={{ letterSpacing: '-0.02em' }}>{dashboard.now_task.title}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-3 relative z-10">
                    {dashboard.now_task.tag && (
                      <span className="tag tag-default">{CATEGORY_EMOJI[dashboard.now_task.tag] || "•"} {dashboard.now_task.tag}</span>
                    )}
                    {dashboard.now_task.due && (
                      <span className={`tag ${dashboard.now_task.due.startsWith("Overdue") ? "tag-red" : "tag-orange"}`}>{dashboard.now_task.due}</span>
                    )}
                    {dashboard.now_task.estimated && (
                      <span className="tag tag-blue">⏱ {dashboard.now_task.estimated}</span>
                    )}
                  </div>
                  <button
                    onClick={() => submitCommand(`I'm starting on '${dashboard.now_task?.title}' now`)}
                    className="mt-5 self-start relative z-10 px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
                    style={{ background: 'white', color: 'black' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#e5e7eb')}
                    onMouseOut={e => (e.currentTarget.style.background = 'white')}
                  >
                    Start Focus →
                  </button>
                </section>
              )}

              {/* UPCOMING TASKS */}
              {dashboard.next_tasks.length > 0 && (
                <section className={`card animate-fade-in ${!dashboard.now_task ? 'lg:col-span-2' : ''}`} style={{ animationDelay: '150ms' }}>
                  <div className="section-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Upcoming
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {dashboard.next_tasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between px-3 py-2.5 rounded-2xl transition-colors group/task"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                        onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}>
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                          <div className="flex gap-1.5 mt-0.5 flex-wrap">
                            {task.tag && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{CATEGORY_EMOJI[task.tag] || ''} {task.tag}</span>}
                            {task.due && <span className={`text-xs ${task.due.startsWith("Overdue") ? "text-red-400" : "text-amber-400"}`}>{task.due}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => handleMarkDone(task.id)} className="icon-btn green" title="Mark done" aria-label="Mark done">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button onClick={() => handleDeleteTask(task.id)} className="icon-btn red" title="Delete" aria-label="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* TIMELINE + PROGRESS + AI INSIGHT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in" style={{ animationDelay: '200ms' }}>
              {/* TIMELINE */}
              <section className="lg:col-span-2 card">
                <div className="section-label">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Today&apos;s Timeline
                </div>
                {dashboard.timeline.length > 0 ? (
                  <div className="relative ml-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                    {dashboard.timeline.map((event, i) => (
                      <div key={i} className="relative pl-6 pb-5 last:pb-0">
                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-2"
                          style={{ background: 'var(--bg)', borderColor: '#3b82f6' }} />
                        <div className="flex gap-4 items-baseline">
                          <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{event.time}</span>
                          <span className="text-sm font-medium text-gray-200">{event.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: 'var(--text-muted)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <p className="text-sm">No scheduled tasks for today.</p>
                    <p className="text-xs">Add tasks with specific times to see them here.</p>
                  </div>
                )}
              </section>

              {/* PROGRESS + INSIGHT */}
              <div className="flex flex-col gap-5">
                {/* PROGRESS */}
                <section className="card">
                  <div className="section-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Today&apos;s Progress
                  </div>
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-4xl font-extrabold" style={{ letterSpacing: '-0.03em' }}>{dashboard.progress.percentage}%</span>
                    <span className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      {dashboard.progress.completed_count} / {dashboard.progress.total_count}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full progress-bar-fill"
                      style={{ width: `${dashboard.progress.percentage}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
                  </div>
                </section>

                {/* AI INSIGHT */}
                {dashboard.ai_insight && (
                  <section className="card flex-1" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-3xl -mr-6 -mt-6 opacity-50" style={{ background: 'rgba(139,92,246,0.2)' }} />
                    <div className="section-label relative z-10" style={{ color: '#a78bfa' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Aegis Insight
                    </div>
                    <p className="text-sm leading-relaxed relative z-10" style={{ color: 'var(--text-secondary)' }}>{dashboard.ai_insight}</p>
                    <button onClick={() => submitCommand("What should I do right now based on my tasks and time?")}
                      className="mt-3 w-full py-2 rounded-xl text-xs font-semibold transition-all relative z-10"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}
                      onMouseOver={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.2)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}>
                      What should I do now?
                    </button>
                  </section>
                )}
              </div>
            </div>

            {/* HABITS + FINANCES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in" style={{ animationDelay: '250ms' }}>
              <HabitsWidget habits={habits} onLog={handleLogHabit} />
              {dashboard.finances && (
                <FinanceWidget
                  finances={dashboard.finances}
                  transactions={transactions}
                  showHistory={showFinanceHistory}
                  onToggleHistory={() => setShowFinanceHistory(v => !v)}
                />
              )}
            </div>

            {/* LIFE AREAS */}
            {dashboard.life_areas.length > 0 && (
              <section className="animate-fade-in" style={{ animationDelay: '300ms' }}>
                <div className="section-label mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                  Life Areas
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                  {dashboard.life_areas.map((area, i) => (
                    <button key={i}
                      onClick={() => submitCommand(`Show tasks in ${area.name}`)}
                      className="flex-shrink-0 px-4 py-3 rounded-2xl text-left transition-all hover:scale-[1.02]"
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        minWidth: '140px'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <div className="text-lg mb-1">{CATEGORY_EMOJI[area.name] || "•"}</div>
                      <p className="text-sm font-semibold text-gray-200 leading-tight">{area.name}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {area.task_count} task{area.task_count !== 1 ? "s" : ""}
                        {area.overdue_count > 0 && <span style={{ color: '#f87171' }}> · {area.overdue_count} overdue</span>}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </main>

      {/* COMMAND BAR */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-4 sm:pb-6 pt-2 pointer-events-none flex flex-col items-center"
        style={{ background: 'linear-gradient(to top, var(--bg) 60%, transparent)' }}>

        {/* SUGGESTION CHIPS — only when idle */}
        {!loadingCommand && !agentResponse && !pendingInput && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 max-w-3xl w-full pointer-events-auto">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => submitCommand(s)}
                className="flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full transition-all font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)', backdropFilter: 'blur(12px)' }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* PENDING INPUT — shows user's message instantly */}
        {pendingInput && (
          <div className="max-w-3xl w-full mb-2 pointer-events-auto animate-fade-in-up flex flex-col gap-2">
            {/* User bubble */}
            <div className="self-end max-w-[85%]">
              <div className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm"
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', color: '#e2e8f0' }}>
                {pendingInput}
              </div>
            </div>
            {/* Typing indicator */}
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
              style={{ background: 'rgba(20,20,24,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src="/logo1.png" alt="Aegis" className="w-5 h-5 object-contain flex-shrink-0" />
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
                    background: '#555',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AGENT RESPONSE */}
        {agentResponse && !pendingInput && (
          <div className="max-w-3xl w-full mb-2 pointer-events-auto animate-fade-in-up">
            <div className="flex items-start gap-3 px-5 py-3.5 rounded-2xl"
              style={{ background: 'rgba(20,20,24,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src="/logo1.png" alt="Aegis" className="w-5 h-5 object-contain flex-shrink-0 mt-0.5" />
              <p className="text-sm flex-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{agentResponse}</p>
              <button onClick={() => { setAgentResponse(null); clearTimeout(responseTimerRef.current); }}
                className="icon-btn flex-shrink-0 ml-1" aria-label="Dismiss">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* COMMAND INPUT */}
        <form onSubmit={e => { e.preventDefault(); submitCommand(input); }}
          className="max-w-3xl w-full pointer-events-auto flex items-center gap-2"
          style={{ background: 'rgba(12,12,16,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px', padding: '6px 6px 6px 20px' }}>

          {/* Voice mic */}
          <button type="button" onClick={toggleRecording}
            className={`flex-shrink-0 transition-colors ${isRecording ? 'text-red-400' : ''}`}
            style={{ color: isRecording ? '#f87171' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isRecording ? 2.5 : 1.75}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isRecording ? "Listening..." : loadingCommand ? "Processing..." : "Ask Aegis anything..."}
            disabled={loadingCommand || isRecording}
            className="flex-1 bg-transparent text-white focus:outline-none text-sm"
            style={{ color: 'white', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            aria-label="Command input"
          />

          <button type="submit"
            disabled={!input.trim() || loadingCommand || isRecording}
            className="flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: 'white', color: 'black' }}>
            {loadingCommand ? (
              <div className="w-4 h-4 border-2 border-black border-r-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}
