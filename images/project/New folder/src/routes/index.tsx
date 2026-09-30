import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { FingerprintIcon } from "@/components/atm/FingerprintIcon";

export const Route = createFileRoute("/")({
  ssr: false,
  component: SplashScreen,
});

const STEPS = [
  "Initializing SecureATM...",
  "Connecting to Firebase...",
  "Checking ESP32 Status...",
  "System Ready ✓",
];

function SplashScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stepTimer: ReturnType<typeof setTimeout>;
    let retryTimer: ReturnType<typeof setTimeout>;
    let navTimer: ReturnType<typeof setTimeout>;

    const advance = () => {
      stepTimer = setTimeout(() => setStep(1), 400);
    };

    const checkFirebase = async () => {
      try {
        setError(false);
        await get(ref(db, "atm/currentUser"));
        if (cancelled) return;
        setStep(2);
        await get(ref(db, "atm/authenticated"));
        if (cancelled) return;
        setStep(3);
        navTimer = setTimeout(() => {
          if (!cancelled) navigate({ to: "/home" });
        }, 900);
      } catch {
        if (cancelled) return;
        setError(true);
        retryTimer = setTimeout(checkFirebase, 3000);
      }
    };

    advance();
    const t = setTimeout(checkFirebase, 800);
    return () => {
      cancelled = true;
      clearTimeout(stepTimer);
      clearTimeout(retryTimer);
      clearTimeout(navTimer);
      clearTimeout(t);
    };
  }, [navigate]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center grid-bg">
      <div className="relative flex h-40 w-40 items-center justify-center">
        <div className="pulse-ring absolute inset-0 rounded-full" />
        <FingerprintIcon size={120} className="neon-text" />
      </div>
      <h1 className="mt-10 font-mono text-4xl font-bold tracking-tight">
        Secure<span className="neon-text">ATM</span>
      </h1>
      <p className="mt-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">
        IoT Biometric Terminal
      </p>

      <div className="mt-12 flex flex-col items-start gap-2 font-mono text-sm">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <span
              className="inline-block h-2 w-2 rounded-full transition-all"
              style={{
                background: i < step ? "var(--teal)" : i === step ? "var(--teal)" : "var(--border)",
                boxShadow: i <= step ? "0 0 10px var(--teal-glow)" : "none",
              }}
            />
            <span style={{ opacity: i <= step ? 1 : 0.4 }}>{s}</span>
          </div>
        ))}
        {error && (
          <div className="mt-4 font-mono text-sm" style={{ color: "var(--danger)" }}>
            Connection Error — Retrying...
          </div>
        )}
      </div>

      <div className="absolute bottom-6 font-mono text-xs text-muted-foreground">
        SecureATM v2.0
      </div>
    </main>
  );
}
