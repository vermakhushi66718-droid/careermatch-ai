import { useRef, useState, DragEvent } from "react";
import { CheckCircle2, Download, FileText, Lightbulb, Plus, Star, Trash2, UploadCloud, Wand2, AlertTriangle, Save, RefreshCw } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { ApiError, api, errMsg } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { ParsedResume, Resume } from "../lib/types";
import { date } from "../lib/format";
import { Badge, Button, Card, CardSkeletons, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Notice, PageHeader, ScoreRing, TagInput, Textarea, cx } from "../components/ui";

interface Improvement { id: string; targetRole: string | null; rewrittenSummary: string; improvedBullets: { original: string; improved: string; reason: string }[]; missingKeywords: string[]; sectionAdvice: { section: string; advice: string }[]; overallNotes: string; }
const MAX_MB = 5;

export default function ResumePage() {
  const toast = useToast();
  const list = useApi<{ resumes: Resume[]; aiConfigured: boolean }>("/resumes");
  const [selId, setSelId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false); const [drag, setDrag] = useState(false);
  const [del, setDel] = useState<Resume | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resumes = list.data?.resumes ?? [];
  const current = resumes.find((r) => r.id === selId) ?? resumes.find((r) => r.isPrimary) ?? resumes[0];

  const upload = async (f?: File) => {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) || (f.type && f.type !== "application/pdf")) return toast("error", "Please choose a PDF file.");
    if (f.size > MAX_MB * 1024 * 1024) return toast("error", `File is larger than ${MAX_MB} MB.`);
    setUploading(true);
    try {
      const r = await api.upload<{ resume: Resume; aiConfigured: boolean }>("/resumes", (() => { const fd = new FormData(); fd.append("resume", f); return fd; })());
      await list.reload(); setSelId(r.resume.id);
      toast(r.resume.analysisError ? "info" : "success", r.resume.analysisError ? "Resume uploaded. AI analysis isn't available yet." : "Resume analysed");
    } catch (e) { toast("error", errMsg(e)); } finally { setUploading(false); }
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); };

  const makePrimary = async (r: Resume) => { try { await api.post(`/resumes/${r.id}/primary`); await list.reload(); toast("success", "Primary resume updated"); } catch (e) { toast("error", errMsg(e)); } };
  const download = async (r: Resume) => {
    try { const b = await api.blob(`/resumes/${r.id}/file`); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = r.fileName; a.click(); URL.revokeObjectURL(u); }
    catch (e) { toast("error", errMsg(e)); }
  };

  return (
    <div>
      <PageHeader title="Resume analyzer" subtitle="Upload a PDF to extract your skills, check ATS readiness and get rewrite suggestions."
        actions={<Button icon={<UploadCloud size={16} />} loading={uploading} onClick={() => fileRef.current?.click()}>Upload PDF</Button>} />
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />

      {list.loading ? <CardSkeletons count={2} className="h-56" /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <>
          {list.data && !list.data.aiConfigured && <div className="mb-5"><Notice tone="warn">AI analysis is switched off because no API key is configured on the server. You can still upload resumes; add <code className="font-mono text-[13px]">ANTHROPIC_API_KEY</code> to the backend environment to enable extraction, scoring and rewrites.</Notice></div>}
          {resumes.length === 0 ? (
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
              className={cx("rounded-[24px] border-2 border-dashed bg-surface transition-colors", drag ? "border-brand bg-brand-soft/40" : "border-[#c6d2ea]")}>
              <EmptyState icon={<UploadCloud size={26} />} title="Drop your resume here" body={`PDF only, up to ${MAX_MB} MB. Text-based PDFs work best; scanned images can't be read.`} action={<Button loading={uploading} onClick={() => fileRef.current?.click()}>Choose a PDF</Button>} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
              <div className="space-y-3" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
                {resumes.map((r) => (
                  <button key={r.id} onClick={() => setSelId(r.id)} className={cx("w-full text-left rounded-2xl border p-4 bg-surface transition-colors", current?.id === r.id ? "border-brand ring-4 ring-brand/10" : "border-line hover:border-[#c6d2ea]")}>
                    <div className="flex items-start gap-3"><FileText size={20} className="text-brand mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold truncate">{r.fileName}</p><p className="text-xs text-slate">{date(r.createdAt)} · {(r.fileSize / 1024).toFixed(0)} KB</p></div>{r.atsScore != null && <span className="font-display font-semibold text-brand">{r.atsScore}</span>}</div>
                    {r.isPrimary && <Badge tone="brand" className="mt-2"><Star size={11} />Primary</Badge>}
                  </button>
                ))}
                <div className={cx("rounded-2xl border-2 border-dashed text-center text-sm py-4 text-slate", drag ? "border-brand bg-brand-soft/40" : "border-line")}>Drop another PDF here</div>
              </div>
              {current && <ResumeDetail key={current.id} resume={current} aiConfigured={!!list.data?.aiConfigured} onChanged={list.reload} onPrimary={() => makePrimary(current)} onDelete={() => setDel(current)} onDownload={() => download(current)} />}
            </div>
          )}
        </>
      )}
      <ConfirmDialog open={!!del} danger title="Delete this resume?" confirmLabel="Delete resume" body={<>“{del?.fileName}” and its analysis will be permanently removed.</>} onClose={() => setDel(null)}
        onConfirm={async () => { try { await api.del(`/resumes/${del!.id}`); setDel(null); setSelId(null); await list.reload(); toast("success", "Resume deleted"); } catch (e) { toast("error", errMsg(e)); } }} />
    </div>
  );
}

