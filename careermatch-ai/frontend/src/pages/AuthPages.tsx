import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, MailCheck, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError, api, errMsg } from "../lib/api";
import { Button, Field, Input, Logo, Notice, Spinner } from "../components/ui";

function Shell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="hidden lg:flex flex-col justify-between bg-ink text-white p-12 relative overflow-hidden">
        <Link to="/"><Logo light /></Link>
        <div className="relative z-10">
          <p className="font-display text-[38px] leading-[1.1] font-semibold max-w-md">Every score comes with its reasons.</p>
          <p className="text-[#b7c4e4] mt-4 max-w-sm">See which skills matched, which are missing, and the shortest path to close the gap.</p>
        </div>
        <svg className="absolute -right-24 -bottom-24 opacity-20" width="520" height="520" viewBox="0 0 64 64" aria-hidden><path d="M12 44c0-12 8-22 21-22 8 0 13 4 17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /><circle cx="48" cy="46" r="5" fill="#4d7bff" /></svg>
        <p className="text-sm text-[#7d8fba] relative z-10">Listings in this build are fictional demonstration data.</p>
      </div>
      <div className="flex flex-col justify-center px-5 sm:px-12 py-10">
        <div className="w-full max-w-[420px] mx-auto">
          <div className="lg:hidden mb-8"><Link to="/"><Logo /></Link></div>
          <h1 className="text-[30px] font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="text-slate mt-1.5">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-slate">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

const pwRules = (p: string) => [
  ["At least 8 characters", p.length >= 8], ["A lowercase letter", /[a-z]/.test(p)], ["An uppercase letter", /[A-Z]/.test(p)], ["A number", /\d/.test(p)],
] as const;
function PasswordRules({ value }: { value: string }) {
  if (!value) return null;
  return <ul className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">{pwRules(value).map(([t, ok]) => <li key={t} className={`flex items-center gap-1.5 text-xs ${ok ? "text-good" : "text-slate"}`}><CheckCircle2 size={13} className={ok ? "" : "opacity-30"} />{t}</li>)}</ul>;
}

export function Login() {
  const { login } = useAuth(); const nav = useNavigate(); const loc = useLocation(); const toast = useToast();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const u = await login(email, password); nav((loc.state as any)?.from ?? (u.role === "ADMIN" ? "/admin" : "/dashboard"), { replace: true }); }
    catch (ex) { setErr(errMsg(ex)); toast("error", errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Welcome back" subtitle="Sign in to continue your job search." footer={<>New here? <Link className="text-brand font-semibold" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Notice tone="bad">{err}</Notice>}
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" /></Field>
        <Field label="Password" htmlFor="pw"><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <div className="text-right -mt-1"><Link className="text-sm text-brand font-semibold" to="/forgot-password">Forgot password?</Link></div>
        <Button type="submit" loading={busy} className="w-full">Sign in</Button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ fullName: "", email: "", password: "", confirm: "" });
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [top, setTop] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setTop("");
    const x: Record<string, string> = {};
    if (f.fullName.trim().length < 2) x.fullName = "Enter your full name";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) x.email = "Enter a valid email address";
    if (!pwRules(f.password).every(([, ok]) => ok)) x.password = "Password does not meet all the requirements";
    if (f.password !== f.confirm) x.confirm = "Passwords do not match";
    setErrs(x); if (Object.keys(x).length) return;
    setBusy(true);
    try { await register(f.fullName.trim(), f.email.trim(), f.password); nav("/onboarding", { replace: true }); }
    catch (ex) { if (ex instanceof ApiError && ex.details) setErrs(ex.details); setTop(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Create your account" subtitle="Free for students and job seekers." footer={<>Already registered? <Link className="text-brand font-semibold" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {top && <Notice tone="bad">{top}</Notice>}
        <Field label="Full name" error={errs.fullName} htmlFor="n"><Input id="n" autoComplete="name" value={f.fullName} onChange={set("fullName")} invalid={!!errs.fullName} /></Field>
        <Field label="Email" error={errs.email} htmlFor="e"><Input id="e" type="email" autoComplete="email" value={f.email} onChange={set("email")} invalid={!!errs.email} /></Field>
        <Field label="Password" error={errs.password} htmlFor="p"><Input id="p" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} invalid={!!errs.password} /><PasswordRules value={f.password} /></Field>
        <Field label="Confirm password" error={errs.confirm} htmlFor="c"><Input id="c" type="password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} invalid={!!errs.confirm} /></Field>
        <Button type="submit" loading={busy} className="w-full">Create account</Button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.post("/auth/forgot-password", { email }); setSent(true); } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Reset your password" subtitle="Enter your email and we'll send a reset link." footer={<Link className="text-brand font-semibold" to="/login">Back to sign in</Link>}>
      {sent ? (
        <Notice tone="good"><MailCheck className="inline mr-2" size={16} />If an account exists for {email}, a reset link is on its way. It expires in 1 hour.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <Notice tone="bad">{err}</Notice>}
          <Field label="Email" htmlFor="fe"><Input id="fe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams(); const token = params.get("token") ?? ""; const nav = useNavigate(); const toast = useToast();
  const [pw, setPw] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (!pwRules(pw).every(([, ok]) => ok)) return setErr("Password does not meet all the requirements");
    if (pw !== confirm) return setErr("Passwords do not match");
    setBusy(true);
    try { await api.post("/auth/reset-password", { token, password: pw }); toast("success", "Password updated. Sign in with your new password."); nav("/login"); }
    catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };
  if (!token) return <Shell title="Link not valid" subtitle="This reset link is missing its token."><Link to="/forgot-password"><Button>Request a new link</Button></Link></Shell>;
  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Notice tone="bad">{err}</Notice>}
        <Field label="New password" htmlFor="np"><Input id="np" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><PasswordRules value={pw} /></Field>
        <Field label="Confirm new password" htmlFor="cp"><Input id="cp" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <Button type="submit" loading={busy} className="w-full">Update password</Button>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams(); const token = params.get("token") ?? "";
  const { user, reload } = useAuth();
  const [state, setState] = useState<"working" | "ok" | "fail">("working"); const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!token) { setState("fail"); setMsg("This link is missing its token."); return; }
    api.post("/auth/verify-email", { token }).then(async () => { setState("ok"); if (user) await reload().catch(() => {}); }).catch((e) => { setState("fail"); setMsg(errMsg(e)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return (
    <Shell title={state === "ok" ? "Email verified" : state === "fail" ? "Couldn't verify your email" : "Verifying…"}>
      {state === "working" && <Spinner className="h-7 w-7" />}
      {state === "ok" && <div className="space-y-4"><p className="flex items-center gap-2 text-good"><CheckCircle2 size={18} />Your email address is confirmed.</p><Link to={user ? "/dashboard" : "/login"}><Button>Continue</Button></Link></div>}
      {state === "fail" && <div className="space-y-4"><p className="flex items-center gap-2 text-bad"><XCircle size={18} />{msg}</p><p className="text-slate text-sm">Sign in and use “Resend email” at the top of the page to get a fresh link.</p><Link to="/login"><Button variant="secondary">Go to sign in</Button></Link></div>}
    </Shell>
  );
}
