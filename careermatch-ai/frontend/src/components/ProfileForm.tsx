import { ReactNode, useRef } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import type { Profile } from "../lib/types";
import { Avatar, Button, Field, Input, TagInput, Textarea, Card } from "./ui";

export type Draft = Omit<Profile, "email" | "onboardingComplete" | "emailVerified" | "photoUrl">;
export const emptyDraft: Draft = {
  fullName: "", phone: "", headline: "", summary: "", college: "", degree: "", fieldOfStudy: "", graduationYear: null, cgpa: null,
  technicalSkills: [], softSkills: [], certifications: [], projects: [], internships: [], workExperience: [],
  preferredRoles: [], preferredLocations: [], expectedSalary: null, careerInterests: [],
};
export const toDraft = (p: Profile): Draft => ({ ...emptyDraft, ...p, phone: p.phone ?? "", headline: p.headline ?? "", summary: p.summary ?? "", college: p.college ?? "", degree: p.degree ?? "", fieldOfStudy: p.fieldOfStudy ?? "" });

/** Strip blanks so the API's nullable numbers/strings validate cleanly. */
export function toPayload(d: Draft) {
  const blank = (s: string | null) => (s && s.trim() ? s.trim() : null);
  const keep = (arr: any[]) => arr.filter((x) => Object.values(x).some((v) => typeof v === "string" && v.trim()));
  return {
    fullName: d.fullName.trim() || undefined, phone: blank(d.phone), headline: blank(d.headline), summary: blank(d.summary),
    college: blank(d.college), degree: blank(d.degree), fieldOfStudy: blank(d.fieldOfStudy),
    graduationYear: d.graduationYear || null, cgpa: d.cgpa ?? null, expectedSalary: d.expectedSalary || null,
    technicalSkills: d.technicalSkills, softSkills: d.softSkills, preferredRoles: d.preferredRoles, preferredLocations: d.preferredLocations, careerInterests: d.careerInterests,
    certifications: keep(d.certifications), projects: keep(d.projects), internships: keep(d.internships), workExperience: keep(d.workExperience),
  };
}

const SKILL_SUGGEST = ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "SQL", "PostgreSQL", "HTML", "CSS", "Git", "Docker", "AWS", "Machine Learning", "Data Structures", "REST APIs", "Figma", "Excel"];
const SOFT_SUGGEST = ["Communication", "Teamwork", "Problem Solving", "Leadership", "Time Management", "Adaptability"];
const ROLE_SUGGEST = ["Frontend Developer", "Full Stack Developer", "Backend Developer", "Data Analyst", "Machine Learning Engineer", "DevOps Engineer", "UI/UX Designer", "QA Engineer"];
const LOC_SUGGEST = ["Bengaluru", "Hyderabad", "Pune", "Mumbai", "Chennai", "Delhi", "Gurugram", "Remote"];

type SetDraft = (patch: Partial<Draft>) => void;
interface SectionProps { d: Draft; set: SetDraft; errors?: Record<string, string>; }
const grid = "grid grid-cols-1 sm:grid-cols-2 gap-4";

export function BasicsSection({ d, set, errors = {}, photo, onPhoto, onRemovePhoto, uploading }: SectionProps & { photo?: string | null; onPhoto?: (f: File) => void; onRemovePhoto?: () => void; uploading?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-5">
      {onPhoto && (
        <div className="flex items-center gap-4">
          <Avatar name={d.fullName || "?"} url={photo} size={72} />
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" loading={uploading} icon={<Camera size={15} />} onClick={() => fileRef.current?.click()}>Upload photo</Button>
              {photo && <Button type="button" variant="ghost" size="sm" onClick={onRemovePhoto}>Remove</Button>}
            </div>
            <p className="text-xs text-slate">JPG, PNG or WebP, up to 2 MB.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ""; }} />
          </div>
        </div>
      )}
      <div className={grid}>
        <Field label="Full name" error={errors.fullName} htmlFor="pf-name"><Input id="pf-name" value={d.fullName} onChange={(e) => set({ fullName: e.target.value })} invalid={!!errors.fullName} /></Field>
        <Field label="Phone (optional)" error={errors.phone} htmlFor="pf-phone"><Input id="pf-phone" value={d.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 98765 43210" invalid={!!errors.phone} /></Field>
      </div>
      <Field label="Headline" hint="One line about you, e.g. “Final-year BCA student focused on web development”" error={errors.headline} htmlFor="pf-head"><Input id="pf-head" value={d.headline ?? ""} onChange={(e) => set({ headline: e.target.value })} maxLength={150} /></Field>
      <Field label="About you" error={errors.summary} htmlFor="pf-sum"><Textarea id="pf-sum" value={d.summary ?? ""} onChange={(e) => set({ summary: e.target.value })} maxLength={1500} /></Field>
    </div>
  );
}

export function EducationSection({ d, set, errors = {} }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className={grid}>
        <Field label="College / university" error={errors.college} htmlFor="ed-col"><Input id="ed-col" value={d.college ?? ""} onChange={(e) => set({ college: e.target.value })} /></Field>
        <Field label="Degree" error={errors.degree} htmlFor="ed-deg"><Input id="ed-deg" value={d.degree ?? ""} onChange={(e) => set({ degree: e.target.value })} placeholder="BCA" /></Field>
        <Field label="Field of study" htmlFor="ed-fos"><Input id="ed-fos" value={d.fieldOfStudy ?? ""} onChange={(e) => set({ fieldOfStudy: e.target.value })} placeholder="Computer Applications" /></Field>
        <Field label="Graduation year" error={errors.graduationYear} htmlFor="ed-yr"><Input id="ed-yr" type="number" min={1990} max={2040} value={d.graduationYear ?? ""} onChange={(e) => set({ graduationYear: e.target.value ? Number(e.target.value) : null })} placeholder="2026" invalid={!!errors.graduationYear} /></Field>
        <Field label="CGPA (optional)" hint="Out of 10" error={errors.cgpa} htmlFor="ed-cg"><Input id="ed-cg" type="number" step="0.01" min={0} max={10} value={d.cgpa ?? ""} onChange={(e) => set({ cgpa: e.target.value ? Number(e.target.value) : null })} invalid={!!errors.cgpa} /></Field>
      </div>
    </div>
  );
}

