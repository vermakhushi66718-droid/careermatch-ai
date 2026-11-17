import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, CheckCircle2, Circle, Clock, Plus, Route, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { ApiError, api, errMsg } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { Job, Roadmap } from "../lib/types";
import { Badge, Button, Card, CardSkeletons, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Notice, PageHeader, Select, TagInput, cx } from "../components/ui";

export default function Roadmaps() {
  const toast = useToast(); const [sp, setSp] = useSearchParams();
  const { data, error, loading, reload, setData } = useApi<{ roadmaps: Roadmap[] }>("/roadmaps");
  const [open, setOpen] = useState(!!sp.get("jobId")); const [del, setDel] = useState<Roadmap | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const items = data?.roadmaps ?? []; const current = items.find((r) => r.id === selId) ?? items[0];

  const toggle = async (r: Roadmap, itemId: string, completed: boolean) => {
    try { const res = await api.patch<{ roadmap: Roadmap }>(`/roadmaps/${r.id}/items/${itemId}`, { completed }); setData((d) => d && { roadmaps: d.roadmaps.map((x) => (x.id === r.id ? res.roadmap : x)) }); if (completed) toast("success", "Nice work. Marked as done."); }
    catch (e) { toast("error", errMsg(e)); }
  };
  const addSkill = async (r: Roadmap, itemId: string, skill: string) => { try { await api.post(`/roadmaps/${r.id}/items/${itemId}/add-skill`); toast("success", `${skill} added to your profile skills`); } catch (e) { toast("error", errMsg(e)); } };

  return (
    <div>
      <PageHeader title="Learning roadmaps" subtitle="Ordered plans that close the gap between your skills and the jobs you want." actions={<Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>New roadmap</Button>} />
      {loading ? <CardSkeletons count={2} className="h-48" /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? (
        <Card><EmptyState icon={<Route size={26} />} title="No roadmaps yet" body="Pick a job to compare against, or name a role and the skills you want to learn." action={<Button onClick={() => setOpen(true)}>Create your first roadmap</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
          <div className="space-y-3">{items.map((r) => (
            <button key={r.id} onClick={() => setSelId(r.id)} className={cx("w-full text-left rounded-2xl border bg-surface p-4", current?.id === r.id ? "border-brand ring-4 ring-brand/10" : "border-line hover:border-[#c6d2ea]")}>
              <p className="font-semibold leading-snug">{r.title}</p><p className="text-xs text-slate truncate">{r.targetRole}</p>
              <div className="h-1.5 rounded-full bg-wash mt-3 overflow-hidden"><div className="h-full bg-good rounded-full transition-all" style={{ width: `${r.progress.percent}%` }} /></div>
              <p className="text-xs text-slate mt-1.5">{r.progress.done} of {r.progress.total} done</p>
            </button>))}
          </div>
          {current && (
            <Card className="p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-2xl font-semibold">{current.title}</h2><p className="text-slate">Target: {current.targetRole}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">{current.missingSkills.map((s) => <Badge key={s} tone="bad">{s}</Badge>)}</div></div>
                <Button variant="ghost" size="sm" className="!text-bad" icon={<Trash2 size={14} />} onClick={() => setDel(current)}>Delete</Button>
              </div>
              <ol className="mt-6 space-y-4">
                {current.items.map((it) => (
                  <li key={it.id} className={cx("rounded-2xl border p-4 sm:p-5 transition-colors", it.completed ? "border-[#bfe8d2] bg-good-soft/40" : "border-line")}>
                    <div className="flex gap-3">
                      <button onClick={() => toggle(current, it.id, !it.completed)} aria-label={it.completed ? `Mark ${it.title} not done` : `Mark ${it.title} done`} aria-pressed={it.completed} className="mt-0.5 shrink-0 text-brand">{it.completed ? <CheckCircle2 className="text-good" size={24} /> : <Circle size={24} className="text-[#b5c1da]" />}</button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><h3 className={cx("font-semibold text-[17px]", it.completed && "line-through text-slate")}>{it.title}</h3><Badge tone="brand">{it.skill}</Badge><span className="text-xs text-slate flex items-center gap-1"><Clock size={12} />~{it.estimatedWeeks} {it.estimatedWeeks === 1 ? "week" : "weeks"}</span></div>
                        <p className="text-sm text-slate mt-1.5 max-w-[68ch]">{it.description}</p>
                        {it.resources.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{it.resources.map((r, i) => <li key={i} className="inline-flex items-center gap-1.5 text-xs rounded-lg bg-wash px-2.5 py-1 text-ink-soft"><BookOpen size={12} />{r.title}<span className="text-mist">· {r.type}</span></li>)}</ul>}
                        {it.completed && <Button size="sm" variant="soft" className="mt-3" onClick={() => addSkill(current, it.id, it.skill)}>Add “{it.skill}” to my skills</Button>}
                      </div>
                    </div>
                  </li>))}
              </ol>
              <p className="text-xs text-mist mt-5">Resource names are suggestions from AI. Search for them from official or well-known providers.</p>
            </Card>
          )}
        </div>
      )}
      <NewRoadmap open={open} onClose={() => { setOpen(false); if (sp.get("jobId")) setSp({}, { replace: true }); }} presetJobId={sp.get("jobId")} onCreated={(r) => { setOpen(false); setSelId(r.id); setSp({}, { replace: true }); reload(); toast("success", "Roadmap created"); }} />
      <ConfirmDialog open={!!del} danger title="Delete this roadmap?" confirmLabel="Delete" body="Your progress on this roadmap will be lost." onClose={() => setDel(null)}
        onConfirm={async () => { try { await api.del(`/roadmaps/${del!.id}`); setDel(null); setSelId(null); await reload(); toast("success", "Roadmap deleted"); } catch (e) { toast("error", errMsg(e)); } }} />
    </div>
  );
}

function NewRoadmap({ open, onClose, presetJobId, onCreated }: { open: boolean; onClose: () => void; presetJobId: string | null; onCreated: (r: Roadmap) => void }) {
  const [mode, setMode] = useState<"job" | "custom">(presetJobId ? "job" : "job");
  const [jobId, setJobId] = useState(presetJobId ?? ""); const [role, setRole] = useState(""); const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [aiOff, setAiOff] = useState(false);
  const jobs = useApi<{ jobs: Job[] }>(open ? "/jobs?pageSize=50&sort=match" : null);
  const gap = useApi<{ matched: string[]; missing: string[]; score: number }>(open && mode === "job" && jobId ? `/roadmaps/skill-gap/${jobId}` : null);
  useEffect(() => { if (presetJobId) { setJobId(presetJobId); setMode("job"); } }, [presetJobId]);

  const go = async () => {
    setErr(""); setBusy(true); setAiOff(false);
    try { const r = await api.post<{ roadmap: Roadmap }>("/roadmaps/generate", mode === "job" ? { jobId } : { targetRole: role.trim(), missingSkills: skills }); onCreated(r.roadmap); }
    catch (e) { if (e instanceof ApiError && e.code === "AI_NOT_CONFIGURED") setAiOff(true); setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const ready = mode === "job" ? !!jobId && (gap.data?.missing.length ?? 0) > 0 : role.trim().length >= 2 && skills.length > 0;
  return (
    <Modal open={open} onClose={onClose} title="New learning roadmap" wide>
      <div className="space-y-5">
        <div className="inline-flex rounded-xl bg-wash p-1" role="tablist">{(["job", "custom"] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cx("px-4 py-1.5 rounded-lg text-sm font-semibold", mode === m ? "bg-surface shadow-soft text-ink" : "text-slate")}>{m === "job" ? "From a job" : "Custom skills"}</button>)}</div>
        {mode === "job" ? (
          <div className="space-y-3">
            <Field label="Compare yourself against" htmlFor="rm-job"><Select id="rm-job" value={jobId} onChange={(e) => setJobId(e.target.value)}><option value="">Choose a job…</option>{jobs.data?.jobs.map((j) => <option key={j.id} value={j.id}>{j.title} — {j.company} ({j.matchScore}% match)</option>)}</Select></Field>
            {jobId && (gap.loading ? <p className="text-sm text-slate">Checking your skills…</p> : gap.data && (gap.data.missing.length === 0
              ? <Notice tone="good">You already have every required skill for this job. Try another one, or check the nice-to-have skills.</Notice>
              : <div className="rounded-xl bg-paper border border-line p-4 text-sm"><p className="font-semibold mb-2">Skills the roadmap will cover</p><div className="flex flex-wrap gap-1.5">{gap.data.missing.map((s) => <Badge key={s} tone="bad">{s}</Badge>)}</div></div>))}
          </div>
        ) : (
          <div className="space-y-4"><Field label="Target role" htmlFor="rm-role"><Input id="rm-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Data Analyst" /></Field><Field label="Skills you want to learn"><TagInput value={skills} onChange={setSkills} placeholder="e.g. SQL, Power BI" /></Field></div>
        )}
        {err && <Notice tone={aiOff ? "warn" : "bad"}>{aiOff ? "Roadmaps are generated by AI, and no API key is configured on the server yet. Add ANTHROPIC_API_KEY to the backend environment." : err}</Notice>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready} loading={busy} icon={<Wand2 size={16} />} onClick={go}>{busy ? "Building…" : "Generate roadmap"}</Button></div>
        {busy && <p className="text-xs text-slate text-right flex items-center justify-end gap-1"><Sparkles size={12} />This can take 10–20 seconds.</p>}
      </div>
    </Modal>
  );
}
