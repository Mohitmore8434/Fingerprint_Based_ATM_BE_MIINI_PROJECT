import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, update } from "firebase/database";
import { toast } from "sonner";
import {
  CircleDollarSign,
  FileText,
  LogOut,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useATM } from "@/store/atm";
import { useSessionGuard } from "@/components/atm/SessionGuard";
import { NavCard } from "@/components/atm/NavCard";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  component: Dashboard,
});

interface ReceiptRow {
  id: string;
  type: "deposit" | "withdrawal" | "balance_check";
  amount: number;
  balance: number;
  time: string;
  userID: number;
}

function inr(n: number) {
  return "₹ " + n.toLocaleString("en-IN");
}

function Dashboard() {
  const navigate = useNavigate();
  const currentUser = useSessionGuard();
  const userData = useATM((s) => s.userData);
  const updateBalance = useATM((s) => s.updateBalance);
  const clearSession = useATM((s) => s.clearSession);

  const [now, setNow] = useState(() => new Date());
  const [recent, setRecent] = useState<ReceiptRow[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [timeout, setTimeoutSec] = useState(60);
  const [warn, setWarn] = useState(false);
  const [warnSec, setWarnSec] = useState(10);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Live balance
  useEffect(() => {
    if (!currentUser) return;
    const u = onValue(ref(db, `users/${currentUser}/balance`), (s) => {
      const b = Number(s.val() ?? 0);
      updateBalance(b);
      setLastUpdate(new Date());
    });
    return () => u();
  }, [currentUser, updateBalance]);

  // Recent receipts
  useEffect(() => {
    if (!currentUser) return;
    const u = onValue(ref(db, "receipts"), (s) => {
      const v = s.val() ?? {};
      const list: ReceiptRow[] = Object.entries(v)
        .map(([id, r]: [string, any]) => ({ id, ...r }))
        .filter((r) => Number(r.userID) === currentUser)
        .sort((a, b) => (a.time < b.time ? 1 : -1))
        .slice(0, 3);
      setRecent(list);
    });
    return () => u();
  }, [currentUser]);

  // Inactivity timer
  useEffect(() => {
    const reset = () => {
      setTimeoutSec(60);
      setWarn(false);
      setWarnSec(10);
    };
    window.addEventListener("click", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.removeEventListener("click", reset);
      window.removeEventListener("keydown", reset);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setTimeoutSec((s) => {
        if (s <= 1) {
          setWarn(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!warn) return;
    const t = setInterval(() => {
      setWarnSec((s) => {
        if (s <= 1) {
          void doLogout();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warn]);

  const doLogout = async () => {
    const name = userData?.name;
    try {
      await update(ref(db, "atm"), {
        currentUser: 0,
        authenticated: false,
        loginType: "",
        pinEntered: "",
      });
    } catch {
      /* ignore */
    }
    clearSession();
    toast.success(`Session Ended — Thank You, ${name ?? ""}`);
    navigate({ to: "/home" });
  };

  if (!currentUser || !userData) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="font-mono text-sm text-muted-foreground">Loading session...</div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen p-6 grid-bg fade-in">
      {warn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="w-full max-w-sm rounded-2xl glass p-6 text-center">
            <h3 className="font-mono text-xl font-bold" style={{ color: "var(--danger)" }}>
              Session expiring in {warnSec}s
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You will be logged out automatically.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setWarn(false);
                  setWarnSec(10);
                  setTimeoutSec(60);
                }}
                className="flex-1 rounded-md py-2 font-mono text-sm font-bold text-primary-foreground"
                style={{ background: "var(--teal)" }}
              >
                Stay
              </button>
              <button
                onClick={doLogout}
                className="flex-1 rounded-md border border-border py-2 font-mono text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <div className="font-mono text-2xl font-bold">
            Welcome, <span className="neon-text">{userData.name}</span>
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            User #{currentUser} • Session timeout in {timeout}s
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-sm text-muted-foreground">
            {now.toLocaleString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              day: "2-digit",
              month: "short",
            })}
          </div>
          <button
            onClick={doLogout}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-mono uppercase tracking-widest hover:border-foreground/40"
            style={{ color: "var(--danger)" }}
          >
            <LogOut className="h-3 w-3" /> Logout
          </button>
        </div>
      </header>

      <section className="mx-auto mt-6 max-w-6xl rounded-2xl glass neon-border p-8">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Available Balance
        </div>
        <div className="mt-2 font-mono text-5xl font-bold neon-text">
          {inr(userData.balance)}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Last updated: {lastUpdate.toLocaleTimeString("en-IN")}
        </div>
      </section>

      <section className="mx-auto mt-6 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NavCard
          to="/balance"
          icon={<CircleDollarSign className="h-7 w-7" />}
          title="Check Balance"
          subtitle="View current account balance"
        />
        <NavCard
          to="/withdraw"
          icon={<TrendingDown className="h-7 w-7" />}
          title="Withdraw"
          subtitle="Cash out from your account"
        />
        <NavCard
          to="/deposit"
          icon={<TrendingUp className="h-7 w-7" />}
          title="Deposit"
          subtitle="Add cash to your account"
        />
        <NavCard
          to="/statement"
          icon={<FileText className="h-7 w-7" />}
          title="Bank Statement"
          subtitle="Full transaction history"
        />
      </section>

      <section className="mx-auto mt-6 max-w-6xl rounded-2xl glass p-6">
        <div className="flex items-center justify-between">
          <div className="font-mono text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Recent Activity
          </div>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-4 space-y-2">
          {recent.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No transactions yet.
            </div>
          )}
          {recent.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-3"
            >
              <div>
                <div className="font-mono text-sm font-bold">
                  {r.type === "deposit"
                    ? "Deposit"
                    : r.type === "withdrawal"
                      ? "Withdrawal"
                      : "Balance Check"}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {new Date(r.time).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="text-right">
                <div
                  className="font-mono text-sm font-bold"
                  style={{
                    color:
                      r.type === "deposit"
                        ? "var(--teal)"
                        : r.type === "withdrawal"
                          ? "var(--danger)"
                          : "var(--foreground)",
                  }}
                >
                  {r.type === "balance_check"
                    ? "—"
                    : (r.type === "deposit" ? "+" : "-") + inr(Number(r.amount))}
                </div>
                <div className="text-[10px] text-muted-foreground">bal {inr(Number(r.balance))}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