export function SkillsSection({ d, set }: SectionProps) {
  return (
    <div className="space-y-5">
      <Field label="Technical skills" hint="Type a skill and press Enter. These drive your job matches."><TagInput value={d.technicalSkills} onChange={(v) => set({ technicalSkills: v })} placeholder="e.g. React, SQL, Python" suggestions={SKILL_SUGGEST} /></Field>
      <Field label="Soft skills"><TagInput value={d.softSkills} onChange={(v) => set({ softSkills: v })} placeholder="e.g. Communication" suggestions={SOFT_SUGGEST} /></Field>
    </div>
  );
}

interface FieldDef { key: string; label: string; type?: "text" | "textarea" | "month"; placeholder?: string; span2?: boolean; }
function EntryList({ items, onChange, fields, addLabel, empty, titleKey }: { items: any[]; onChange: (v: any[]) => void; fields: FieldDef[]; addLabel: string; empty: string; titleKey: string }) {
  const update = (i: number, k: string, v: string) => onChange(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-slate">{empty}</p>}
      {items.map((it, i) => (
        <Card key={i} className="p-4 !shadow-none bg-paper/50">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm truncate">{it[titleKey] || "New entry"}</p>
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-bad p-1 rounded-lg hover:bg-bad-soft" aria-label="Remove entry"><Trash2 size={16} /></button>
          </div>
          <div className={grid}>
            {fields.map((f) => (
              <div key={f.key} className={f.span2 || f.type === "textarea" ? "sm:col-span-2" : ""}>
                <Field label={f.label}>
                  {f.type === "textarea"
                    ? <Textarea value={it[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder} className="min-h-[72px]" maxLength={800} />
                    : <Input type={f.type === "month" ? "month" : "text"} value={it[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder} maxLength={150} />}
                </Field>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <Button type="button" variant="secondary" size="sm" icon={<Plus size={15} />} onClick={() => onChange([...items, {}])}>{addLabel}</Button>
    </div>
  );
}

const Group = ({ title, children }: { title: string; children: ReactNode }) => <div><h3 className="font-semibold text-[17px] mb-3">{title}</h3>{children}</div>;

export function ExperienceSection({ d, set }: SectionProps) {
  return (
    <div className="space-y-8">
      <Group title="Projects"><EntryList titleKey="name" items={d.projects} onChange={(v) => set({ projects: v })} addLabel="Add project" empty="Projects show employers what you can build."
        fields={[{ key: "name", label: "Project name" }, { key: "technologies", label: "Technologies used", placeholder: "React, Node.js" }, { key: "description", label: "What it does and what you built", type: "textarea" }, { key: "link", label: "Link (optional)", span2: true }]} /></Group>
      <Group title="Internships"><EntryList titleKey="role" items={d.internships} onChange={(v) => set({ internships: v })} addLabel="Add internship" empty="No internships added yet."
        fields={[{ key: "role", label: "Role" }, { key: "company", label: "Company" }, { key: "startDate", label: "Start", type: "month" }, { key: "endDate", label: "End", type: "month" }, { key: "description", label: "What you did", type: "textarea" }]} /></Group>
      <Group title="Work experience"><EntryList titleKey="role" items={d.workExperience} onChange={(v) => set({ workExperience: v })} addLabel="Add experience" empty="No work experience added yet."
        fields={[{ key: "role", label: "Role" }, { key: "company", label: "Company" }, { key: "startDate", label: "Start", type: "month" }, { key: "endDate", label: "End (leave empty if current)", type: "month" }, { key: "description", label: "What you did", type: "textarea" }]} /></Group>
      <Group title="Certifications"><EntryList titleKey="name" items={d.certifications} onChange={(v) => set({ certifications: v })} addLabel="Add certification" empty="No certifications added yet."
        fields={[{ key: "name", label: "Certification" }, { key: "issuer", label: "Issued by" }, { key: "year", label: "Year" }]} /></Group>
    </div>
  );
}

export function PreferencesSection({ d, set, errors = {} }: SectionProps) {
  return (
    <div className="space-y-5">
      <Field label="Preferred job roles"><TagInput value={d.preferredRoles} onChange={(v) => set({ preferredRoles: v })} placeholder="e.g. Full Stack Developer" suggestions={ROLE_SUGGEST} /></Field>
      <Field label="Preferred locations" hint="Remote roles always count as a location match."><TagInput value={d.preferredLocations} onChange={(v) => set({ preferredLocations: v })} placeholder="e.g. Pune" suggestions={LOC_SUGGEST} /></Field>
      <Field label="Career interests"><TagInput value={d.careerInterests} onChange={(v) => set({ careerInterests: v })} placeholder="e.g. AI, Fintech, Product" /></Field>
      <div className="max-w-xs"><Field label="Expected salary (optional)" hint="Annual, in ₹" error={errors.expectedSalary} htmlFor="pf-sal"><Input id="pf-sal" type="number" min={0} value={d.expectedSalary ?? ""} onChange={(e) => set({ expectedSalary: e.target.value ? Number(e.target.value) : null })} placeholder="600000" /></Field></div>
    </div>
  );
}
