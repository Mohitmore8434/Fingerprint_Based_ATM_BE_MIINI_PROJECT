// ============================================================
// SecureATM — Main Application
// ============================================================
import { useState, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Fingerprint,
  Wifi,
  WifiOff,
  LogOut,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Cpu,
  RefreshCcw,
  ChevronRight,
  DollarSign,
  Activity,
} from "lucide-react";
import {
  useATMState,
  useESP32State,
  useUsers,
  useTransactions,
  updateUserBalance,
  addTransaction,
  forceLogout,
} from "@/hooks/useFirebase";
import type { Transaction } from "@/hooks/useFirebase";
import "./styles.css";

// ── Types ────────────────────────────────────────────────────
type Page = "dashboard" | "session" | "users" | "transactions";
type ToastType = { id: number; message: string; kind: "success" | "error" | "info" };

// ── Toast hook ───────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const counter = useRef(0);
  const show = useCallback((message: string, kind: ToastType["kind"] = "info") => {
    const id = ++counter.current;
    setToasts((p) => [...p, { id, message, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, show };
}

// ── Helpers ──────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);
}
function fmtDate(s: string) {
  try { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s)); }
  catch { return s; }
}
function initials(name: string) { return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2); }

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const atm = useATMState();
  const esp32 = useESP32State();
  const users = useUsers();
  const transactions = useTransactions();
  const { toasts, show } = useToast();

  const currentUserData = atm.currentUser ? users[String(atm.currentUser)] : null;
  const totalUsers = Object.keys(users).filter((k) => k !== "_comment").length;
  const totalBalance = Object.values(users).reduce((s, u) => s + (u.balance || 0), 0);
  const todayTx = transactions.filter((t) => {
    try { return new Date(t.timestamp).toDateString() === new Date().toDateString(); }
    catch { return false; }
  }).length;

  async function handleLogout() {
    try { await forceLogout(); show("Session terminated via Web UI", "success"); }
    catch { show("Failed to logout", "error"); }
  }

  async function handleWithdraw(userId: string, amount: number) {
    const user = users[userId];
    if (!user) return;
    if (amount <= 0) { show("Enter a valid amount", "error"); return; }
    if (amount > user.balance) { show("Insufficient balance", "error"); return; }
    const newBalance = user.balance - amount;
    try {
      await updateUserBalance(userId, newBalance);
      await addTransaction({
        userId: parseInt(userId),
        type: "withdrawal",
        amount,
        balanceBefore: user.balance,
        balanceAfter: newBalance,
        timestamp: new Date().toISOString(),
        status: "success",
      });
      show(`Withdrew ${fmt(amount)} successfully`, "success");
    } catch { show("Transaction failed", "error"); }
  }

  async function handleDeposit(userId: string, amount: number) {
    const user = users[userId];
    if (!user) return;
    if (amount <= 0) { show("Enter a valid amount", "error"); return; }
    const newBalance = user.balance + amount;
    try {
      await updateUserBalance(userId, newBalance);
      await addTransaction({
        userId: parseInt(userId),
        type: "deposit",
        amount,
        balanceBefore: user.balance,
        balanceAfter: newBalance,
        timestamp: new Date().toISOString(),
        status: "success",
      });
      show(`Deposited ${fmt(amount)} successfully`, "success");
    } catch { show("Transaction failed", "error"); }
  }

  return (
    <>
      <div className="app-shell">
        {/* ── Topbar ── */}
        <header className="topbar">
          <div className="topbar-brand">
            <div className="topbar-brand-icon">
              <Fingerprint size={20} color="white" />
            </div>
            <span className="topbar-brand-name">Secure<span>ATM</span></span>
          </div>
          <div className="topbar-right">
            <div className={`status-badge ${esp32.online ? "online" : "offline"}`}>
              <span className="status-dot" />
              {esp32.online ? "ESP32 Online" : "ESP32 Offline"}
            </div>
            {atm.authenticated && (
              <div className="status-badge online">
                <ShieldCheck size={12} />
                Session Active
              </div>
            )}
          </div>
        </header>

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-section-label">Navigation</div>
          {(
            [
              { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
              { id: "session",   label: "ATM Session",  Icon: Fingerprint    },
              { id: "users",     label: "Users",        Icon: Users          },
              { id: "transactions", label: "Transactions", Icon: Receipt     },
            ] as { id: Page; label: string; Icon: React.ElementType }[]
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              id={`nav-${id}`}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => setPage(id)}
            >
              <Icon size={18} className="nav-icon" />
              {label}
              {page === id && <ChevronRight size={14} style={{ marginLeft: "auto", opacity: 0.5 }} />}
            </button>
          ))}

          <div style={{ marginTop: "auto" }}>
            <div className="divider" />
            <div className="sidebar-section-label">Hardware</div>
            <div className="nav-item" style={{ cursor: "default" }}>
              <Cpu size={18} className="nav-icon" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>ESP32</div>
                <div style={{ fontSize: 11, color: esp32.online ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                  {esp32.online ? "● Online" : "● Offline"}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main-content">
          {page === "dashboard" && (
            <DashboardPage
              atm={atm}
              esp32={esp32}
              totalUsers={totalUsers}
              totalBalance={totalBalance}
              todayTx={todayTx}
              transactions={transactions}
              currentUserData={currentUserData}
            />
          )}
          {page === "session" && (
            <SessionPage
              atm={atm}
              currentUserData={currentUserData}
              onLogout={handleLogout}
              onWithdraw={handleWithdraw}
              onDeposit={handleDeposit}
              users={users}
              show={show}
            />
          )}
          {page === "users" && <UsersPage users={users} atm={atm} />}
          {page === "transactions" && <TransactionsPage transactions={transactions} users={users} />}
        </main>
      </div>

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "success" ? <ShieldCheck size={18} color="var(--green)" style={{ flexShrink: 0 }} /> :
             t.kind === "error"   ? <AlertCircle size={18} color="var(--red)"   style={{ flexShrink: 0 }} /> :
                                    <Activity    size={18} color="var(--accent)" style={{ flexShrink: 0 }} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Dashboard Page ────────────────────────────────────────────
function DashboardPage({ atm, esp32, totalUsers, totalBalance, todayTx, transactions, currentUserData }: {
  atm: ReturnType<typeof useATMState>;
  esp32: ReturnType<typeof useESP32State>;
  totalUsers: number; totalBalance: number; todayTx: number;
  transactions: Transaction[];
  currentUserData: ReturnType<typeof useUsers>[string] | null;
}) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Real-time SecureATM system overview</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: "var(--accent-dim)" }}>
            <Users size={22} color="var(--accent-bright)" />
          </div>
          <div className="stat-card-value">{totalUsers}</div>
          <div className="stat-card-label">Registered Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: "var(--green-dim)" }}>
            <DollarSign size={22} color="var(--green)" />
          </div>
          <div className="stat-card-value" style={{ fontSize: 22 }}>{fmt(totalBalance)}</div>
          <div className="stat-card-label">Total Balance</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: "var(--yellow-dim)" }}>
            <Receipt size={22} color="var(--yellow)" />
          </div>
          <div className="stat-card-value">{todayTx}</div>
          <div className="stat-card-label">Transactions Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: atm.authenticated ? "var(--green-dim)" : "var(--red-dim)" }}>
            <ShieldCheck size={22} color={atm.authenticated ? "var(--green)" : "var(--red)"} />
          </div>
          <div className="stat-card-value" style={{ fontSize: 22, color: atm.authenticated ? "var(--green)" : "var(--red)" }}>
            {atm.authenticated ? "Active" : "Idle"}
          </div>
          <div className="stat-card-label">ATM Session</div>
        </div>
      </div>

      {/* Current Session */}
      <div className={`session-panel ${!atm.authenticated ? "session-inactive" : ""}`} style={{ marginBottom: 28 }}>
        <div className="session-title">Current Session</div>
        {atm.authenticated && currentUserData ? (
          <div className="session-row">
            <div>
              <div className="session-user-name">{currentUserData.name}</div>
              <div className="session-meta">
                <div className="session-meta-item">
                  <span className="session-meta-label">Fingerprint ID</span>
                  <span className="session-meta-value">#{atm.currentUser}</span>
                </div>
                <div className="session-meta-item">
                  <span className="session-meta-label">Account</span>
                  <span className="session-meta-value">{currentUserData.accountNumber}</span>
                </div>
                <div className="session-meta-item">
                  <span className="session-meta-label">Balance</span>
                  <span className="session-meta-value" style={{ color: "var(--green)" }}>{fmt(currentUserData.balance)}</span>
                </div>
                <div className="session-meta-item">
                  <span className="session-meta-label">Login Type</span>
                  <span className="session-meta-value">{atm.loginType || "fingerprint"}</span>
                </div>
              </div>
            </div>
            <div className="session-avatar">{initials(currentUserData.name)}</div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-muted)" }}>
            <Fingerprint size={28} opacity={0.4} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Waiting for fingerprint scan…</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Place your finger on the ESP32 sensor to authenticate</div>
            </div>
          </div>
        )}
      </div>

      {/* ESP32 Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">ESP32 Hardware</span>
            {esp32.online ? <Wifi size={16} color="var(--green)" /> : <WifiOff size={16} color="var(--red)" />}
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Status</span>
              <span className={`pill ${esp32.online ? "green" : "red"}`}>{esp32.online ? "Online" : "Offline"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Last Seen</span>
              <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{esp32.lastSeen}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Heartbeat Interval</span>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>10 seconds</span>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Activity</span>
            <TrendingUp size={16} color="var(--accent-bright)" />
          </div>
          <div className="card-body" style={{ padding: "0 0 8px" }}>
            {transactions.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No transactions yet</div>
            ) : (
              transactions.slice(0, 5).map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 22px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: t.type === "withdrawal" ? "var(--red-dim)" : "var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {t.type === "withdrawal"
                      ? <ArrowUpRight size={16} color="var(--red)" />
                      : <ArrowDownLeft size={16} color="var(--green)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.type === "withdrawal" ? "Withdrawal" : "Deposit"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>User #{t.userId}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.type === "withdrawal" ? "var(--red)" : "var(--green)" }}>
                    {t.type === "withdrawal" ? "-" : "+"}{fmt(t.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Session Page ──────────────────────────────────────────────
function SessionPage({ atm, currentUserData, onLogout, onWithdraw, onDeposit, users, show }: {
  atm: ReturnType<typeof useATMState>;
  currentUserData: ReturnType<typeof useUsers>[string] | null;
  onLogout: () => void;
  onWithdraw: (userId: string, amount: number) => void;
  onDeposit:  (userId: string, amount: number) => void;
  users: ReturnType<typeof useUsers>;
  show: (msg: string, kind?: "success"|"error"|"info") => void;
}) {
  const [amount, setAmount] = useState("");
  const userId = String(atm.currentUser);

  function doWithdraw() { onWithdraw(userId, parseFloat(amount) || 0); setAmount(""); }
  function doDeposit()  { onDeposit(userId,  parseFloat(amount) || 0); setAmount(""); }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">ATM Session</h1>
        <p className="page-subtitle">Fingerprint-authenticated session control</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Fingerprint Scanner */}
        <div className="card">
          <div className="card-header"><span className="card-title">Fingerprint Scanner</span></div>
          <div className="fp-scanner">
            <div className={`fp-ring ${atm.authenticated ? "active" : ""}`}>
              <Fingerprint size={52} color={atm.authenticated ? "var(--green)" : "var(--accent)"} strokeWidth={1.2} />
            </div>
            <div>
              <div className={`fp-status-text ${atm.authenticated ? "active" : ""}`}>
                {atm.authenticated ? "✓ Authenticated" : "Waiting for scan…"}
              </div>
              {atm.authenticated && (
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>
                  User #{atm.currentUser} · {atm.loginType}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Info + Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {atm.authenticated && currentUserData ? (
            <>
              <div className="session-panel" style={{ margin: 0 }}>
                <div className="session-title">Logged In As</div>
                <div className="session-row">
                  <div>
                    <div className="session-user-name">{currentUserData.name}</div>
                    <div className="session-meta">
                      <div className="session-meta-item">
                        <span className="session-meta-label">Balance</span>
                        <span className="session-meta-value" style={{ color: "var(--green)", fontSize: 18 }}>{fmt(currentUserData.balance)}</span>
                      </div>
                      <div className="session-meta-item">
                        <span className="session-meta-label">Account</span>
                        <span className="session-meta-value">{currentUserData.accountNumber}</span>
                      </div>
                    </div>
                  </div>
                  <div className="session-avatar">{initials(currentUserData.name)}</div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="card">
                <div className="card-header"><span className="card-title">ATM Operations</span></div>
                <div className="card-body">
                  <div className="amount-input-wrap">
                    <label>Amount</label>
                    <span className="amount-prefix">₹</span>
                    <input
                      id="atm-amount-input"
                      className="amount-input"
                      type="number"
                      min="1"
                      step="100"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="atm-actions">
                    <button id="btn-withdraw" className="atm-btn danger" onClick={doWithdraw} disabled={!amount}>
                      <ArrowUpRight size={16} /> Withdraw
                    </button>
                    <button id="btn-deposit" className="atm-btn primary" onClick={doDeposit} disabled={!amount}>
                      <ArrowDownLeft size={16} /> Deposit
                    </button>
                    <button id="btn-logout" className="atm-btn danger" onClick={onLogout} style={{ gridColumn: "1/-1" }}>
                      <LogOut size={16} /> End Session (Force Logout)
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ flex: 1 }}>
              <div className="card-body">
                <div className="empty-state">
                  <Fingerprint size={56} />
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-secondary)" }}>No Active Session</h2>
                  <p>Place your finger on the ESP32 fingerprint sensor to start a session.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Users Page ────────────────────────────────────────────────
