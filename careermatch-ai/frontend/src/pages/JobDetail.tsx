import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, MapPin, Route, Sparkles, Wallet, ClipboardPlus } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { ApiError, api, errMsg } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { Job, Match } from "../lib/types";
import { LEVEL_LABEL, MODE_LABEL, STATUS_LABEL, TYPE_LABEL, date, salary } from "../lib/format";
import { SampleBadge } from "../components/JobCard";
import { Badge, BreakdownBar, Button, Card, ErrorState, Notice, ScoreRing, Skeleton } from "../components/ui";

interface Explain { summary: string; strengths: string[]; gaps: string[]; advice: string; }

export default function JobDetail() {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast();
  const { data, error, loading, reload } = useApi<{ job: Job; match: Match }>(`/jobs/${id}`);
  const [explain, setExplain] = useState<Explain | null>(null);
  const [explaining, setExplaining] = useState(false); const [aiErr, setAiErr] = useState("");
  const [busy, setBusy] = useState("");

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-72 w-full rounded-[20px]" /></div>;
  if (error || !data) return <ErrorState message={error ?? "This job is no longer available."} onRetry={reload} />;
  const { job, match } = data;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast("success", ok); await reload(); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(""); }
  };
  const doExplain = async () => {
    setExplaining(true); setAiErr("");
    try { setExplain((await api.post<{ explanation: Explain }>(`/jobs/${job.id}/explain`)).explanation); }
    catch (e) { setAiErr(e instanceof ApiError && e.code === "AI_NOT_CONFIGURED" ? "AI explanations need an API key. Set ANTHROPIC_API_KEY on the server. The score breakdown above works without it." : errMsg(e)); }
    finally { setExplaining(false); }
  };

  return (
    <div>
      <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-ink mb-4"><ArrowLeft size={16} />All jobs</Link>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-wrap gap-1.5 mb-3">
              <Badge tone={job.type === "INTERNSHIP" ? "brand" : "neutral"}>{TYPE_LABEL[job.type]}</Badge><Badge>{MODE_LABEL[job.workMode]}</Badge><Badge>{LEVEL_LABEL[job.experienceLevel]}</Badge>
              {job.category && <Badge>{job.category}</Badge>}{job.isSample && <SampleBadge />}
            </div>
            <h1 className="text-[30px] sm:text-[36px] font-semibold leading-tight">{job.title}</h1>
            <p className="text-lg text-slate mt-1">{job.company}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-4 text-sm text-slate">
              <span className="flex items-center gap-1.5"><MapPin size={16} />{job.location}</span>
              <span className="flex items-center gap-1.5"><Wallet size={16} />{salary(job)}</span>
              <span>Posted {date(job.postedAt)}</span>{job.minCgpa != null && <span>Minimum CGPA {job.minCgpa}</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              {job.applicationId
                ? <Button variant="soft" onClick={() => nav("/applications")}>Tracked: {STATUS_LABEL[job.applicationStatus!]}</Button>
                : <Button icon={<ClipboardPlus size={16} />} loading={busy === "track"} onClick={() => run("track", () => api.post(`/applications/from-job/${job.id}`, { status: "SAVED" }), "Added to your application tracker")}>Track application</Button>}
              <Button variant="secondary" icon={job.isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} loading={busy === "save"}
                onClick={() => run("save", () => (job.isSaved ? api.del(`/jobs/${job.id}/save`) : api.post(`/jobs/${job.id}/save`)), job.isSaved ? "Removed from saved jobs" : "Saved job")}>{job.isSaved ? "Saved" : "Save"}</Button>
              {job.applyUrl && <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"><Button variant="secondary" icon={<ExternalLink size={16} />}>Apply on company site</Button></a>}
            </div>
          </Card>
          <Card className="p-6 sm:p-8">
            <h2 className="text-xl font-semibold mb-3">About the role</h2>
            <p className="text-ink-soft whitespace-pre-line max-w-[70ch] leading-relaxed">{job.description}</p>
            <h3 className="font-semibold mt-6 mb-2">Required skills</h3>
            <div className="flex flex-wrap gap-1.5">{job.requiredSkills.map((s) => { const ok = match.matchedSkills.some((m) => m.toLowerCase() === s.toLowerCase()); return <span key={s} className={`rounded-md text-[13px] font-semibold px-2.5 py-1 ${ok ? "bg-good-soft text-good" : "bg-wash text-ink-soft"}`}>{s}</span>; })}</div>
            {job.preferredSkills.length > 0 && <><h3 className="font-semibold mt-5 mb-2">Nice to have</h3><div className="flex flex-wrap gap-1.5">{job.preferredSkills.map((s) => <span key={s} className="rounded-md bg-wash text-slate text-[13px] font-semibold px-2.5 py-1">{s}</span>)}</div></>}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4"><ScoreRing value={match.score} size={84} stroke={9} label="Match" /><div><h2 className="text-xl font-semibold">Your match</h2><p className="text-sm text-slate">Computed from your profile and resume</p></div></div>
            <div className="mt-5"><BreakdownBar breakdown={match.breakdown} weights={match.weights} /></div>
            <ul className="mt-5 space-y-1.5 text-sm text-ink-soft list-disc pl-5">{match.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            {match.missingSkills.length > 0 && (
              <div className="mt-5 pt-5 border-t border-line">
                <h3 className="font-semibold mb-2">Skills to learn</h3>
                <div className="flex flex-wrap gap-1.5">{match.missingSkills.map((s) => <span key={s} className="rounded-md bg-bad-soft text-bad text-xs font-semibold px-2 py-0.5">{s}</span>)}</div>
                <Button className="mt-4 w-full" variant="soft" icon={<Route size={16} />} onClick={() => nav(`/roadmaps?jobId=${job.id}`)}>Build a roadmap for these</Button>
              </div>
            )}
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Explain this match</h2>
            <p className="text-sm text-slate mt-1">A plain-language read of the score above.</p>
            {aiErr && <div className="mt-3"><Notice tone="warn">{aiErr}</Notice></div>}
            {explain ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-ink-soft">{explain.summary}</p>
                {explain.strengths.length > 0 && <div><p className="font-semibold text-good mb-1">Working for you</p><ul className="list-disc pl-5 space-y-0.5">{explain.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>}
                {explain.gaps.length > 0 && <div><p className="font-semibold text-bad mb-1">Gaps</p><ul className="list-disc pl-5 space-y-0.5">{explain.gaps.map((s) => <li key={s}>{s}</li>)}</ul></div>}
                {explain.advice && <p className="rounded-xl bg-brand-soft px-3 py-2 text-ink-soft"><b>Next step:</b> {explain.advice}</p>}
              </div>
            ) : <Button className="mt-4 w-full" variant="secondary" icon={<Sparkles size={16} />} loading={explaining} onClick={doExplain}>Explain with AI</Button>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
