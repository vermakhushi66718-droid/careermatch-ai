import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/useApi";
import { STATUS_LABEL } from "../../lib/format";
import { Card, CardSkeletons, ErrorState, PageHeader, Notice, Button } from "../../components/ui";

interface Stats { totals: Record<string, number>; applicationsByStatus: { status: string; count: number }[]; signups: { date: string; count: number }[]; }
const TILES: [string, string][] = [["users", "Users"], ["newUsers", "New in 30 days"], ["jobs", "Active listings"], ["sampleJobs", "Demo listings"], ["resumes", "Resumes uploaded"], ["applications", "Applications tracked"], ["interviews", "Mock interviews"], ["roadmaps", "Roadmaps"]];

export default function AdminOverview() {
  const { data, error, loading, reload } = useApi<Stats>("/admin/stats");
  const cfg = useApi<{ aiConfigured: boolean; aiProvider: string }>("/config");
  if (loading) return <CardSkeletons count={3} className="h-40" />;
  if (error || !data) return <ErrorState message={error ?? "No data"} onRetry={reload} />;
  return (
    <div className="space-y-6">
      <PageHeader title="Admin overview" subtitle="Platform activity at a glance." actions={<><Link to="/admin/jobs"><Button>Manage listings</Button></Link><Link to="/admin/users"><Button variant="secondary">Users</Button></Link></>} />
      {cfg.data && <Notice tone={cfg.data.aiConfigured ? "good" : "warn"}>AI provider: <b className="capitalize">{cfg.data.aiProvider}</b> — {cfg.data.aiConfigured ? "API key configured." : "no API key set. Resume analysis, roadmaps, interviews and the assistant will return a configuration message until one is added."}</Notice>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{TILES.map(([k, l]) => <Card key={k} className="p-5"><p className="text-sm text-slate">{l}</p><p className="font-display text-3xl font-semibold mt-1">{data.totals[k] ?? 0}</p></Card>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6"><h2 className="text-lg font-semibold mb-4">Sign-ups, last 14 days</h2>
          <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.signups.map((s) => ({ ...s, d: s.date.slice(5) }))} margin={{ left: -24, right: 8 }}><CartesianGrid vertical={false} stroke="#e3e9f3" /><XAxis dataKey="d" tick={{ fontSize: 11, fill: "#5b6b86" }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5b6b86" }} tickLine={false} axisLine={false} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#2554ff" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div></Card>
        <Card className="p-6"><h2 className="text-lg font-semibold mb-4">Applications by status</h2>
          {data.applicationsByStatus.length === 0 ? <p className="text-sm text-slate">No applications yet.</p> : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.applicationsByStatus.map((a) => ({ ...a, label: STATUS_LABEL[a.status] }))} margin={{ left: -24, right: 8 }}><CartesianGrid vertical={false} stroke="#e3e9f3" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5b6b86" }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5b6b86" }} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: "#eef2fb" }} /><Bar dataKey="count" fill="#2554ff" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>}</Card>
      </div>
    </div>
  );
}
