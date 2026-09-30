import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { push, ref, set } from "firebase/database";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { useATM } from "@/store/atm";
import { useSessionGuard } from "@/components/atm/SessionGuard";
import { ReceiptModal, type ReceiptData } from "@/components/atm/ReceiptModal";

export const Route = createFileRoute("/balance")({
  ssr: false,
  component: CheckBalance,
});

function inr(n: number) {
  return "₹ " + n.toLocaleString("en-IN");
}

function CheckBalance() {
  const navigate = useNavigate();
  const currentUser = useSessionGuard();
  const userData = useATM((s) => s.userData);
  const [display, setDisplay] = useState(0);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const target = userData?.balance ?? 0;

  useEffect(() => {
    if (!target) return;
    let frame = 0;
    const start = performance.now();
    const dur = 700;
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setDisplay(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const refresh = () => setDisplay(target);

  const generateReceipt = async () => {
    if (!currentUser || !userData) return;
    const time = new Date().toISOString();
    const node = push(ref(db, "receipts"));
    const payload = {
      type: "balance_check" as const,
      amount: 0,
      balance: userData.balance,
      time,
      userID: currentUser,
    };
    await set(node, payload);
    setReceipt({
      id: node.key ?? "—",
      ...payload,
      name: userData.name,
    });
  };

  if (!currentUser || !userData) return null;

  return (
    <main className="relative min-h-screen p-6 grid-bg fade-in">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-mono uppercase tracking-widest hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Dashboard
      </Link>

      <section className="mx-auto mt-12 max-w-2xl rounded-2xl glass neon-border p-10 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {userData.name} • #{currentUser}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">Available Balance</div>
        <div className="mt-4 font-mono text-6xl font-bold neon-text">{inr(display)}</div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-mono uppercase tracking-widest hover:border-foreground/40"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={generateReceipt}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-mono font-bold uppercase tracking-widest text-primary-foreground"
            style={{ background: "var(--teal)", boxShadow: "0 0 20px var(--teal-glow)" }}
          >
            Generate Receipt
          </button>
        </div>
      </section>

      <ReceiptModal
        receipt={receipt}
        onClose={() => {
          setReceipt(null);
          navigate({ to: "/dashboard" });
        }}
      />
    </main>
  );
}