function UsersPage({ users, atm }: { users: ReturnType<typeof useUsers>; atm: ReturnType<typeof useATMState> }) {
  const list = Object.entries(users).filter(([k]) => k !== "_comment");

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Registered Users</h1>
        <p className="page-subtitle">{list.length} fingerprint-registered account{list.length !== 1 ? "s" : ""}</p>
      </div>

      {list.length === 0 ? (
        <div className="card"><div className="card-body">
          <div className="empty-state">
            <Users size={56} />
            <p>No users found in Firebase. Add users via the database JSON.</p>
          </div>
        </div></div>
      ) : (
        <div className="users-grid">
          {list.map(([id, user]) => (
            <div key={id} className="user-card">
              <div className="user-card-header">
                <div className="user-avatar">{initials(user.name)}</div>
                <div style={{ flex: 1 }}>
                  <div className="user-name">{user.name}</div>
                  <div className="user-fp-id">FP ID #{user.fingerprintId ?? id}</div>
                </div>
                {atm.currentUser === parseInt(id) && (
                  <span className="pill green">Active</span>
                )}
              </div>
              <div className="user-balance-label">Current Balance</div>
              <div className="user-balance">{fmt(user.balance ?? 0)}</div>
              <div className="user-account">{user.accountNumber}</div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <span className={`pill ${user.registered ? "green" : "red"}`}>
                  {user.registered ? "Registered" : "Unregistered"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Transactions Page ─────────────────────────────────────────
function TransactionsPage({ transactions, users }: { transactions: Transaction[]; users: ReturnType<typeof useUsers> }) {
  const [filter, setFilter] = useState<"all" | "withdrawal" | "deposit">("all");
  const filtered = transactions.filter((t) => filter === "all" || t.type === filter);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Transactions</h1>
        <p className="page-subtitle">{transactions.length} total records</p>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {(["all", "withdrawal", "deposit"] as const).map((f) => (
          <button
            key={f}
            id={`filter-${f}`}
            className={`atm-btn ${filter === f ? "primary" : ""}`}
            style={{ padding: "8px 18px" }}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "withdrawal" ? "Withdrawals" : "Deposits"}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>User</th>
                <th>Amount</th>
                <th>Balance Before</th>
                <th>Balance After</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <Receipt size={40} />
                      <p>No transactions found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const userName = users[String(t.userId)]?.name ?? `User #${t.userId}`;
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.type === "withdrawal" ? "var(--red-dim)" : "var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {t.type === "withdrawal"
                              ? <ArrowUpRight size={14} color="var(--red)" />
                              : <ArrowDownLeft size={14} color="var(--green)" />}
                          </div>
                          <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{t.type}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{userName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>#{t.userId}</div>
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: t.type === "withdrawal" ? "var(--red)" : "var(--green)" }}>
                          {t.type === "withdrawal" ? "-" : "+"}{fmt(t.amount)}
                        </span>
                      </td>
                      <td className="mono">{fmt(t.balanceBefore)}</td>
                      <td className="mono">{fmt(t.balanceAfter)}</td>
                      <td><span className={`pill ${t.status === "success" ? "green" : "red"}`}>{t.status}</span></td>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Clock size={12} /> {fmtDate(t.timestamp)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
