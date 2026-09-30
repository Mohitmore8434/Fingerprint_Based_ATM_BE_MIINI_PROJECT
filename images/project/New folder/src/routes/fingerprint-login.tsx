import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { get, onValue, ref } from "firebase/database";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { useATM } from "@/store/atm";
import { FingerprintIcon } from "@/components/atm/FingerprintIcon";

export const Route = createFileRoute("/fingerprint-login")({
  ssr: false,
  component: FingerprintLogin,
});

function FingerprintLogin() {
  const navigate = useNavigate();
  const setSession = useATM((s) => s.setSession);
  const [status, setStatus] = useState<"waiting" | "success" | "error">("waiting");
  const [esp32, setEsp32] = useState(false);

  useEffect(() => {
    const u1 = onValue(ref(db, "atm/authenticated"), (s) => setEsp32(!!s.val()));
    let done = false;
    const u2 = onValue(ref(db, "atm"), async (snap) => {
      if (done) return;
      const v = snap.val() ?? {};
      const cu = Number(v.currentUser ?? 0);
      const lt = v.loginType ?? "";
      const err = v.lastError;
      if (err === "no_match" && status !== "success") {
        setStatus("error");
        setTimeout(() => setStatus("waiting"), 1500);
        return;
      }
      if (cu > 0 && lt === "fingerprint") {
        done = true;
        setStatus("success");
        const userSnap = await get(ref(db, `users/${cu}`));
        const ud = userSnap.val();
        setTimeout(() => {
          if (ud) {
            setSession(cu, ud, "fingerprint");
            navigate({ to: "/dashboard" });
          }
        }, 800);
      }
    });
    return () => {
      u1();
      u2();
    };
  }, [navigate, setSession, status]);

  const color =
    status === "success" ? "var(--teal)" : status === "error" ? "var(--danger)" : "var(--teal)";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center grid-bg">
      <Link
        to="/home"
        className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>

      <div
        className="relative flex h-64 w-64 items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${color} 15%, transparent), transparent 70%)`,
        }}
      >
        {status === "waiting" && <div className="pulse-ring absolute inset-8 rounded-full" />}
        <FingerprintIcon size={160} className={status === "success" ? "" : "blink"} />
        <style>{`
          .pulse-ring::before, .pulse-ring::after { border-color: ${color}; }
        `}</style>
      </div>

      <h2 className="mt-10 font-mono text-2xl font-bold" style={{ color }}>
        {status === "success"
          ? "Fingerprint Recognized ✓"
          : status === "error"
            ? "Fingerprint Not Recognized ✗"
            : "Place your finger on the scanner"}
      </h2>

      <p className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground font-mono">
        {esp32 ? "ESP32 ready" : "Waiting for ESP32 device..."}
      </p>
    </main>
  );
}
