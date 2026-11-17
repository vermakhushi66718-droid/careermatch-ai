import { ButtonHTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, cloneElement, forwardRef, isValidElement, useEffect, useId, useRef, useState, KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ---------- Button ---------- */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep shadow-[0_6px_16px_-6px_rgba(37,84,255,0.6)]",
  secondary: "bg-surface text-ink border border-line hover:border-[#c6d2ea] hover:bg-wash",
  soft: "bg-brand-soft text-brand-deep hover:bg-[#dbe5ff]",
  ghost: "text-slate hover:text-ink hover:bg-wash",
  danger: "bg-bad text-white hover:bg-[#b52f2f]",
};
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: BtnVariant; loading?: boolean; size?: "sm" | "md"; icon?: ReactNode; }
export const Button = forwardRef<HTMLButtonElement, BtnProps>(({ variant = "primary", loading, size = "md", icon, children, className, disabled, ...p }, ref) => (
  <button ref={ref} disabled={disabled || loading} {...p}
    className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-55 disabled:cursor-not-allowed select-none",
      size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-sm", BTN[variant], className)}>
    {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
    {children}
  </button>
));

/* ---------- Surfaces ---------- */
export const Card = ({ children, className, as: Tag = "div", ...p }: { children: ReactNode; className?: string; as?: any } & Record<string, any>) => (
  <Tag {...p} className={cx("bg-surface border border-line rounded-[20px] shadow-soft", className)}>{children}</Tag>
);

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-[28px] sm:text-[32px] leading-tight font-semibold">{title}</h1>
        {subtitle && <p className="text-slate mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Badges ---------- */
const TONES = {
  neutral: "bg-wash text-slate", brand: "bg-brand-soft text-brand-deep", good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad", navy: "bg-ink text-white",
};
export const Badge = ({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof TONES; className?: string }) => (
  <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>
);

/* ---------- Form controls ---------- */
export function Field({ label, error, hint, children, htmlFor }: { label?: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  const auto = useId();
  // Link the label to a single child control automatically, so every field is labelled for assistive tech.
  const single = isValidElement(children) ? (children as ReactElement<{ id?: string }>) : null;
  const id = htmlFor ?? single?.props.id ?? auto;
  const control = single && !single.props.id ? cloneElement(single, { id }) : children;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={single || htmlFor ? id : undefined} className="block text-sm font-semibold text-ink">{label}</label>}
      {control}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-slate">{hint}</p>}
      {error && <p id={`${id}-err`} className="text-xs text-bad font-medium" role="alert">{error}</p>}
    </div>
  );
}
const ctl = "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-mist transition-shadow focus:outline-none focus:ring-4 focus:ring-brand/15 focus:border-brand";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ invalid, className, ...p }, ref) =>
  <input ref={ref} {...p} className={cx(ctl, invalid ? "border-bad" : "border-line", className)} />);
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ invalid, className, ...p }, ref) =>
  <textarea ref={ref} {...p} className={cx(ctl, "min-h-[96px] resize-y", invalid ? "border-bad" : "border-line", className)} />);
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) =>
  <select ref={ref} {...p} className={cx(ctl, "border-line pr-8", className)}>{children}</select>);

/** Chips input for skills/roles: Enter or comma adds, Backspace removes the last. */
export function TagInput({ value, onChange, placeholder, suggestions = [], max = 60, id }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[]; max?: number; id?: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, "").trim();
    if (!t || value.length >= max || value.some((v) => v.toLowerCase() === t.toLowerCase())) { setDraft(""); return; }
    onChange([...value, t]); setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
    else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
  };
  const open = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-2 focus-within:ring-4 focus-within:ring-brand/15 focus-within:border-brand">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-brand-soft text-brand-deep text-[13px] font-semibold pl-2.5 pr-1 py-1">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))} className="rounded p-0.5 hover:bg-white/70"><X size={13} /></button>
          </span>
        ))}
        <input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder} className="flex-1 min-w-[120px] bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-mist" />
      </div>
      {open.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {open.map((s) => <button type="button" key={s} onClick={() => add(s)} className="text-xs rounded-full border border-line px-2.5 py-1 text-slate hover:border-brand hover:text-brand">+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

/* ---------- Feedback states ---------- */
export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} aria-hidden />;
export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cx("animate-spin text-brand", className)} />;

export function CardSkeletons({ count = 3, className = "h-36" }: { count?: number; className?: string }) {
  return <div className="space-y-4" aria-busy="true" aria-label="Loading">{Array.from({ length: count }).map((_, i) => <Skeleton key={i} className={cx("w-full rounded-[20px]", className)} />)}</div>;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-brand-soft text-brand mb-4">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="text-slate mt-1 max-w-md">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center text-center py-12 px-6">
      <div className="grid place-items-center h-12 w-12 rounded-2xl bg-bad-soft text-bad mb-3"><AlertTriangle size={22} /></div>
      <h3 className="font-semibold text-lg">This didn't load</h3>
      <p className="text-slate mt-1 max-w-md">{message}</p>
      {onRetry && <Button variant="secondary" className="mt-4" onClick={onRetry}>Try again</Button>}
    </Card>
  );
}

