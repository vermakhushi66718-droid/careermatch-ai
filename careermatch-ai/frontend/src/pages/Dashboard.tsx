import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, FileText, Mic, Route, Sparkles, UserRound, Briefcase } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../lib/useApi";
import type { Job } from "../lib/types";
import { STATUS_LABEL, date } from "../lib/format";
import JobCard from "../components/JobCard";
import { Button, Card, CardSkeletons, EmptyState, ErrorState, Notice, PageHeader, ScoreRing, Skeleton } from "../components/ui";

interface Dash {
  profileCompleteness: number; atsScore: number | null; hasResume: boolean; skillCount: number; avgTopMatch: number; savedJobs: number;
  applications: { total: number; byStatus: Record<string, number> }; upcomingFollowUps: { id: string; company: string; title: string; followUpAt: string }[];
  roadmaps: { id: string; title: string; percent: number }[]; interviewTrend: { date: string; score: number; role: string }[]; topSkillGaps: { skill: string; jobs: number }[];
}

function Stat({ label, value, hint, ring }: { label: string; value: string | number; hint?: string; ring?: number }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      {ring !== undefined && <ScoreRing value={ring} size={54} label={label} />}
      <div className="min-w-0"><p className="text-sm text-slate">{label}</p>{ring === undefined && <p className="font-display text-3xl font-semibold leading-tight">{value}</p>}{hint && <p className="text-xs text-mist mt-0.5">{hint}</p>}</div>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<Dash>("/dashboard");
  const recs = useApi<{ jobs: Job[]; hasSkills: boolean }>("/jobs/recommendations");

  if (loading) return <div className="space-y-5"><Skeleton className="h-10 w-1/3" /><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[20px]" />)}</div><CardSkeletons count={2} className="h-64" /></div>;
  if (error || !data) return <ErrorState message={error ?? "No data"} onRetry={reload} />;

  const steps = [
    !data.hasResume && { to: "/resume", icon: FileText, t: "Upload your resume", d: "Get an ATS score and have your skills extracted automatically." },
    data.profileCompleteness < 80 && { to: "/profile", icon: UserRound, t: "Complete your profile", d: `${data.profileCompleteness}% done. A fuller profile gives sharper matches.` },
    data.roadmaps.length === 0 && { to: "/roadmaps", icon: Route, t: "Build a learning roadmap", d: "Turn missing skills into a plan." },
    data.interviewTrend.length === 0 && { to: "/interviews", icon: Mic, t: "Try a mock interview", d: "Practise with role-specific questions." },
  ].filter(Boolean) as { to: string; icon: any; t: string; d: string }[];

  const funnel = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"].map((s) => ({ status: STATUS_LABEL[s], count: data.applications.byStatus[s] ?? 0 }));
  const trend = data.interviewTrend.map((t, i) => ({ n: `#${i + 1}`, score: t.score, role: t.role }));

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${user?.fullName.split(" ")[0]}`} subtitle="Here is where your job search stands." />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Profile complete" value="" ring={data.profileCompleteness} hint={`${data.skillCount} skills recognised`} />
        {data.atsScore !== null ? <Stat label="Resume ATS score" value="" ring={data.atsScore} hint="From your primary resume" /> : <Stat label="Resume ATS score" value="—" hint="Upload a resume to see it" />}
        <Stat label="Average of your top 5 matches" value="" ring={data.avgTopMatch} hint={`${data.savedJobs} saved jobs`} />
        <Stat label="Applications tracked" value={data.applications.total} hint={`${data.applications.byStatus.INTERVIEWING ?? 0} interviewing · ${data.applications.byStatus.OFFER ?? 0} offers`} />
      </div>

      {steps.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Good next steps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {steps.map((s) => (
              <Link key={s.to} to={s.to} className="group rounded-2xl border border-line p-4 hover:border-brand hover:bg-brand-soft/40 transition-colors">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-brand-soft text-brand mb-3"><s.icon size={19} /></span>
                <p className="font-semibold flex items-center gap-1">{s.t}<ArrowRight size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" /></p>
                <p className="text-sm text-slate mt-0.5">{s.d}</p>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 items-start">
        <section>
          <div className="flex items-center justify-between mb-3"><h2 className="text-xl font-semibold">Best matches for you</h2><Link to="/jobs" className="text-sm font-semibold text-brand">See all jobs</Link></div>
          {recs.loading ? <CardSkeletons count={3} className="h-40" /> : recs.error ? <ErrorState message={recs.error} onRetry={recs.reload} />
            : recs.data && !recs.data.hasSkills ? <Card><EmptyState icon={<Sparkles size={24} />} title="Add skills to see matches" body="Upload a resume or list your skills and we'll rank every opening for you." action={<Link to="/profile"><Button>Add skills</Button></Link>} /></Card>
            : <div className="space-y-4">{recs.data!.jobs.slice(0, 4).map((j) => <JobCard key={j.id} job={j} />)}</div>}
        </section>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Skills to learn next</h2>
            <p className="text-sm text-slate mb-4">Most often missing across your 25 best-matching jobs.</p>
            {data.topSkillGaps.length === 0 ? <p className="text-sm text-slate">No gaps found yet. Add your skills first.</p> : (
              <ul className="space-y-2.5">{data.topSkillGaps.map((g) => (
                <li key={g.skill} className="flex items-center gap-3"><span className="flex-1 font-semibold text-sm">{g.skill}</span><div className="w-28 h-2 rounded-full bg-wash overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(100, (g.jobs / 25) * 100 * 2)}%` }} /></div><span className="text-xs text-slate w-14 text-right">{g.jobs} jobs</span></li>
              ))}</ul>
            )}
            <Link to="/roadmaps"><Button variant="soft" className="mt-5 w-full" icon={<Route size={16} />}>Create a roadmap</Button></Link>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3">Application pipeline</h2>
            {data.applications.total === 0 ? <p className="text-sm text-slate">Nothing tracked yet. Open a job and choose “Track application”.</p> : (
              <div className="h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={funnel} margin={{ left: -24, right: 8 }}><CartesianGrid vertical={false} stroke="#e3e9f3" /><XAxis dataKey="status" tick={{ fontSize: 11, fill: "#5b6b86" }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5b6b86" }} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: "#eef2fb" }} /><Bar dataKey="count" fill="#2554ff" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
            )}
            {data.upcomingFollowUps.length > 0 && <div className="mt-4 pt-4 border-t border-line"><p className="text-sm font-semibold mb-2">Upcoming follow-ups</p><ul className="space-y-1.5 text-sm">{data.upcomingFollowUps.map((f) => <li key={f.id} className="flex justify-between gap-2"><span className="truncate">{f.title} · {f.company}</span><span className="text-slate shrink-0">{date(f.followUpAt)}</span></li>)}</ul></div>}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold">Roadmap progress</h2><Link to="/roadmaps" className="text-sm font-semibold text-brand">Open</Link></div>
          {data.roadmaps.length === 0 ? <p className="text-sm text-slate">No roadmaps yet.</p> : <ul className="space-y-4">{data.roadmaps.map((r) => <li key={r.id}><div className="flex justify-between text-sm mb-1.5"><span className="font-semibold truncate pr-3">{r.title}</span><span className="text-slate">{r.percent}%</span></div><div className="h-2 rounded-full bg-wash overflow-hidden"><div className="h-full rounded-full bg-good" style={{ width: `${r.percent}%` }} /></div></li>)}</ul>}
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold">Interview scores</h2><Link to="/interviews" className="text-sm font-semibold text-brand">Practise</Link></div>
          {trend.length === 0 ? <p className="text-sm text-slate">Complete a mock interview to see your progress here.</p> : (
            <div className="h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ left: -24, right: 12 }}><CartesianGrid vertical={false} stroke="#e3e9f3" /><XAxis dataKey="n" tick={{ fontSize: 11, fill: "#5b6b86" }} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#5b6b86" }} tickLine={false} axisLine={false} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#2554ff" strokeWidth={3} dot={{ r: 4, fill: "#2554ff" }} /></LineChart></ResponsiveContainer></div>
          )}
        </Card>
      </div>
      {!data.hasResume && <Notice tone="info" action={<Link to="/resume"><Button size="sm">Upload resume</Button></Link>}><Briefcase className="inline mr-2" size={15} />Your matches improve as soon as we can read your resume.</Notice>}
    </div>
  );
}
