import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic, Plus, Trash2 } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { ApiError, api, errMsg } from "../lib/api";
import { useApi } from "../lib/useApi";
import { date } from "../lib/format";
import { Badge, Button, Card, CardSkeletons, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Notice, PageHeader, ScoreRing, Select } from "../components/ui";

interface Row { id: string; targetRole: string; difficulty: string; status: "IN_PROGRESS" | "COMPLETED"; overallScore: number | null; createdAt: string; total: number; answered: number; }

export default function Interviews() {
  const toast = useToast(); const nav = useNavigate();
  const { data, error, loading, reload } = useApi<{ sessions: Row[] }>("/interviews");
  const [open, setOpen] = useState(false); const [del, setDel] = useState<Row | null>(null);
  const [role, setRole] = useState(""); const [diff, setDiff] = useState("medium"); const [count, setCount] = useState("5");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [aiOff, setAiOff] = useState(false);

  const start = async () => {
    setBusy(true); setErr(""); setAiOff(false);
    try { const r = await api.post<{ session: { id: string } }>("/interviews", { targetRole: role.trim(), difficulty: diff, count: Number(count) }); nav(`/interviews/${r.session.id}`); }
    catch (e) { if (e instanceof ApiError && e.code === "AI_NOT_CONFIGURED") setAiOff(true); setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Mock interviews" subtitle="Practise with questions written for your target role, then get scored feedback on each answer." actions={<Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>Start an interview</Button>} />
      {loading ? <CardSkeletons count={3} className="h-24" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data || data.sessions.length === 0 ? (
        <Card><EmptyState icon={<Mic size={26} />} title="No interviews yet" body="Choose a role and difficulty. You'll answer a mix of technical, behavioural and situational questions." action={<Button onClick={() => setOpen(true)}>Start your first interview</Button>} /></Card>
      ) : (
        <div className="space-y-3">{data.sessions.map((s) => (
          <Card key={s.id} className="p-4 sm:p-5 flex flex-wrap items-center gap-4">
            {s.overallScore != null ? <ScoreRing value={s.overallScore} size={52} label="Interview score" /> : <span className="grid place-items-center h-[52px] w-[52px] rounded-full bg-wash text-slate text-xs font-semibold">{s.answered}/{s.total}</span>}
            <div className="flex-1 min-w-[200px]"><Link to={`/interviews/${s.id}`} className="font-display text-lg font-semibold hover:text-brand">{s.targetRole}</Link>
              <div className="flex flex-wrap gap-1.5 mt-1"><Badge tone={s.status === "COMPLETED" ? "good" : "warn"}>{s.status === "COMPLETED" ? "Completed" : "In progress"}</Badge><Badge className="capitalize">{s.difficulty}</Badge><span className="text-xs text-slate self-center">{date(s.createdAt)}</span></div></div>
            <Link to={`/interviews/${s.id}`}><Button variant="secondary" size="sm">{s.status === "COMPLETED" ? "Review" : "Continue"}</Button></Link>
            <button aria-label="Delete interview" onClick={() => setDel(s)} className="p-2 rounded-lg text-mist hover:text-bad hover:bg-bad-soft"><Trash2 size={17} /></button>
          </Card>))}</div>
      )}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Start a mock interview">
        <div className="space-y-4">
          <Field label="Role you're interviewing for" htmlFor="iv-role"><Input id="iv-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Frontend Developer" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Difficulty" htmlFor="iv-d"><Select id="iv-d" value={diff} onChange={(e) => setDiff(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
            <Field label="Questions" htmlFor="iv-c"><Select id="iv-c" value={count} onChange={(e) => setCount(e.target.value)}>{[3, 5, 7, 10].map((n) => <option key={n}>{n}</option>)}</Select></Field>
          </div>
          {err && <Notice tone={aiOff ? "warn" : "bad"}>{aiOff ? "Interview questions are written by AI, and no API key is configured on the server yet." : err}</Notice>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={role.trim().length < 2} onClick={start}>{busy ? "Preparing…" : "Begin"}</Button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} danger title="Delete this interview?" confirmLabel="Delete" body="The questions, your answers and feedback will be removed." onClose={() => setDel(null)}
        onConfirm={async () => { try { await api.del(`/interviews/${del!.id}`); setDel(null); await reload(); toast("success", "Interview deleted"); } catch (e) { toast("error", errMsg(e)); } }} />
    </div>
  );
}
