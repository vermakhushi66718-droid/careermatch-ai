import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, MapPin, Wallet, FlaskConical } from "lucide-react";
import type { Job } from "../lib/types";
import { LEVEL_LABEL, MODE_LABEL, STATUS_LABEL, TYPE_LABEL, ago, salary } from "../lib/format";
import { Badge, Card, ScoreRing, cx } from "./ui";

export function SampleBadge() {
  return <Badge tone="warn" className="!font-semibold"><FlaskConical size={11} />Demo listing</Badge>;
}

export default function JobCard({ job, onToggleSave }: { job: Job; onToggleSave?: (j: Job) => void }) {
  const matched = job.matchedSkills ?? [], missing = job.missingSkills ?? [];
  return (
    <Card className="p-5 hover:shadow-lift transition-shadow">
      <div className="flex gap-4">
        {job.matchScore !== undefined && <ScoreRing value={job.matchScore} size={58} label="Match" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/jobs/${job.id}`} className="font-display text-[19px] font-semibold leading-snug hover:text-brand block truncate">{job.title}</Link>
              <p className="text-slate text-sm">{job.company}</p>
            </div>
            {onToggleSave && (
              <button onClick={() => onToggleSave(job)} aria-label={job.isSaved ? "Remove from saved" : "Save job"} aria-pressed={job.isSaved}
                className={cx("p-2 rounded-xl hover:bg-wash shrink-0", job.isSaved ? "text-brand" : "text-mist")}>{job.isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}</button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[13px] text-slate">
            <span className="flex items-center gap-1"><MapPin size={14} />{job.location}</span>
            <span className="flex items-center gap-1"><Wallet size={14} />{salary(job)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge tone={job.type === "INTERNSHIP" ? "brand" : "neutral"}>{TYPE_LABEL[job.type]}</Badge>
            <Badge>{MODE_LABEL[job.workMode]}</Badge><Badge>{LEVEL_LABEL[job.experienceLevel]}</Badge>
            {job.isSample && <SampleBadge />}
            {job.applicationStatus && <Badge tone="good">{STATUS_LABEL[job.applicationStatus]}</Badge>}
          </div>
          {(matched.length > 0 || missing.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {matched.slice(0, 5).map((s) => <span key={s} className="rounded-md bg-good-soft text-good text-xs font-semibold px-2 py-0.5">{s}</span>)}
              {missing.slice(0, 4).map((s) => <span key={s} className="rounded-md bg-bad-soft text-bad text-xs font-semibold px-2 py-0.5">needs {s}</span>)}
            </div>
          )}
          <p className="text-xs text-mist mt-3">Posted {ago(job.postedAt)}</p>
        </div>
      </div>
    </Card>
  );
}