function ResumeDetail({ resume, aiConfigured, onChanged, onPrimary, onDelete, onDownload }: { resume: Resume; aiConfigured: boolean; onChanged: () => void; onPrimary: () => void; onDelete: () => void; onDownload: () => void }) {
  const toast = useToast();
  const [analyzing, setAnalyzing] = useState(false); const [editing, setEditing] = useState(false); const [improveOpen, setImproveOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const a = resume.analysis, p = resume.parsed;

  const reanalyze = async () => { setAnalyzing(true); try { const r = await api.post<{ resume: Resume }>(`/resumes/${resume.id}/analyze`); await onChanged(); toast(r.resume.analysisError ? "error" : "success", r.resume.analysisError ?? "Analysis updated"); } catch (e) { toast("error", errMsg(e)); } finally { setAnalyzing(false); } };
  const apply = async () => { setApplying(true); try { const r = await api.post<{ added: { technicalSkills: number } }>(`/resumes/${resume.id}/apply-to-profile`); toast("success", `Profile updated. You now list ${r.added.technicalSkills} technical skills.`); } catch (e) { toast("error", errMsg(e)); } finally { setApplying(false); } };

  return (
    <div className="space-y-5">
      <Card className="p-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><p className="font-semibold truncate">{resume.fileName}</p><p className="text-sm text-slate">Uploaded {date(resume.createdAt)}</p></div>
        {!resume.isPrimary && <Button size="sm" variant="secondary" icon={<Star size={14} />} onClick={onPrimary}>Make primary</Button>}
        <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={onDownload}>Download</Button>
        <Button size="sm" variant="ghost" className="!text-bad" icon={<Trash2 size={14} />} onClick={onDelete}>Delete</Button>
      </Card>

      {resume.analysisError && <Notice tone="warn" action={<Button size="sm" variant="secondary" loading={analyzing} icon={<RefreshCw size={14} />} onClick={reanalyze}>Retry analysis</Button>}>{resume.analysisError}</Notice>}

      {a && p && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5">
            <Card className="p-6 flex flex-col items-center justify-center text-center min-w-[180px]"><ScoreRing value={resume.atsScore ?? 0} size={104} stroke={10} label="ATS score" /><p className="font-semibold mt-3">ATS readiness</p><p className="text-xs text-slate max-w-[150px]">How easily applicant-tracking systems can read this resume</p></Card>
            <Card className="p-6 grid sm:grid-cols-2 gap-5">
              <div><h3 className="font-semibold text-good flex items-center gap-1.5 mb-2"><CheckCircle2 size={16} />Strengths</h3><ul className="text-sm space-y-1.5 list-disc pl-5">{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
              <div><h3 className="font-semibold text-warn flex items-center gap-1.5 mb-2"><AlertTriangle size={16} />To improve</h3><ul className="text-sm space-y-1.5 list-disc pl-5">{a.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></div>
              {a.suggestions.length > 0 && <div className="sm:col-span-2 border-t border-line pt-4"><h3 className="font-semibold flex items-center gap-1.5 mb-2"><Lightbulb size={16} className="text-brand" />Suggestions</h3><ul className="text-sm space-y-1.5 list-disc pl-5">{a.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>{a.missingSections.length > 0 && <p className="text-sm text-slate mt-3">Missing sections: {a.missingSections.join(", ")}</p>}</div>}
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2 className="text-xl font-semibold">What we extracted</h2><p className="text-sm text-slate">Check it over. Anything wrong can be corrected before it's used for matching.</p></div>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit details</Button><Button size="sm" variant="soft" loading={applying} onClick={apply}>Add skills to my profile</Button></div></div>
            <ExtractedView p={p} />
          </Card>

          <Card className="p-6 flex flex-wrap items-center gap-4">
            <span className="grid place-items-center h-12 w-12 rounded-2xl bg-brand-soft text-brand"><Wand2 size={22} /></span>
            <div className="flex-1 min-w-[220px]"><h2 className="text-lg font-semibold">Improve this resume</h2><p className="text-sm text-slate">Get a sharper summary, stronger bullet points and missing keywords for a target role.</p></div>
            <Button onClick={() => setImproveOpen(true)} disabled={!aiConfigured}>Get suggestions</Button>
          </Card>
          <ImprovementsHistory resumeId={resume.id} />
          <EditExtracted open={editing} onClose={() => setEditing(false)} resumeId={resume.id} initial={p} onSaved={() => { setEditing(false); onChanged(); }} />
          <ImproveModal open={improveOpen} onClose={() => setImproveOpen(false)} resumeId={resume.id} />
        </>
      )}

      {!a && !resume.analysisError && <Notice tone="info" action={<Button size="sm" loading={analyzing} onClick={reanalyze}>Analyse now</Button>}>This resume hasn't been analysed yet.</Notice>}
      {!a && resume.analysisError && aiConfigured === false && <Card className="p-6"><h3 className="font-semibold mb-1">Text was extracted successfully</h3><p className="text-sm text-slate">Your resume is stored and readable. Once AI is configured, press “Retry analysis” to fill in the details.</p></Card>}
    </div>
  );
}

function ExtractedView({ p }: { p: ParsedResume }) {
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-4 py-3 border-b border-line last:border-0"><dt className="text-sm font-semibold text-slate">{label}</dt><dd className="text-sm">{children}</dd></div>;
  const chips = (arr: string[], tone = "bg-brand-soft text-brand-deep") => arr.length ? <div className="flex flex-wrap gap-1.5">{arr.map((s) => <span key={s} className={`rounded-md text-[13px] font-semibold px-2 py-0.5 ${tone}`}>{s}</span>)}</div> : <span className="text-mist">None found</span>;
  return (
    <dl>
      <Row label="Name & contact">{[p.name, p.email, p.phone, p.location].filter(Boolean).join(" · ") || <span className="text-mist">Not found</span>}</Row>
      {p.summary && <Row label="Summary">{p.summary}</Row>}
      <Row label="Education">{p.education.length ? <ul className="space-y-1">{p.education.map((e, i) => <li key={i}><b>{e.degree}</b>{e.institution && `, ${e.institution}`}{e.year && ` (${e.year})`}{e.grade && ` · ${e.grade}`}</li>)}</ul> : <span className="text-mist">None found</span>}</Row>
      <Row label="Technical skills">{chips(p.technicalSkills)}</Row>
      <Row label="Soft skills">{chips(p.softSkills, "bg-wash text-ink-soft")}</Row>
      <Row label="Experience">{p.experience.length ? <ul className="space-y-2">{p.experience.map((e, i) => <li key={i}><b>{e.role}</b>{e.company && ` at ${e.company}`}{e.duration && <span className="text-slate"> · {e.duration}</span>}{e.description && <p className="text-slate">{e.description}</p>}</li>)}</ul> : <span className="text-mist">None found</span>}</Row>
      <Row label="Projects">{p.projects.length ? <ul className="space-y-2">{p.projects.map((e, i) => <li key={i}><b>{e.name}</b>{e.technologies.length > 0 && <span className="text-slate"> · {e.technologies.join(", ")}</span>}{e.description && <p className="text-slate">{e.description}</p>}</li>)}</ul> : <span className="text-mist">None found</span>}</Row>
      <Row label="Certifications">{p.certifications.length ? <ul className="space-y-1">{p.certifications.map((c, i) => <li key={i}>{c.name}{c.issuer && ` — ${c.issuer}`}{c.year && ` (${c.year})`}</li>)}</ul> : <span className="text-mist">None found</span>}</Row>
    </dl>
  );
}

function EditExtracted({ open, onClose, resumeId, initial, onSaved }: { open: boolean; onClose: () => void; resumeId: string; initial: ParsedResume; onSaved: () => void }) {
  const toast = useToast(); const [p, setP] = useState<ParsedResume>(initial); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api.put(`/resumes/${resumeId}/parsed`, p); toast("success", "Details saved"); onSaved(); } catch (e) { toast("error", e instanceof ApiError && e.details ? "Some fields are invalid" : errMsg(e)); } finally { setBusy(false); } };
  const upd = (patch: Partial<ParsedResume>) => setP((x) => ({ ...x, ...patch }));
  return (
    <Modal open={open} onClose={onClose} title="Edit extracted details" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name"><Input value={p.name} onChange={(e) => upd({ name: e.target.value })} /></Field><Field label="Email"><Input value={p.email} onChange={(e) => upd({ email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={p.phone} onChange={(e) => upd({ phone: e.target.value })} /></Field><Field label="Location"><Input value={p.location} onChange={(e) => upd({ location: e.target.value })} /></Field>
        </div>
        <Field label="Summary"><Textarea value={p.summary} onChange={(e) => upd({ summary: e.target.value })} /></Field>
        <Field label="Technical skills"><TagInput value={p.technicalSkills} onChange={(v) => upd({ technicalSkills: v })} placeholder="Add a skill" /></Field>
        <Field label="Soft skills"><TagInput value={p.softSkills} onChange={(v) => upd({ softSkills: v })} placeholder="Add a skill" /></Field>
        <div>
          <p className="text-sm font-semibold mb-2">Education</p>
          {p.education.map((e, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_90px_90px_auto] gap-2 mb-2 items-center">
              {(["degree", "institution", "year", "grade"] as const).map((k) => <Input key={k} placeholder={k} aria-label={k} value={e[k]} onChange={(ev) => upd({ education: p.education.map((x, j) => (j === i ? { ...x, [k]: ev.target.value } : x)) })} />)}
              <button className="text-bad p-2" aria-label="Remove education" onClick={() => upd({ education: p.education.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
            </div>
          ))}
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => upd({ education: [...p.education, { degree: "", institution: "", year: "", grade: "" }] })}>Add education</Button>
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} icon={<Save size={16} />} onClick={save}>Save changes</Button></div>
      </div>
    </Modal>
  );
}

function ImprovementView({ r }: { r: Improvement }) {
  return (
    <div className="space-y-5 text-sm">
      {r.rewrittenSummary && <div><h4 className="font-semibold mb-1">Suggested summary</h4><p className="rounded-xl bg-brand-soft/60 p-3">{r.rewrittenSummary}</p></div>}
      {r.improvedBullets.length > 0 && <div><h4 className="font-semibold mb-2">Stronger bullet points</h4><ul className="space-y-3">{r.improvedBullets.map((b, i) => <li key={i} className="rounded-xl border border-line p-3"><p className="text-slate line-through decoration-bad/40">{b.original}</p><p className="mt-1 font-medium">{b.improved}</p>{b.reason && <p className="text-xs text-slate mt-1">{b.reason}</p>}</li>)}</ul></div>}
      {r.missingKeywords.length > 0 && <div><h4 className="font-semibold mb-1.5">Keywords to consider</h4><div className="flex flex-wrap gap-1.5">{r.missingKeywords.map((k) => <Badge key={k} tone="brand">{k}</Badge>)}</div></div>}
      {r.sectionAdvice.length > 0 && <div><h4 className="font-semibold mb-1.5">Section advice</h4><ul className="space-y-1.5">{r.sectionAdvice.map((s) => <li key={s.section}><b>{s.section}:</b> {s.advice}</li>)}</ul></div>}
      {r.overallNotes && <p className="text-slate">{r.overallNotes}</p>}
      <p className="text-xs text-mist">Review every suggestion. Replace any [X] placeholder with your real figure, and never add experience you don't have.</p>
    </div>
  );
}

function ImproveModal({ open, onClose, resumeId }: { open: boolean; onClose: () => void; resumeId: string }) {
  const toast = useToast(); const [role, setRole] = useState(""); const [busy, setBusy] = useState(false); const [res, setRes] = useState<Improvement | null>(null);
  const go = async () => { setBusy(true); try { setRes((await api.post<{ improvement: Improvement }>(`/resumes/${resumeId}/improve`, { targetRole: role.trim() || undefined })).improvement); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} title="Improve your resume" wide>
      {!res ? (
        <div className="space-y-4"><Field label="Target role (optional)" hint="Tailors the keywords and wording"><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Full Stack Developer" /></Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} icon={<Wand2 size={16} />} onClick={go}>Generate suggestions</Button></div></div>
      ) : <><ImprovementView r={res} /><div className="flex justify-end gap-2 mt-5"><Button variant="secondary" onClick={() => setRes(null)}>Try another role</Button><Button onClick={onClose}>Done</Button></div></>}
    </Modal>
  );
}

function ImprovementsHistory({ resumeId }: { resumeId: string }) {
  const { data } = useApi<{ improvements: Improvement[] }>(`/resumes/${resumeId}/improvements`);
  const [open, setOpen] = useState<Improvement | null>(null);
  if (!data?.improvements.length) return null;
  return (
    <Card className="p-6"><h3 className="font-semibold mb-3">Earlier suggestions</h3>
      <ul className="divide-y divide-line">{data.improvements.map((i: any) => <li key={i.id} className="flex items-center justify-between py-2.5"><span className="text-sm">{i.targetRole || "General"} <span className="text-slate">· {date(i.createdAt)}</span></span><Button size="sm" variant="ghost" onClick={() => setOpen(i)}>View</Button></li>)}</ul>
      <Modal open={!!open} onClose={() => setOpen(null)} title={`Suggestions for ${open?.targetRole || "general use"}`} wide>{open && <ImprovementView r={open} />}</Modal>
    </Card>
  );
}
