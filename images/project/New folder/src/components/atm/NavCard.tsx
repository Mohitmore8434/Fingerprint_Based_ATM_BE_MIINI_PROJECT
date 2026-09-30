import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface NavCardProps {
  to: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  variant?: "default" | "danger";
  onClick?: () => void;
}

export function NavCard({ to, icon, title, subtitle, variant = "default", onClick }: NavCardProps) {
  const cls =
    "group relative flex flex-col items-start gap-3 rounded-xl glass p-6 transition-all duration-200 hover:-translate-y-1 hover:neon-border";
  const content = (
    <>
      <div
        className="text-3xl"
        style={{
          color: variant === "danger" ? "var(--danger)" : "var(--teal)",
          filter: "drop-shadow(0 0 8px var(--teal-glow))",
        }}
      >
        {icon}
      </div>
      <div>
        <div className="font-mono text-lg font-bold text-foreground">{title}</div>
        {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={cls + " text-left"}>
        {content}
      </button>
    );
  }
  return (
    <Link to={to} className={cls}>
      {content}
    </Link>
  );
}
