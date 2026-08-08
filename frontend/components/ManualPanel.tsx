"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ManualTask {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  category: string;
  due_date?: string;
  estimated_duration_minutes?: number;
  is_proposed: boolean;
  created_at?: string;
}

interface ManualTransaction {
  id: number;
  amount: number;
  type: string;
  description?: string;
  expense_category?: string;
  income_source?: string;
  is_business: boolean;
  date?: string;
}

interface ManualHabit {
  id: number;
  title: string;
  description?: string;
  frequency: string;
  target_per_period: number;
  unit?: string;
  current_streak: number;
  total_progress_percent: number;
  today_value: number;
  today_complete: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_CATEGORIES = [
  "Necessities", "College", "Business", "FRK Productions", "Finance",
  "Health & Fitness", "Learning & Growth", "Content & Brand",
  "Social & Relationships", "Household", "Creative & Hobbies",
  "Wellbeing", "Travel & Errands", "Maintenance & Admin",
  "Growth & Habits", "Others",
];

const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const TASK_STATUSES = ["Todo", "In Progress", "Done"];
const TRANSACTION_TYPES = ["Expense", "Income", "Transfer", "Savings", "Receivable", "Payable"];
const HABIT_FREQUENCIES = ["Daily", "Weekly", "Monthly"];

const CATEGORY_EMOJI: Record<string, string> = {
  "Necessities": "🍽️", "College": "🎓", "Business": "💼",
  "FRK Productions": "🚀", "Finance": "💰", "Health & Fitness": "🏋️",
  "Learning & Growth": "🧠", "Content & Brand": "📱",
  "Social & Relationships": "👥", "Household": "🏠",
  "Creative & Hobbies": "🎨", "Wellbeing": "🧘",
  "Travel & Errands": "✈️", "Maintenance & Admin": "🔧",
  "Growth & Habits": "🔄", "Others": "📦",
};

const PRIORITY_COLOR: Record<string, string> = {
  "Low": "#6b7280", "Medium": "#60a5fa", "High": "#f59e0b", "Urgent": "#f87171",
};

const STATUS_COLOR: Record<string, string> = {
  "Todo": "#6b7280", "In Progress": "#60a5fa", "Done": "#34d399",
};

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

const IconClose = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);
const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

// ─── Shared form styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "10px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "white", fontSize: "13px", outline: "none",
  fontFamily: "Inter, sans-serif", boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer", appearance: "none" as const,
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em",
  textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: "4px", display: "block",
};

