import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { get, onValue, ref } from "firebase/database";
import { Fingerprint, KeyRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useATM } from "@/store/atm";
import { StatusBar } from "@/components/atm/StatusBar";
import { FingerprintIcon } from "@/components/atm/FingerprintIcon";

export const Route = createFileRoute("/home")({
  ssr: false,
  component: HomeScreen,
});

function HomeScreen() {
  const navigate = useNavigate();
  const setSession = useATM((s) => s.setSession);

  // Background listener for ESP32 walk-up fingerprint
  useEffect(() => {
    let lastUser = 0;
    const u = onValue(ref(db, "atm"), async (snap) => {
      const v = snap.val() ?? {};
      const cu = Number(v.currentUser ?? 0);
      const lt = v.loginType ?? "";
      if (cu > 0 && lt === "fingerprint" && cu !== lastUser) {
        lastUser = cu;
        // load user
        const userSnap = await get(ref(db, `users/${cu}`));
        const ud = userSnap.val();
        if (ud) {
          setSession(cu, ud, "fingerprint");
          navigate({ to: "/dashboard" });
        }
      }
    });
    return () => u();
  }, [navigate, setSession]);

  return (
    <main className="relative flex min-h-screen flex-col grid-bg">
      <header className="flex items-center justify-between p-6">
        <div className="font-mono text-xl font-bold">
          Secure<span className="neon-text">ATM</span>
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-mono">
          Welcome • Please authenticate
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6">
        <div className="grid w-full gap-6 md:grid-cols-2">
          <button
            onClick={() => navigate({ to: "/fingerprint-login" })}
            className="group relative flex flex-col items-center gap-6 rounded-2xl glass p-10 transition-all hover:-translate-y-1 hover:neon-border min-h-[320px]"
          >
            <div className="relative flex h-32 w-32 items-center justify-center">
              <div className="pulse-ring absolute inset-0 rounded-full" />
              <FingerprintIcon size={90} className="neon-text" />
            </div>
            <div className="text-center">
              <div className="font-mono text-xl font-bold">Fingerprint Login</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Touch the ESP32 scanner to authenticate
              </div>
            </div>
            <Fingerprint className="absolute right-4 top-4 h-4 w-4 opacity-30" />
          </button>

          <button
            onClick={() => navigate({ to: "/pin-login" })}
            className="group relative flex flex-col items-center gap-6 rounded-2xl glass p-10 transition-all hover:-translate-y-1 hover:border-foreground/40 min-h-[320px]"
          >
            <div className="flex h-32 w-32 items-center justify-center rounded-full border border-border bg-secondary/40">
              <KeyRound className="h-14 w-14 text-muted-foreground" />
            </div>
            <div className="text-center">
              <div className="font-mono text-xl font-bold">User ID + PIN</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Sign in with your account ID and 4-digit PIN
              </div>
            </div>
          </button>
        </div>
      </section>

      <footer className="border-t border-border/50 p-4">
        <StatusBar />
      </footer>
    </main>
  );
}
