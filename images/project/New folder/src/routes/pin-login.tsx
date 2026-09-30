import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { get, ref, update } from "firebase/database";
import { ArrowLeft, Delete } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useATM } from "@/store/atm";

export const Route = createFileRoute("/pin-login")({
  ssr: false,
  component: PinLogin,
});

function PinLogin() {
  const navigate = useNavigate();
  const setSession = useATM((s) => s.setSession);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [active, setActive] = useState<"id" | "pin">("id");
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedFor, setLockedFor] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);

  const press = (key: string) => {
    if (lockedFor > 0) return;
    const target = active;
    if (target === "id") {
      if (userId.length < 6) setUserId((u) => u + key);
    } else {
      if (pin.length < 4) setPin((p) => p + key);
    }
  };

  const clear = () => {
    if (active === "id") setUserId("");
    else setPin("");
  };

  const submit = async () => {
    if (lockedFor > 0 || loading) return;
    if (!userId || pin.length !== 4) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error("Enter User ID and 4-digit PIN");
      return;
    }
    setLoading(true);
    try {
      const snap = await get(ref(db, `users/${userId}`));
      const ud = snap.val();
      if (!ud || String(ud.pin) !== pin) {
        const next = attempts + 1;
        setAttempts(next);
        setShake(true);
        setTimeout(() => setShake(false), 500);
        toast.error("Invalid ID or PIN");
        setPin("");
        if (next >= 3) {
          toast.error("Account Temporarily Locked — 30s");
          setLockedFor(30);
          setAttempts(0);
        }
        return;
      }
      await update(ref(db, "atm"), {
        currentUser: Number(userId),
        loginType: "pin",
        authenticated: true,
        pinEntered: pin,
      });
      setSession(Number(userId), ud, "pin");
      toast.success(`Welcome, ${ud.name}`);
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") {
        if (active === "id") setUserId((u) => u.slice(0, -1));
        else setPin((p) => p.slice(0, -1));
      } else if (e.key === "Enter") submit();
      else if (e.key === "Escape") navigate({ to: "/home" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId, pin, lockedFor]);

  const pinDisplay = "●".repeat(pin.length) + "○".repeat(4 - pin.length);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center grid-bg p-6">
      <Link
        to="/home"
        className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>

      <div
        className={`w-full max-w-md rounded-2xl glass p-8 ${shake ? "shake" : ""}`}
      >
        <h2 className="font-mono text-2xl font-bold">Secure Sign-In</h2>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Enter your credentials
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <div className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
              User ID
            </div>
            <input
              onFocus={() => setActive("id")}
              value={userId}
              readOnly
              placeholder="••••"
              className={`w-full rounded-lg border bg-input px-4 py-3 font-mono text-lg outline-none transition-all ${
                active === "id" ? "neon-border" : "border-border"
              }`}
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
              PIN
            </div>
            <button
              onClick={() => setActive("pin")}
              className={`w-full rounded-lg border bg-input px-4 py-3 text-left font-mono text-2xl tracking-[0.6em] outline-none transition-all ${
                active === "pin" ? "neon-border" : "border-border"
              }`}
            >
              {pinDisplay}
            </button>
          </label>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
            <KeypadBtn key={k} onClick={() => press(k)} disabled={lockedFor > 0}>
              {k}
            </KeypadBtn>
          ))}
          <KeypadBtn onClick={clear} disabled={lockedFor > 0}>
            <Delete className="mx-auto h-5 w-5" />
          </KeypadBtn>
          <KeypadBtn onClick={() => press("0")} disabled={lockedFor > 0}>
            0
          </KeypadBtn>
          <KeypadBtn
            onClick={submit}
            disabled={lockedFor > 0 || loading}
            variant="primary"
          >
            {loading ? "..." : "ENTER"}
          </KeypadBtn>
        </div>

        {lockedFor > 0 && (
          <div
            className="mt-4 rounded-lg border p-3 text-center font-mono text-sm"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            Locked — {lockedFor}s remaining
          </div>
        )}
      </div>
    </main>
  );
}

function KeypadBtn({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-14 rounded-lg font-mono text-xl font-bold transition-all disabled:opacity-40 active:scale-95 ${
        variant === "primary"
          ? "text-primary-foreground"
          : "bg-secondary text-foreground hover:bg-secondary/70"
      }`}
      style={
        variant === "primary"
          ? { background: "var(--teal)", boxShadow: "0 0 18px var(--teal-glow)" }
          : undefined
      }
    >
      {children}
    </button>
  );
}
