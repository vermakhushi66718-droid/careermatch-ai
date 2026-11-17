import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Search, Trash2, Briefcase } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { ApiError, api, errMsg } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import type { Job } from "../../lib/types";
import { LEVEL_LABEL, MODE_LABEL, TYPE_LABEL, date, salary } from "../../lib/format";
import { SampleBadge } from "../../components/JobCard";
import { Badge, Button, Card, CardSkeletons, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Notice, PageHeader, Pagination, Select, TagInput, Textarea } from "../../components/ui";

type Row = Job & { _count?: { applications: number } };
interface Form { title: string; company: string; location: string; workMode: string; type: string; experienceLevel: string; description: string; requiredSkills: string[]; preferredSkills: string[]; minCgpa: string; salaryMin: string; salaryMax: string; applyUrl: string; category: string; isActive: boolean; isSample: boolean; }
const blank: Form = { title: "", company: "", location: "", workMode: "ONSITE", type: "FULL_TIME", experienceLevel: "FRESHER", description: "", requiredSkills: [], preferredSkills: [], minCgpa: "", salaryMin: "", salaryMax: "", applyUrl: "", category: "", isActive: true, isSample: false };

export default function AdminJobs() {
  const toast = useToast();
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [status, setStatus] = useState("all"); const [source, setSource] = useState("all"); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useApi<{ jobs: Row[]; total: number; page: number; totalPages: number }>(`/admin/jobs?page=${page}&pageSize=12&status=${status}&source=${source}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`);
  const [edit, setEdit] = useState<Row | "new" | null>(null); const [del, setDel] = useState<Row | null>(null);

  const toggleActive = async (j: Row) => { try { await api.patch(`/admin/jobs/${j.id}/active`, { isActive: !j.isActive }); toast("success", j.isActive ? "Listing hidden from job seekers" : "Listing is live"); await reload(); } catch (e) { toast("error", errMsg(e)); } };

  return (
    <div>
      <PageHeader title="Manage listings" subtitle="Create, edit, hide or delete the jobs and internships job seekers see." actions={<Button icon={<Plus size={16} />} onClick={() => setEdit("new")}>New listing</Button>} />
      <div className="mb-5"><Notice tone="info">Listings marked <b>Demo</b> are seeded demonstration data. New listings you create are saved as real listings. A future integration with an authorised job API can write to the same table using its own <code className="font-mono text-[13px]">source</code> value.</Notice></div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" /><Input className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or company" aria-label="Search listings" /></div>
        <Select className="!w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status"><option value="all">All statuses</option><option value="active">Live</option><option value="inactive">Hidden</option></Select>
        <Select className="!w-auto" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} aria-label="Filter by source"><option value="all">All sources</option><option value="sample">Demo data</option><option value="custom">Created by admins</option></Select>
      </div>
      {loading && !data ? <CardSkeletons count={4} className="h-20" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data || data.jobs.length === 0 ? <Card><EmptyState icon={<Briefcase size={24} />} title="No listings match" action={<Button onClick={() => setEdit("new")}>Create a listing</Button>} /></Card> : (
        <>
          <p className="text-sm text-slate mb-3">{data.total} listings</p>
          <div className="space-y-3">{data.jobs.map((j) => (
            <Card key={j.id} className="p-4 sm:p-5 flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1 basis-[260px]">
                <p className="font-display text-lg font-semibold leading-snug">{j.title}</p><p className="text-sm text-slate">{j.company} · {j.location}</p>
                <div className="flex flex-wrap gap-1.5 mt-2"><Badge tone={j.isActive ? "good" : "neutral"}>{j.isActive ? "Live" : "Hidden"}</Badge><Badge>{TYPE_LABEL[j.type]}</Badge><Badge>{MODE_LABEL[j.workMode]}</Badge><Badge>{LEVEL_LABEL[j.experienceLevel]}</Badge>{j.isSample && <SampleBadge />}<span className="text-xs text-slate self-center">{salary(j)} · {j._count?.applications ?? 0} tracked · {date(j.postedAt)}</span></div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" icon={j.isActive ? <EyeOff size={15} /> : <Eye size={15} />} onClick={() => toggleActive(j)}>{j.isActive ? "Hide" : "Publish"}</Button>
                <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setEdit(j)}>Edit</Button>
                <button aria-label={`Delete ${j.title}`} onClick={() => setDel(j)} className="p-2 rounded-lg text-mist hover:text-bad hover:bg-bad-soft"><Trash2 size={16} /></button>
              </div>
            </Card>))}</div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
      {edit && <JobForm key={edit === "new" ? "new" : edit.id} initial={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      <ConfirmDialog open={!!del} danger title="Delete this listing?" confirmLabel="Delete listing" body={<>“{del?.title}” at {del?.company} will be removed. Applications users already track for it stay in their trackers. To keep the listing but stop showing it, use Hide instead.</>} onClose={() => setDel(null)}
        onConfirm={async () => { try { await api.del(`/admin/jobs/${del!.id}`); setDel(null); toast("success", "Listing deleted"); await reload(); } catch (e) { toast("error", errMsg(e)); setDel(null); } }} />
    </div>
  );
}

function JobForm({ initial, onClose, onSaved }: { initial: Row | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Form>(initial ? { ...blank, ...initial, location: initial.location, minCgpa: initial.minCgpa?.toString() ?? "", salaryMin: initial.salaryMin?.toString() ?? "", salaryMax: initial.salaryMax?.toString() ?? "", applyUrl: initial.applyUrl ?? "", category: initial.category ?? "" } as Form : blank);
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErrs({});
    const body = { ...f, minCgpa: num(f.minCgpa), salaryMin: num(f.salaryMin), salaryMax: num(f.salaryMax), applyUrl: f.applyUrl.trim() || null, category: f.category.trim() || null };
    try { initial ? await api.put(`/admin/jobs/${initial.id}`, body) : await api.post("/admin/jobs", body); toast("success", initial ? "Listing updated" : "Listing created"); onSaved(); }
    catch (ex) { if (ex instanceof ApiError && ex.details) setErrs(ex.details as Record<string, string>); toast("error", errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={initial ? "Edit listing" : "New listing"} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {Object.keys(errs).length > 0 && <Notice tone="bad">Please fix the highlighted fields.</Notice>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Job title" error={errs.title} htmlFor="j-t"><Input id="j-t" value={f.title} onChange={set("title")} invalid={!!errs.title} /></Field>
          <Field label="Company" error={errs.company} htmlFor="j-c"><Input id="j-c" value={f.company} onChange={set("company")} invalid={!!errs.company} /></Field>
          <Field label="Location" error={errs.location} htmlFor="j-l"><Input id="j-l" value={f.location} onChange={set("location")} placeholder="City, State or Remote (India)" invalid={!!errs.location} /></Field>
          <Field label="Category" htmlFor="j-ca"><Input id="j-ca" value={f.category} onChange={set("category")} placeholder="e.g. Web Development" /></Field>
          <Field label="Type" htmlFor="j-ty"><Select id="j-ty" value={f.type} onChange={set("type")}>{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Work mode" htmlFor="j-m"><Select id="j-m" value={f.workMode} onChange={set("workMode")}>{Object.entries(MODE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Experience level" htmlFor="j-e"><Select id="j-e" value={f.experienceLevel} onChange={set("experienceLevel")}>{Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Minimum CGPA" error={errs.minCgpa} htmlFor="j-cg"><Input id="j-cg" type="number" step="0.1" min={0} max={10} value={f.minCgpa} onChange={set("minCgpa")} /></Field>
          <Field label="Minimum pay (₹)" hint="Per year, or per month for internships" error={errs.salaryMin} htmlFor="j-s1"><Input id="j-s1" type="number" min={0} value={f.salaryMin} onChange={set("salaryMin")} /></Field>
          <Field label="Maximum pay (₹)" error={errs.salaryMax} htmlFor="j-s2"><Input id="j-s2" type="number" min={0} value={f.salaryMax} onChange={set("salaryMax")} invalid={!!errs.salaryMax} /></Field>
        </div>
        <Field label="Description" error={errs.description} htmlFor="j-d"><Textarea id="j-d" value={f.description} onChange={set("description")} className="min-h-[130px]" invalid={!!errs.description} /></Field>
        <Field label="Required skills" error={errs.requiredSkills}><TagInput value={f.requiredSkills} onChange={(v) => setF({ ...f, requiredSkills: v })} placeholder="Type a skill and press Enter" /></Field>
        <Field label="Nice-to-have skills"><TagInput value={f.preferredSkills} onChange={(v) => setF({ ...f, preferredSkills: v })} placeholder="Optional" /></Field>
        <Field label="Application link" error={errs.applyUrl} htmlFor="j-u"><Input id="j-u" type="url" value={f.applyUrl} onChange={set("applyUrl")} placeholder="https://…" invalid={!!errs.applyUrl} /></Field>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[#2554ff]" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />Visible to job seekers</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[#2554ff]" checked={f.isSample} onChange={(e) => setF({ ...f, isSample: e.target.checked })} />Mark as demonstration data</label>
        </div>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{initial ? "Save changes" : "Create listing"}</Button></div>
      </form>
    </Modal>
  );
}
