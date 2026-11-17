import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Briefcase, ClipboardList, FileText, Gauge, LogOut, Menu, MessageSquare, Route, Settings2, Shield, Mic, UserRound, Users, X, LayoutDashboard, MailWarning } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api, errMsg } from "../lib/api";
import type { Profile } from "../lib/types";
import { Avatar, Button, Logo, cx } from "./ui";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs & internships", icon: Briefcase },
  { to: "/resume", label: "Resume", icon: FileText },
  { to: "/roadmaps", label: "Learning roadmaps", icon: Route },
  { to: "/interviews", label: "Mock interviews", icon: Mic },
  { to: "/applications", label: "Applications", icon: ClipboardList },
  { to: "/assistant", label: "Career assistant", icon: MessageSquare },
];
const ADMIN = [
  { to: "/admin", label: "Overview", icon: Gauge, end: true },
  { to: "/admin/jobs", label: "Manage listings", icon: Settings2 },
  { to: "/admin/users", label: "Users", icon: Users },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors",
      isActive ? "bg-white/12 text-white" : "text-[#b7c4e4] hover:bg-white/8 hover:text-white");
  return (
    <nav className="flex-1 overflow-y-auto scroll-thin px-3 space-y-1" aria-label="Main">
      {user?.role !== "ADMIN" && NAV.map((n) => (
        <NavLink key={n.to} to={n.to} className={link} onClick={onNavigate}><n.icon size={18} />{n.label}</NavLink>
      ))}
      {user?.role === "ADMIN" && (
        <>
          <p className="px-3 pt-1 pb-2 text-xs font-semibold text-[#7d8fba]">Administration</p>
          {ADMIN.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={link} onClick={onNavigate}><n.icon size={18} />{n.label}</NavLink>)}
        </>
      )}
    </nav>
  );
}

function Sidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-ink">
      <div className="flex items-center justify-between px-5 h-[68px] shrink-0"><Logo light />{onClose && <button onClick={onClose} aria-label="Close menu" className="text-white/80"><X size={20} /></button>}</div>
      <NavList onNavigate={onNavigate} />
      <p className="px-5 py-4 text-xs text-[#7d8fba]">Job listings shown are demonstration data unless marked otherwise.</p>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDrawer(false); setMenu(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", onClick); return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    let url: string | null = null; let alive = true;
    const load = async () => {
      try {
        const { profile } = await api.get<{ profile: Profile }>("/profile");
        if (!profile.photoUrl) { if (alive) setPhoto(null); return; }
        const blob = await api.blob(`/profile/photo/${user!.id}`);
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob); if (alive) setPhoto(url);
      } catch { /* avatar is optional */ }
    };
    load();
    window.addEventListener("profile-updated", load);
    return () => { alive = false; window.removeEventListener("profile-updated", load); if (url) URL.revokeObjectURL(url); };
  }, [user?.id]);

  if (!user) return null;
  const resend = async () => {
    setResending(true);
    try { await api.post("/auth/resend-verification"); toast("success", "Verification email sent. Check your inbox (in development it is printed in the server console)."); }
    catch (e) { toast("error", errMsg(e)); } finally { setResending(false); }
  };

  return (
    <div className="min-h-screen lg:pl-[268px]">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-[268px] z-30"><Sidebar /></aside>
      <AnimatePresence>
        {drawer && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div className="absolute inset-0 bg-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-[280px]" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "tween", duration: 0.2 }}>
              <Sidebar onNavigate={() => setDrawer(false)} onClose={() => setDrawer(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-20 h-[68px] bg-paper/85 backdrop-blur border-b border-line flex items-center gap-3 px-4 sm:px-8">
        <button className="lg:hidden rounded-xl p-2 -ml-2 text-ink hover:bg-wash" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={22} /></button>
        <div className="lg:hidden"><Logo /></div>
        <div className="flex-1" />
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} className="flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 hover:bg-wash">
            <Avatar name={user.fullName} url={photo} size={36} />
            <span className="hidden sm:block text-left leading-tight"><span className="block text-sm font-semibold">{user.fullName}</span><span className="block text-xs text-slate">{user.role === "ADMIN" ? "Administrator" : "Job seeker"}</span></span>
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                className="absolute right-0 mt-2 w-60 bg-surface border border-line rounded-2xl shadow-lift p-2">
                <div className="px-3 py-2 border-b border-line mb-1"><p className="text-sm font-semibold truncate">{user.fullName}</p><p className="text-xs text-slate truncate">{user.email}</p></div>
                {user.role !== "ADMIN" && <button role="menuitem" onClick={() => nav("/profile")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-wash"><UserRound size={16} />Profile & settings</button>}
                {user.role === "ADMIN" && <button role="menuitem" onClick={() => nav("/admin")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-wash"><Shield size={16} />Admin overview</button>}
                <button role="menuitem" onClick={async () => { await logout(); nav("/login"); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-wash text-bad"><LogOut size={16} />Sign out</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1280px] mx-auto">
        {!user.emailVerified && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[#f3dcae] bg-warn-soft px-4 py-3 text-sm text-[#7a4d08]">
            <MailWarning size={18} /><span className="flex-1 min-w-[220px]">Verify your email address to keep your account recoverable.</span>
            <Button size="sm" variant="secondary" loading={resending} onClick={resend}>Resend email</Button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
export { Bell };
