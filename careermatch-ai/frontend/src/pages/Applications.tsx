import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ClipboardList, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { ApiError, api, errMsg } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { AppStatus, Application } from "../lib/types";
import { STATUS_LABEL, date } from "../lib/format";
import { Badge, Button, Card, CardSkeletons, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Textarea, cx } from "../components/ui";

const ORDER: AppStatus[] = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"];
const TONE: Record<AppStatus, "neutral" | "brand" | "warn" | "good" | "bad"> = { SAVED: "neutral", APPLIED: "brand", INTERVIEWING: "warn", OFFER: "good", REJECTED: "bad", WITHDRAWN: "neutral" };
const toInput = (s?: string | null) => (s ? s.slice(0, 10) : "");

export default function Applications() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<{ applications: Application[]; counts: Record<string, number> }>("/applications");
  const [filter, setFilter] = useState<AppStatus | "ALL">("ALL"); const [edit, setEdit] = useState<Application | "new" | null>(null); const [del, setDel] = useState<Application | null>(null);
  const apps = data?.applications ?? []; const shown = filter === "ALL" ? apps : apps.filter((a) => a.status === filter);

  const move = async (a: Application, status: AppStatus) => {
    const prev = data; setData((d) => d && { ...d, applications: d.applications.map((x) => (x.id === a.id ? { ...x, status } : x)) });
    try { await api.put(`/applications/${a.id}`, { status }); toast("success", `Moved to ${STATUS_LABEL[status]}`); await reload(); } catch (e) { setData(prev); toast("error", errMsg(e)); }
  };

  return (
    <div>
      <PageHeader title="Application tracker" subtitle="Keep every application, follow-up and note in one place." actions={<Button icon={<Plus size={16} />} onClick={() => setEdit("new")}>Add application</Button>} />
      {loading ? <CardSkeletons count={3} className="h-24" /> : error ? <ErrorState message={error} onRetry={reload} /> : apps.length === 0 ? (
        <Card><EmptyState icon={<ClipboardList size={26} />} title="No applications yet" body="Track a job from its page, or add one you found elsewhere." action={<div className="flex gap-2"><Link to="/jobs"><Button>Browse jobs</Button></Link><Button variant="secondary" onClick={() => setEdit("new")}>Add manually</Button></div>} /></Card>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto scroll-thin pb-2 mb-4">
            {(["ALL", ...ORDER] as const).map((s) => (
              <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} className={cx("shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold border", filter === s ? "bg-ink text-white border-ink" : "bg-surface text-slate border-line hover:border-brand")}>
                {s === "ALL" ? "All" : STATUS_LABEL[s]} <span className="opacity-60">{s === "ALL" ? apps.length : data?.counts[s] ?? 0}</span></button>))}
          </div>
          {shown.length === 0 ? <Card><EmptyState icon={<ClipboardList size={24} />} title={`Nothing in ${filter === "ALL" ? "your list" : STATUS_LABEL[filter]}`} /></Card> : (
            <div className="space-y-3">{shown.map((a) => (
              <Card key={a.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1 basis-[240px]">
                    {a.jobId ? <Link to={`/jobs/${a.jobId}`} className="font-display text-lg font-semibold hover:text-brand">{a.title}</Link> : <p className="font-display text-lg font-semibold">{a.title}</p>}
                    <p className="text-slate text-sm">{a.company}{a.location && ` · ${a.location}`}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate mt-2">
                      {a.appliedAt && <span>Applied {date(a.appliedAt)}</span>}
                      {a.followUpAt && <span className={cx("flex items-center gap-1", new Date(a.followUpAt) < new Date() && a.status !== "OFFER" && a.status !== "REJECTED" ? "text-warn font-semibold" : "")}><CalendarClock size={13} />Follow up {date(a.followUpAt)}</span>}
                      {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-brand font-semibold inline-flex items-center gap-1">Posting <ExternalLink size={12} /></a>}
                    </div>
                    {a.notes && <p className="text-sm text-ink-soft mt-2 max-w-[70ch] whitespace-pre-line">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={a.status} onChange={(e) => move(a, e.target.value as AppStatus)} aria-label={`Status for ${a.title}`} className="!w-auto !py-1.5 text-[13px] font-semibold">{ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select>
                    <button aria-label="Edit" onClick={() => setEdit(a)} className="p-2 rounded-lg text-slate hover:bg-wash"><Pencil size={17} /></button>
                    <button aria-label="Delete" onClick={() => setDel(a)} className="p-2 rounded-lg text-mist hover:text-bad hover:bg-bad-soft"><Trash2 size={17} /></button>
                  </div>
                </div>
                <div className="mt-3"><Badge tone={TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge></div>
              </Card>))}</div>
          )}
        </>
      )}
      {edit && <AppForm key={edit === "new" ? "new" : edit.id} initial={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      <ConfirmDialog open={!!del} danger title="Remove this application?" confirmLabel="Remove" body={<>“{del?.title}” at {del?.company} will be deleted from your tracker.</>} onClose={() => setDel(null)}
        onConfirm={async () => { try { await api.del(`/applications/${del!.id}`); setDel(null); await reload(); toast("success", "Application removed"); } catch (e) { toast("error", errMsg(e)); } }} />
    </div>
  );
}

function AppForm({ initial, onClose, onSaved }: { initial: Application | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ company: initial?.company ?? "", title: initial?.title ?? "", location: initial?.location ?? "", status: (initial?.status ?? "APPLIED") as AppStatus, appliedAt: toInput(initial?.appliedAt), followUpAt: toInput(initial?.followUpAt), url: initial?.url ?? "", notes: initial?.notes ?? "" });
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErrs({});
    const body = { company: f.company.trim(), title: f.title.trim(), location: f.location.trim() || null, status: f.status, appliedAt: f.appliedAt || null, followUpAt: f.followUpAt || null, url: f.url.trim() || null, notes: f.notes.trim() || null };
    try { initial ? await api.put(`/applications/${initial.id}`, body) : await api.post("/applications", body); toast("success", initial ? "Application updated" : "Application added"); onSaved(); }
    catch (ex) { if (ex instanceof ApiError && ex.details) setErrs(ex.details); toast("error", errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={initial ? "Edit application" : "Add application"}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Job title" error={errs.title} htmlFor="a-t"><Input id="a-t" value={f.title} onChange={set("title")} invalid={!!errs.title} required /></Field><Field label="Company" error={errs.company} htmlFor="a-c"><Input id="a-c" value={f.company} onChange={set("company")} invalid={!!errs.company} required /></Field></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Location" htmlFor="a-l"><Input id="a-l" value={f.location} onChange={set("location")} /></Field><Field label="Status" htmlFor="a-s"><Select id="a-s" value={f.status} onChange={set("status")}>{ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select></Field></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Field label="Date applied" htmlFor="a-d"><Input id="a-d" type="date" value={f.appliedAt} onChange={set("appliedAt")} /></Field><Field label="Follow up on" htmlFor="a-f"><Input id="a-f" type="date" value={f.followUpAt} onChange={set("followUpAt")} /></Field></div>
        <Field label="Posting link" error={errs.url} htmlFor="a-u"><Input id="a-u" type="url" value={f.url} onChange={set("url")} placeholder="https://…" invalid={!!errs.url} /></Field>
        <Field label="Notes" htmlFor="a-n"><Textarea id="a-n" value={f.notes} onChange={set("notes")} maxLength={3000} placeholder="Contacts, interview dates, things to prepare…" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{initial ? "Save changes" : "Add application"}</Button></div>
      </form>
    </Modal>
  );
}
