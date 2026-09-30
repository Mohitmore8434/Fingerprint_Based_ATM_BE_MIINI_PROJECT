import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { push, ref, set, update } from "firebase/database";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useATM } from "@/store/atm";
import { useSessionGuard } from "@/components/atm/SessionGuard";
import { ReceiptModal, type ReceiptData } from "@/components/atm/ReceiptModal";
import { CameraCapture } from "@/components/atm/CameraCapture";

export const Route = createFileRoute("/withdraw")({
  ssr: false,
  component: Withdraw,
});

const QUICK = [500, 1000, 2000, 5000, 10000];

function inr(n: number) {
  return "₹ " + n.toLocaleString("en-IN");
}

function Withdraw() {
  const navigate = useNavigate();
  const currentUser = useSessionGuard();
  const userData = useATM((s) => s.userData);
  const updateBalance = useATM((s) => s.updateBalance);
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [camera, setCamera] = useState(false);
  const [shake, setShake] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [pendingReceipt, setPendingReceipt] = useState<ReceiptData | null>(null);

  if (!currentUser || !userData) return null;

  const value = Number(amount);

  const validate = (): string | null => {
    if (!value || isNaN(value) || value <= 0) return "Enter a valid amount";
    if (value % 100 !== 0) return "Amount must be a multiple of ₹100";
    if (value > userData.balance) return "Insufficient Balance";
    return null;
  };

  const onWithdraw = () => {
    const err = validate();
    if (err) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(err);
      return;
    }
    setConfirm(true);
  };

  const execute = async () => {
    setConfirm(false);
    try {
      const newBalance = userData.balance - value;
      await update(ref(db, `users/${currentUser}`), { balance: newBalance });
      updateBalance(newBalance);
      const time = new Date().toISOString();
      const node = push(ref(db, "receipts"));
      const payload = {
        type: "withdrawal" as const,
        amount: value,
        balance: newBalance,
        time,
        userID: currentUser,
      };
      await set(node, payload);
      setPendingReceipt({
        id: node.key ?? "—",
        ...payload,
        name: userData.name,
      });
      setCamera(true);
    } catch {
      toast.error("Transaction failed");
    }
  };

  const finishCapture = async (_img: string | null) => {
    setCamera(false);
    if (pendingReceipt) {
      setReceipt(pendingReceipt);
      setPendingReceipt(null);
    }
  };

  return (
    <main className="relative min-h-screen p-6 grid-bg fade-in">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-mono uppercase tracking-widest hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Dashboard
      </Link>

      <section className={`mx-auto mt-10 max-w-2xl rounded-2xl glass p-8 ${shake ? "shake" : ""}`}>
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Available
        </div>
        <div className="font-mono text-3xl font-bold">{inr(userData.balance)}</div>

        <div className="mt-8">
          <label className="block text-xs uppercase tracking-widest text-muted-foreground">
            Amount to withdraw (multiples of ₹100)
          </label>
          <div className="mt-2 flex items-center rounded-lg neon-border bg-input px-4">
            <span className="font-mono text-2xl text-muted-foreground">₹</span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className="w-full bg-transparent px-3 py-4 font-mono text-3xl outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              className="rounded-full border border-border px-4 py-2 font-mono text-sm hover:neon-border"
            >
              ₹{q.toLocaleString("en-IN")}
            </button>
          ))}
        </div>

        <button
          onClick={onWithdraw}
          className="mt-8 w-full rounded-lg py-4 font-mono text-lg font-bold uppercase tracking-widest text-primary-foreground"
          style={{ background: "var(--teal)", boxShadow: "0 0 24px var(--teal-glow)" }}
        >
          Withdraw
        </button>
      </section>

      {confirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur p-4">
          <div className="w-full max-w-sm rounded-2xl glass p-6 text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Confirm Withdrawal
            </div>
            <div className="mt-3 font-mono text-3xl font-bold neon-text">{inr(value)}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              New balance: {inr(userData.balance - value)}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 rounded-md border border-border py-2 text-sm font-mono"
              >
                Cancel
              </button>
              <button
                onClick={execute}
                className="flex-1 rounded-md py-2 text-sm font-mono font-bold text-primary-foreground"
                style={{ background: "var(--teal)" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <CameraCapture open={camera} onComplete={finishCapture} />

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
