import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Camera, Loader2 } from "lucide-react";

interface CameraCaptureProps {
  open: boolean;
  onComplete: (image: string | null) => void;
}

/** Silent webcam capture overlay. Auto-snaps after 1.5s. */
export function CameraCapture({ open, onComplete }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      setError(false);
      return;
    }
    const errTimer = setTimeout(() => {
      if (!ready) {
        setError(true);
        setTimeout(() => onComplete(null), 600);
      }
    }, 4000);
    return () => clearTimeout(errTimer);
  }, [open, ready, onComplete]);

  useEffect(() => {
    if (!open || !ready) return;
    const t = setTimeout(() => {
      try {
        const shot = webcamRef.current?.getScreenshot({ width: 320, height: 240 }) ?? null;
        onComplete(shot);
      } catch {
        onComplete(null);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [open, ready, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md fade-in">
      <div className="flex flex-col items-center gap-6 rounded-2xl glass p-10">
        <div className="relative">
          <Camera className="h-12 w-12 neon-text" />
          <Loader2 className="absolute -right-2 -top-2 h-5 w-5 animate-spin neon-text" />
        </div>
        <div className="font-mono text-sm uppercase tracking-widest text-foreground">
          {error ? "Camera unavailable — proceeding" : "Capturing transaction evidence..."}
        </div>
        <div className="h-px w-40 bg-border" />
        <div className="text-[10px] text-muted-foreground">SecureATM Evidence System</div>
        <div className="pointer-events-none absolute opacity-0">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.5}
            videoConstraints={{ width: 320, height: 240, facingMode: "user" }}
            onUserMedia={() => setReady(true)}
            onUserMediaError={() => {
              setError(true);
              setTimeout(() => onComplete(null), 600);
            }}
          />
        </div>
      </div>
    </div>
  );
}
