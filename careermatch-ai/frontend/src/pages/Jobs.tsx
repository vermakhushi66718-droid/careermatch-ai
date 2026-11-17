import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Briefcase, Search, SlidersHorizontal, X } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api, errMsg } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { Job } from "../lib/types";
import JobCard from "../components/JobCard";
import { Button, CardSkeletons, EmptyState, ErrorState, Input, Notice, PageHeader, Pagination, Select, cx } from "../components/ui";

interface Resp { jobs: Job[]; total: number; page: number; totalPages: number; }
const TYPES = [["FULL_TIME", "Full-time"], ["INTERNSHIP", "Internship"], ["PART_TIME", "Part-time"], ["CONTRACT", "Contract"]];
const MODES = [["REMOTE", "Remote"], ["HYBRID", "Hybrid"], ["ONSITE", "On-site"]];
const LEVELS = [["FRESHER", "Fresher"], ["JUNIOR", "Junior"], ["MID", "Mid-level"], ["SENIOR", "Senior"]];

function Chips({ label, options, selected, onToggle }: { label: string; options: string[][]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold mb-2">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={selected.includes(v)} onClick={() => onToggle(v)}
            className={cx("rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors", selected.includes(v) ? "bg-brand text-white border-brand" : "border-line text-slate hover:border-brand hover:text-brand bg-surface")}>{l}</button>
        ))}
      </div>
    </fieldset>
  );
}

export default function Jobs() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const get = (k: string) => (sp.get(k) ? sp.get(k)!.split(",") : []);
  // Build the next URL from the *live* location, not a render closure: a debounced search timer
  // (created in an older render) must never overwrite a filter the user clicked in the meantime.
  const update = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(window.location.search);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!("page" in patch)) n.delete("page");
    navigate({ pathname: window.location.pathname, search: n.toString() }, { replace: true });
  };
  const toggle = (k: string, v: string) => { const cur = new URLSearchParams(window.location.search).get(k)?.split(",") ?? []; update({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") || null }); };

  useEffect(() => { const t = setTimeout(() => { if ((new URLSearchParams(window.location.search).get("q") ?? "") !== q.trim()) update({ q: q.trim() || null }); }, 350); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);

  const path = `/jobs?${sp.toString()}&pageSize=10`;
  const { data, error, loading, reload, setData } = useApi<Resp>(path);
  const cats = useApi<{ categories: string[] }>("/jobs/meta/filters");
  const active = ["type", "mode", "level", "category", "location", "saved", "minSalary"].filter((k) => sp.get(k)).length;
  const sort = sp.get("sort") ?? "match";

  const toggleSave = async (j: Job) => {
    const was = !!j.isSaved;
    setData((d) => (d ? { ...d, jobs: d.jobs.map((x) => (x.id === j.id ? { ...x, isSaved: !was } : x)) } : d));
    try { was ? await api.del(`/jobs/${j.id}/save`) : await api.post(`/jobs/${j.id}/save`); toast("success", was ? "Removed from saved jobs" : "Saved job"); if (sp.get("saved") === "true" && was) reload(); }
    catch (e) { toast("error", errMsg(e)); reload(); }
  };

  const filters = useMemo(() => (
    <div className="space-y-5">
      <Chips label="Job type" options={TYPES} selected={get("type")} onToggle={(v) => toggle("type", v)} />
      <Chips label="Work mode" options={MODES} selected={get("mode")} onToggle={(v) => toggle("mode", v)} />
      <Chips label="Experience" options={LEVELS} selected={get("level")} onToggle={(v) => toggle("level", v)} />
      {(cats.data?.categories.length ?? 0) > 0 && <Chips label="Category" options={cats.data!.categories.map((c) => [c, c])} selected={get("category")} onToggle={(v) => toggle("category", v)} />}
      <div><label className="text-sm font-semibold block mb-2" htmlFor="loc">Location</label><Input id="loc" defaultValue={sp.get("location") ?? ""} placeholder="e.g. Pune" onBlur={(e) => update({ location: e.target.value.trim() || null })} onKeyDown={(e) => e.key === "Enter" && update({ location: (e.target as HTMLInputElement).value.trim() || null })} /></div>
      <div><label className="text-sm font-semibold block mb-2" htmlFor="ms">Minimum pay (₹)</label><Input id="ms" type="number" min={0} defaultValue={sp.get("minSalary") ?? ""} placeholder="e.g. 500000" onBlur={(e) => update({ minSalary: e.target.value || null })} /></div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[#2554ff]" checked={sp.get("saved") === "true"} onChange={(e) => update({ saved: e.target.checked ? "true" : null })} />Saved jobs only</label>
      {active > 0 && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setSp(new URLSearchParams(), { replace: true }); }} icon={<X size={14} />}>Clear all filters</Button>}
    </div>
  ), [sp, cats.data, active]); // eslint-disable-line

  return (
    <div>
      <PageHeader title="Jobs & internships" subtitle="Ranked by how well each one fits your skills, preferences and experience." />
      <div className="mb-5"><Notice tone="warn">All listings in this build are <b>demonstration data</b> with fictional companies. Administrators can add custom listings.</Notice></div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[240px]"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, company, skill…" className="pl-10" aria-label="Search jobs" /></div>
        <Select value={sort} onChange={(e) => update({ sort: e.target.value === "match" ? null : e.target.value })} className="!w-auto" aria-label="Sort by">
          <option value="match">Best match</option><option value="recent">Most recent</option><option value="salary">Highest pay</option>
        </Select>
        <Button variant="secondary" className="lg:hidden" onClick={() => setShowFilters((v) => !v)} icon={<SlidersHorizontal size={16} />}>Filters{active ? ` (${active})` : ""}</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        <aside className={cx("bg-surface border border-line rounded-[20px] p-5 shadow-soft lg:sticky lg:top-[88px]", showFilters ? "block" : "hidden lg:block")}>{filters}</aside>
        <section aria-live="polite">
          {loading && !data ? <CardSkeletons count={4} className="h-40" />
            : error ? <ErrorState message={error} onRetry={reload} />
            : data && data.jobs.length === 0 ? <div className="bg-surface border border-line rounded-[20px]"><EmptyState icon={<Briefcase size={24} />} title="No jobs match these filters" body="Try removing a filter or searching for a broader term." action={<Button variant="secondary" onClick={() => { setQ(""); setSp(new URLSearchParams(), { replace: true }); }}>Clear filters</Button>} /></div>
            : data && (
              <div className={cx("space-y-4 transition-opacity", loading && "opacity-60")}>
                <p className="text-sm text-slate">{data.total} {data.total === 1 ? "result" : "results"}</p>
                {data.jobs.map((j) => <JobCard key={j.id} job={j} onToggleSave={toggleSave} />)}
                <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => { update({ page: String(p) }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              </div>
            )}
        </section>
      </div>
    </div>
  );
}
