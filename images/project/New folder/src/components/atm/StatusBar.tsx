import { useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";

const HEARTBEAT_WINDOW_MS = 15000;

export function StatusBar() {
  const [fbConnected, setFbConnected] = useState(false);
  const [online, setOnline] = useState<boolean>(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const onlineRef = useRef(false);
  const lastSeenRef = useRef<number | null>(null);

  useEffect(() => {
    const u1 = onValue(ref(db, ".info/connected"), (s) => {
      setFbConnected(!!s.val());
    });
    const u2 = onValue(ref(db, "esp32/online"), (s) => {
      const v = s.val();
      const b = v === true || v === "true" || v === 1;
      onlineRef.current = b;
      setOnline(b);
      console.log("ESP32 online:", v);
    });
    const u3 = onValue(ref(db, "esp32/lastSeen"), (s) => {
      const v = s.val();
      const n = typeof v === "number" && Number.isFinite(v) ? v : null;
      lastSeenRef.current = n;
      setLastSeen(n);
      console.log("ESP32 lastSeen:", v);
      if (n != null) console.log("Time difference:", Date.now() - n);
    });
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  // Tick to re-evaluate freshness window
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);

  const isEsp32Online =
    online === true && lastSeen != null && now - lastSeen < HEARTBEAT_WINDOW_MS;

  return (
    <div className="flex items-center justify-center gap-6 text-xs font-mono uppercase tracking-widest text-muted-foreground">
      <Dot ok={fbConnected} label={fbConnected ? "Firebase Connected" : "Firebase Offline"} />
      <Dot ok={isEsp32Online} label={isEsp32Online ? "ESP32 Online" : "ESP32 Offline"} />
    </div>
  );
}

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={"inline-block h-2 w-2 rounded-full " + (ok ? "animate-pulse" : "")}
        style={{
          background: ok ? "var(--teal)" : "var(--danger)",
          boxShadow: ok
            ? "0 0 10px var(--teal-glow)"
            : "0 0 10px color-mix(in oklab, var(--danger) 50%, transparent)",
        }}
      />
      <span>{label}</span>
    </div>
  );
}
