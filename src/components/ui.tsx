import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

export function LogoMark({ size = 34 }: { size?: number }) {
  const gradientId = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="15" fill={`url(#${gradientId})`} />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <g
        stroke="#ffffff"
        strokeWidth="4.5"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M26 14 H20 a6 6 0 0 0 0 12 H14" />
        <path d="M14 38 v6 a6 6 0 0 0 12 0 v-6" />
        <path d="M38 50 h6 a6 6 0 0 0 0 -12 h6" />
        <path d="M50 26 v-6 a6 6 0 0 0 -12 0 v6" />
      </g>
      <circle cx="26" cy="26" r="4.2" fill="#ffffff" />
    </svg>
  );
}

export function Logo({
  dark = false,
  size = 34,
  wordmark = true,
}: {
  dark?: boolean;
  size?: number;
  wordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      {wordmark && (
        <span
          className={`font-display text-[17px] font-bold tracking-tight ${
            dark ? "text-white" : "text-ink-900"
          }`}
        >
          Puzzle<span className={dark ? "text-brand-300" : "text-brand-600"}>Together</span>
        </span>
      )}
    </span>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

export function Modal({
  children,
  onClose,
  dismissable = true,
}: {
  children: ReactNode;
  onClose?: () => void;
  dismissable?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className="animate-pop-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6", "#ec4899"];

export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 5 + Math.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        duration: 3.2 + Math.random() * 3.5,
        delay: Math.random() * 2.2,
        sway: (Math.random() - 0.5) * 240,
        spin: 360 + Math.random() * 540,
        round: Math.random() > 0.7,
        opacity: 0.55 + Math.random() * 0.45,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.55,
            backgroundColor: p.color,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--sway" as string]: `${p.sway}px`,
            ["--spin" as string]: `${p.spin}deg`,
            borderRadius: p.round ? "50%" : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** Small "copied" tooltip helper hook for buttons. */
export function useCopied(resetMs = 1600): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const mark = () => {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), resetMs);
  };
  return [copied, mark];
}