const rowStyle: React.CSSProperties = { display: "flex", flexDirection: "column" as const, gap: "4px" };

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({ api, userId, onRefreshDashboard }: { api: string; userId: number; onRefreshDashboard: () => void }) {
  const [tasks, setTasks] = useState<ManualTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingTask, setEditingTask] = useState<ManualTask | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: "", description: "", priority: "Medium", category: "Uncategorized",
    due_date: "", estimated_duration_minutes: "", status: "Todo",
  });

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ include_done: "true" });
      const res = await fetch(`${api}/tasks/${userId}?${params}`);
      if (res.ok) setTasks(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [api, userId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      const body = {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        category: form.category,
        due_date: form.due_date || undefined,
        estimated_duration_minutes: form.estimated_duration_minutes ? parseInt(form.estimated_duration_minutes) : undefined,
      };

      if (editingTask) {
        const res = await fetch(`${api}/tasks/${editingTask.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, status: form.status }),
        });
        if (res.ok) { showFeedback("Task updated ✓"); setEditingTask(null); }
      } else {
        const res = await fetch(`${api}/tasks/${userId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) showFeedback("Task created ✓");
      }

      setForm({ title: "", description: "", priority: "Medium", category: "Uncategorized", due_date: "", estimated_duration_minutes: "", status: "Todo" });
      setShowForm(false);
      fetchTasks();
      onRefreshDashboard();
    } catch { showFeedback("Error saving task"); }
  };

  const handleMarkDone = async (id: number) => {
    try {
      await fetch(`${api}/tasks/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Done" }),
      });
      fetchTasks();
      onRefreshDashboard();
      showFeedback("Marked done ✓");
    } catch { /* silent */ }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${api}/tasks/${id}`, { method: "DELETE" });
      fetchTasks();
      onRefreshDashboard();
      showFeedback("Deleted ✓");
    } catch { /* silent */ }
  };

  const startEdit = (task: ManualTask) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      category: task.category,
      due_date: task.due_date ? task.due_date.slice(0, 16) : "",
      estimated_duration_minutes: task.estimated_duration_minutes?.toString() || "",
      status: task.status,
    });
    setShowForm(true);
  };

  const filtered = filterStatus === "all" ? tasks : tasks.filter(t => t.status === filterStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "4px", flex: 1, flexWrap: "wrap" }}>
          {["all", "Todo", "In Progress", "Done"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{
                padding: "5px 12px", borderRadius: "100px", fontSize: "12px",
                fontWeight: 500, border: "1px solid",
                background: filterStatus === s ? "rgba(59,130,246,0.15)" : "transparent",
                borderColor: filterStatus === s ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)",
                color: filterStatus === s ? "#93c5fd" : "var(--text-muted)", cursor: "pointer",
              }}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditingTask(null); setForm({ title: "", description: "", priority: "Medium", category: "Uncategorized", due_date: "", estimated_duration_minutes: "", status: "Todo" }); setShowForm(v => !v); }}
          style={{
            display: "flex", alignItems: "center", gap: "5px", padding: "6px 14px",
            borderRadius: "100px", background: "white", color: "black", border: "none",
            fontSize: "12px", fontWeight: 600, cursor: "pointer",
          }}>
          <IconPlus /> Add Task
        </button>
        <button onClick={fetchTasks} style={{ padding: "6px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", cursor: "pointer" }} title="Refresh">
          <IconRefresh />
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ padding: "8px 14px", borderRadius: "10px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", fontSize: "13px" }}>
          {feedback}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "white", marginBottom: "4px" }}>
            {editingTask ? "Edit Task" : "New Task"}
          </p>

          <div style={rowStyle}>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" required />
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "60px" } as React.CSSProperties}
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={rowStyle}>
              <label style={labelStyle}>Priority</label>
              <select style={selectStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Category</label>
              <select style={selectStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {TASK_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_EMOJI[c] || "•"} {c}</option>)}
              </select>
            </div>
          </div>

          {editingTask && (
            <div style={rowStyle}>
              <label style={labelStyle}>Status</label>
              <select style={selectStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={rowStyle}>
              <label style={labelStyle}>Due Date/Time</label>
              <input type="datetime-local" style={inputStyle} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Duration (mins)</label>
              <input type="number" style={inputStyle} value={form.estimated_duration_minutes} onChange={e => setForm(f => ({ ...f, estimated_duration_minutes: e.target.value }))} placeholder="e.g. 60" min="1" />
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
            <button type="button" onClick={() => { setShowForm(false); setEditingTask(null); }}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit"
              style={{ padding: "8px 20px", borderRadius: "10px", background: "white", color: "black", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              {editingTask ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px" }}>No tasks found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {filtered.map(task => (
            <div key={task.id} style={{
              display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px",
              borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              transition: "background 0.15s",
            }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}>
              {/* Status dot */}
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: STATUS_COLOR[task.status] || "#555", marginTop: "5px", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 500, color: task.status === "Done" ? "var(--text-muted)" : "white", textDecoration: task.status === "Done" ? "line-through" : "none", margin: 0 }}>
                  {task.title}
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  <span style={{ fontSize: "11px", color: PRIORITY_COLOR[task.priority] || "#6b7280" }}>
                    {task.priority}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {CATEGORY_EMOJI[task.category] || "•"} {task.category}
                  </span>
                  {task.due_date && (
                    <span style={{ fontSize: "11px", color: "#f59e0b" }}>
                      📅 {new Date(task.due_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {task.estimated_duration_minutes && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>⏱ {task.estimated_duration_minutes}m</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                {task.status !== "Done" && (
                  <button onClick={() => handleMarkDone(task.id)} title="Mark Done"
                    style={{ padding: "5px", borderRadius: "7px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", cursor: "pointer" }}>
                    <IconCheck />
                  </button>
                )}
                <button onClick={() => startEdit(task)} title="Edit"
                  style={{ padding: "5px", borderRadius: "7px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa", cursor: "pointer" }}>
                  <IconEdit />
                </button>
                <button onClick={() => handleDelete(task.id)} title="Delete"
                  style={{ padding: "5px", borderRadius: "7px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", cursor: "pointer" }}>
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Finance Tab ──────────────────────────────────────────────────────────────

function FinanceTab({ api, userId, onRefreshDashboard }: { api: string; userId: number; onRefreshDashboard: () => void }) {
  const [transactions, setTransactions] = useState<ManualTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [form, setForm] = useState({
    amount: "", transaction_type: "Expense", description: "",
    expense_category: "", income_source: "", is_business: false, date: "",
  });

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/finance/${userId}?limit=50`);
      if (res.ok) setTransactions(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [api, userId]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount) return;
    try {
      const body = {
        amount: parseFloat(form.amount),
        transaction_type: form.transaction_type,
        description: form.description || undefined,
        expense_category: form.expense_category || undefined,
        income_source: form.income_source || undefined,
        is_business: form.is_business,
        date: form.date || undefined,
      };
      const res = await fetch(`${api}/finance/${userId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) {
        showFeedback("Transaction added ✓");
        setForm({ amount: "", transaction_type: "Expense", description: "", expense_category: "", income_source: "", is_business: false, date: "" });
        setShowForm(false);
        fetchTransactions();
        onRefreshDashboard();
      }
    } catch { showFeedback("Error adding transaction"); }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${api}/finance/${id}`, { method: "DELETE" });
      fetchTransactions();
      onRefreshDashboard();
      showFeedback("Deleted ✓");
    } catch { /* silent */ }
  };

  const isIncome = (type: string) => type === "Income" || type === "Receivable";
  const isExpense = (type: string) => type === "Expense" || type === "Payable";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 14px", borderRadius: "100px", background: "white", color: "black", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
          <IconPlus /> Add Transaction
        </button>
        <button onClick={fetchTransactions} style={{ padding: "6px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", cursor: "pointer" }} title="Refresh">
          <IconRefresh />
        </button>
      </div>

      {feedback && (
        <div style={{ padding: "8px 14px", borderRadius: "10px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", fontSize: "13px" }}>
          {feedback}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "white", marginBottom: "4px" }}>New Transaction</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={rowStyle}>
              <label style={labelStyle}>Amount (₹) *</label>
              <input type="number" step="0.01" min="0" style={inputStyle} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Type</label>
              <select style={selectStyle} value={form.transaction_type} onChange={e => setForm(f => ({ ...f, transaction_type: e.target.value }))}>
                {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Lunch at cafe" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {isExpense(form.transaction_type) && (
              <div style={rowStyle}>
                <label style={labelStyle}>Category</label>
                <input style={inputStyle} value={form.expense_category} onChange={e => setForm(f => ({ ...f, expense_category: e.target.value }))} placeholder="Food, Travel, etc." />
              </div>
            )}
            {isIncome(form.transaction_type) && (
              <div style={rowStyle}>
                <label style={labelStyle}>Source</label>
                <input style={inputStyle} value={form.income_source} onChange={e => setForm(f => ({ ...f, income_source: e.target.value }))} placeholder="Client, Salary, etc." />
              </div>
            )}
            <div style={rowStyle}>
              <label style={labelStyle}>Date</label>
              <input type="datetime-local" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" id="is_business" checked={form.is_business} onChange={e => setForm(f => ({ ...f, is_business: e.target.checked }))} style={{ cursor: "pointer" }} />
            <label htmlFor="is_business" style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>Business transaction</label>
          </div>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit"
              style={{ padding: "8px 20px", borderRadius: "10px", background: "white", color: "black", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              Add
            </button>
          </div>
        </form>
      )}

      {/* Transaction List */}
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px" }}>Loading...</p>
      ) : transactions.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px" }}>No transactions yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {transactions.map(tx => (
            <div key={tx.id} style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px",
              borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
            }}
              onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tx.description || tx.expense_category || tx.income_source || tx.type}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                  {tx.type} {tx.date ? "· " + new Date(tx.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}
                  {tx.is_business ? " · 💼" : ""}
                </p>
              </div>
              <span style={{ fontSize: "14px", fontWeight: 600, color: isIncome(tx.type) ? "#34d399" : isExpense(tx.type) ? "#f87171" : "#60a5fa", flexShrink: 0 }}>
                {isIncome(tx.type) ? "+" : isExpense(tx.type) ? "-" : ""}₹{tx.amount.toLocaleString("en-IN")}
              </span>
              <button onClick={() => handleDelete(tx.id)} title="Delete"
                style={{ padding: "5px", borderRadius: "7px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", cursor: "pointer", flexShrink: 0 }}>
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Habits Tab ───────────────────────────────────────────────────────────────

function HabitsTab({ api, userId }: { api: string; userId: number }) {
  const [habits, setHabits] = useState<ManualHabit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", frequency: "Daily",
    target_per_period: "1", unit: "", total_units_target: "",
  });

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchHabits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/habits/${userId}`);
      if (res.ok) setHabits(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [api, userId]);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      const res = await fetch(`${api}/habits/${userId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, description: form.description || undefined,
          frequency: form.frequency, target_per_period: parseInt(form.target_per_period) || 1,
          unit: form.unit || undefined,
          total_units_target: form.total_units_target ? parseInt(form.total_units_target) : undefined,
        }),
      });
      if (res.ok) {
        showFeedback("Habit created ✓");
        setForm({ title: "", description: "", frequency: "Daily", target_per_period: "1", unit: "", total_units_target: "" });
        setShowForm(false);
        fetchHabits();
      }
    } catch { showFeedback("Error creating habit"); }
  };

  const handleLog = async (habit: ManualHabit) => {
    try {
      const res = await fetch(`${api}/habits/${userId}/${habit.id}/log`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 1 }),
      });
      if (res.ok) { showFeedback(`Logged "${habit.title}" ✓`); fetchHabits(); }
    } catch { /* silent */ }
  };

  const handleArchive = async (id: number, title: string) => {
    if (!confirm(`Archive "${title}"? This will hide it from your dashboard.`)) return;
    try {
      await fetch(`${api}/habits/${userId}/${id}`, { method: "DELETE" });
      showFeedback("Habit archived ✓");
      fetchHabits();
    } catch { /* silent */ }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 14px", borderRadius: "100px", background: "white", color: "black", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
          <IconPlus /> Add Habit
        </button>
        <button onClick={fetchHabits} style={{ padding: "6px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", cursor: "pointer" }} title="Refresh">
          <IconRefresh />
        </button>
      </div>

      {feedback && (
        <div style={{ padding: "8px 14px", borderRadius: "10px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", fontSize: "13px" }}>
          {feedback}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "white", marginBottom: "4px" }}>New Habit</p>

          <div style={rowStyle}>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Read 30 mins" required />
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <div style={rowStyle}>
              <label style={labelStyle}>Frequency</label>
              <select style={selectStyle} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {HABIT_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Target/period</label>
              <input type="number" min="1" style={inputStyle} value={form.target_per_period} onChange={e => setForm(f => ({ ...f, target_per_period: e.target.value }))} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Unit</label>
              <input style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="sessions, km…" />
            </div>
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>Total units target (for course-type habits)</label>
            <input type="number" min="1" style={inputStyle} value={form.total_units_target} onChange={e => setForm(f => ({ ...f, total_units_target: e.target.value }))} placeholder="Leave blank for recurring habits" />
          </div>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ padding: "8px 16px", borderRadius: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit"
              style={{ padding: "8px 20px", borderRadius: "10px", background: "white", color: "black", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              Create Habit
            </button>
          </div>
        </form>
      )}

      {/* Habit List */}
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px" }}>Loading...</p>
      ) : habits.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px" }}>No active habits.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {habits.map(h => {
            const pct = h.total_progress_percent > 0
              ? h.total_progress_percent
              : Math.min(100, (h.today_value / (h.target_per_period || 1)) * 100);
            return (
              <div key={h.id} style={{
                padding: "12px 14px", borderRadius: "12px",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              }}
                onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "white" }}>{h.title}</span>
                      {h.current_streak > 0 && (
                        <span style={{ fontSize: "11px", padding: "1px 7px", borderRadius: "100px", background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                          🔥 {h.current_streak}d
                        </span>
                      )}
                      {h.today_complete && (
                        <span style={{ fontSize: "11px", padding: "1px 7px", borderRadius: "100px", background: "rgba(52,211,153,0.15)", color: "#34d399" }}>
                          ✓ Done
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
                      {h.total_progress_percent > 0
                        ? `${pct.toFixed(0)}% complete`
                        : `${h.today_value} / ${h.target_per_period} ${h.unit || "sessions"} today`}
                      {" · "}{h.frequency}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    <button onClick={() => handleLog(h)} title="Log +1"
                      style={{ padding: "5px 10px", borderRadius: "7px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                      +1
                    </button>
                    <button onClick={() => handleArchive(h.id, h.title)} title="Archive"
                      style={{ padding: "5px", borderRadius: "7px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", cursor: "pointer" }}>
                      <IconTrash />
                    </button>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ marginTop: "8px", width: "100%", height: "3px", borderRadius: "100px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: "100px", background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", width: `${Math.min(100, pct)}%`, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Manual Panel ────────────────────────────────────────────────────────

interface ManualPanelProps {
  isOpen: boolean;
  onClose: () => void;
  api: string;
  userId: number;
  onRefreshDashboard: () => void;
}

export default function ManualPanel({ isOpen, onClose, api, userId, onRefreshDashboard }: ManualPanelProps) {
  const [tab, setTab] = useState<"tasks" | "finance" | "habits">("tasks");

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const TABS: { key: "tasks" | "finance" | "habits"; label: string; emoji: string }[] = [
    { key: "tasks", label: "Tasks", emoji: "✅" },
    { key: "finance", label: "Finance", emoji: "💰" },
    { key: "habits", label: "Habits", emoji: "🔄" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Slide-over panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
        width: "min(480px, 100vw)",
        background: "rgba(8,8,12,0.98)",
        backdropFilter: "blur(24px)",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        display: "flex", flexDirection: "column",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "2px" }}>
                Manual Mode
              </p>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
                Direct Controls
              </h2>
            </div>
            <button onClick={onClose} aria-label="Close panel"
              style={{ padding: "8px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)", cursor: "pointer" }}>
              <IconClose />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "2px", marginBottom: "-1px" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  padding: "10px 16px", borderRadius: "10px 10px 0 0",
                  background: tab === t.key ? "rgba(255,255,255,0.04)" : "transparent",
                  border: "1px solid",
                  borderColor: tab === t.key ? "rgba(255,255,255,0.08)" : "transparent",
                  borderBottom: tab === t.key ? "1px solid rgba(8,8,12,0.98)" : "1px solid transparent",
                  color: tab === t.key ? "white" : "var(--text-muted)",
                  fontSize: "13px", fontWeight: tab === t.key ? 600 : 400,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
                  transition: "all 0.15s",
                }}>
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px" }}>
          {tab === "tasks" && <TasksTab api={api} userId={userId} onRefreshDashboard={onRefreshDashboard} />}
          {tab === "finance" && <FinanceTab api={api} userId={userId} onRefreshDashboard={onRefreshDashboard} />}
          {tab === "habits" && <HabitsTab api={api} userId={userId} />}
        </div>
      </div>
    </>
  );
}
