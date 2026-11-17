import { useEffect, useState } from "react";
import { Search, Trash2, UserCog } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { api, errMsg } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { date } from "../../lib/format";
import { Badge, Button, Card, CardSkeletons, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, Pagination } from "../../components/ui";

interface U { id: string; email: string; fullName: string; role: "USER" | "ADMIN"; isActive: boolean; emailVerified: boolean; createdAt: string; lastLoginAt: string | null; _count: { applications: number; resumes: number }; }

export default function AdminUsers() {
  const toast = useToast(); const { user: me } = useAuth();
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useApi<{ users: U[]; total: number; totalPages: number; page: number }>(`/admin/users?page=${page}&pageSize=15${dq ? `&q=${encodeURIComponent(dq)}` : ""}`);
  const [act, setAct] = useState<{ kind: "toggle" | "role" | "delete"; u: U } | null>(null);

  const run = async () => {
    if (!act) return; const { kind, u } = act;
    try {
      if (kind === "delete") await api.del(`/admin/users/${u.id}`);
      else if (kind === "toggle") await api.patch(`/admin/users/${u.id}`, { isActive: !u.isActive });
      else await api.patch(`/admin/users/${u.id}`, { role: u.role === "ADMIN" ? "USER" : "ADMIN" });
      toast("success", kind === "delete" ? "User deleted" : "User updated"); setAct(null); await reload();
    } catch (e) { toast("error", errMsg(e)); setAct(null); }
  };
  const copy = {
    delete: (u: U) => ({ title: "Delete this user?", body: <>{u.fullName} ({u.email}) and all of their data (resumes, applications, roadmaps, interviews) will be permanently deleted.</>, label: "Delete user", danger: true }),
    toggle: (u: U) => ({ title: u.isActive ? "Deactivate this account?" : "Reactivate this account?", body: u.isActive ? <>{u.fullName} will be signed out and unable to sign in until reactivated.</> : <>{u.fullName} will be able to sign in again.</>, label: u.isActive ? "Deactivate" : "Reactivate", danger: u.isActive }),
    role: (u: U) => ({ title: u.role === "ADMIN" ? "Remove admin access?" : "Make this user an admin?", body: u.role === "ADMIN" ? <>{u.fullName} will lose access to the admin area.</> : <>{u.fullName} will be able to manage users and listings.</>, label: "Confirm", danger: false }),
  };
  const c = act ? copy[act.kind](act.u) : null;

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage accounts and access." />
      <div className="relative max-w-md mb-5"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" /><Input className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search users" /></div>
      {loading && !data ? <CardSkeletons count={4} className="h-16" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data || data.users.length === 0 ? <Card><EmptyState icon={<UserCog size={24} />} title="No users found" body="Try a different search." /></Card> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm min-w-[760px]">
              <thead><tr className="text-left text-slate border-b border-line bg-paper/60"><th className="px-5 py-3 font-semibold">User</th><th className="px-3 py-3 font-semibold">Role</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Activity</th><th className="px-3 py-3 font-semibold">Joined</th><th className="px-5 py-3" /></tr></thead>
              <tbody>{data.users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5"><p className="font-semibold">{u.fullName}</p><p className="text-slate text-xs">{u.email}</p></td>
                  <td className="px-3"><Badge tone={u.role === "ADMIN" ? "navy" : "neutral"}>{u.role === "ADMIN" ? "Admin" : "Job seeker"}</Badge></td>
                  <td className="px-3"><div className="flex flex-wrap gap-1"><Badge tone={u.isActive ? "good" : "bad"}>{u.isActive ? "Active" : "Deactivated"}</Badge>{!u.emailVerified && <Badge tone="warn">Unverified</Badge>}</div></td>
                  <td className="px-3 text-slate text-xs">{u._count.resumes} resumes · {u._count.applications} applications<br />Last sign-in {u.lastLoginAt ? date(u.lastLoginAt) : "never"}</td>
                  <td className="px-3 text-slate">{date(u.createdAt)}</td>
                  <td className="px-5"><div className="flex justify-end gap-1.5">
                    {u.id !== me?.id ? <>
                      <Button size="sm" variant="ghost" onClick={() => setAct({ kind: "role", u })}>{u.role === "ADMIN" ? "Remove admin" : "Make admin"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAct({ kind: "toggle", u })}>{u.isActive ? "Deactivate" : "Reactivate"}</Button>
                      <button aria-label={`Delete ${u.fullName}`} onClick={() => setAct({ kind: "delete", u })} className="p-2 rounded-lg text-mist hover:text-bad hover:bg-bad-soft"><Trash2 size={16} /></button></>
                      : <span className="text-xs text-mist">You</span>}
                  </div></td>
                </tr>))}</tbody>
            </table>
          </div>
        </Card>
      )}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      <ConfirmDialog open={!!act} title={c?.title ?? ""} body={c?.body} confirmLabel={c?.label} danger={c?.danger} onClose={() => setAct(null)} onConfirm={run} />
    </div>
  );
}