export function Notice({ tone = "info", children, action }: { tone?: "info" | "warn" | "bad" | "good"; children: ReactNode; action?: ReactNode }) {
  const t = { info: "bg-brand-soft text-ink-soft border-[#cddbff]", warn: "bg-warn-soft text-[#7a4d08] border-[#f3dcae]", bad: "bg-bad-soft text-[#8f2424] border-[#f5c7c7]", good: "bg-good-soft text-[#0b6b3c] border-[#bfe8d2]" }[tone];
  return <div className={cx("flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm", t)}><div className="flex-1 min-w-[200px]">{children}</div>{action}</div>;
}

/* ---------- Modal + confirm ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-end sm:place-items-center">
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.18 }}
            className={cx("relative bg-surface w-full max-h-[92vh] overflow-y-auto scroll-thin rounded-t-[24px] sm:rounded-[24px] shadow-lift p-6 outline-none", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 id={id} className="text-xl font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate hover:bg-wash"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel = "Confirm", danger, onConfirm, onClose }:
  { open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title}>
      <div className="text-slate">{body}</div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3 mt-6" aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} icon={<ChevronLeft size={16} />}>Previous</Button>
      <span className="text-sm text-slate">Page {page} of {totalPages}</span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next <ChevronRight size={16} /></Button>
    </nav>
  );
}

/* ---------- Signature element: match score ring ---------- */
const RING = { good: "#0f9f5a", brand: "#2554ff", warn: "#d28b13", bad: "#d03b3b" };
export function ScoreRing({ value, size = 56, stroke = 6, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const tone = value >= 75 ? "good" : value >= 50 ? "brand" : value >= 30 ? "warn" : "bad";
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${value} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9eef7" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING[tone]} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 0.9, ease: "easeOut" }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display font-semibold" style={{ fontSize: size * 0.3 }}>{value}</span>
    </div>
  );
}

/** Segmented bar showing how a score was earned — makes the score explainable at a glance. */
export function BreakdownBar({ breakdown, weights }: { breakdown: Record<string, number>; weights: Record<string, number> }) {
  const rows: [string, string, string][] = [["skills", "Skills", "#2554ff"], ["role", "Role fit", "#5b83ff"], ["location", "Location", "#0f9f5a"], ["level", "Experience", "#d28b13"], ["education", "Education", "#7a5cff"]];
  return (
    <div className="space-y-2.5">
      {rows.map(([k, label, color]) => (
        <div key={k}>
          <div className="flex justify-between text-xs mb-1"><span className="font-semibold text-ink">{label}</span><span className="text-slate">{breakdown[k]} / {weights[k]}</span></div>
          <div className="h-2 rounded-full bg-wash overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${weights[k] ? (breakdown[k] / weights[k]) * 100 : 0}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  return url
    ? <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : <span className="grid place-items-center rounded-full bg-brand-soft text-brand-deep font-semibold shrink-0" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials || "?"}</span>;
}

export const Logo = ({ light }: { light?: boolean }) => (
  <span className="flex items-center gap-2.5">
    <span className="grid place-items-center h-9 w-9 rounded-[11px] bg-ink">
      <svg width="22" height="22" viewBox="0 0 64 64"><path d="M16 42c0-10 7-18 17-18 6 0 10 3 13 7" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" /><circle cx="46" cy="44" r="6" fill="#4d7bff" /></svg>
    </span>
    <span className={cx("font-display text-[19px] font-semibold tracking-tight", light ? "text-white" : "text-ink")}>CareerMatch <span className="text-brand">AI</span></span>
  </span>
);
