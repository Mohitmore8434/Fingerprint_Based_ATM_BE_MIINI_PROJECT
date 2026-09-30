interface Props {
  size?: number;
  className?: string;
}
export function FingerprintIcon({ size = 96, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ filter: "drop-shadow(0 0 12px var(--teal-glow))" }}
    >
      <path d="M12 11c0 4-1 7-2 9" />
      <path d="M16 11.2c0 3-.7 5.5-1.6 7.7" />
      <path d="M8 12c0 3-.5 5.5-1.5 7.5" />
      <path d="M4.5 16c.4-1.3.5-2.6.5-4 0-4 3-7 7-7 1.9 0 3.5.6 4.8 1.6" />
      <path d="M19 6.5C17.1 4.9 14.7 4 12 4 6.5 4 2 8.5 2 14" />
      <path d="M22 12c0-1.5-.3-2.9-.8-4.1" />
      <path d="M12 8c2.2 0 4 1.8 4 4" />
    </svg>
  );
}
