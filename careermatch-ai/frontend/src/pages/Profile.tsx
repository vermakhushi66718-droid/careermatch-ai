import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { ApiError, api, errMsg, setAccessToken } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { Profile } from "../lib/types";
import { BasicsSection, Draft, EducationSection, ExperienceSection, PreferencesSection, SkillsSection, emptyDraft, toDraft, toPayload } from "../components/ProfileForm";
import { Button, Card, CardSkeletons, ErrorState, Field, Input, PageHeader, cx } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const TABS = ["Basics", "Education", "Skills", "Experience", "Preferences", "Security"] as const;
type Tab = (typeof TABS)[number];

export default function ProfilePage() {
  const { user } = useAuth(); const toast = useToast();
  const { data, error, loading, reload } = useApi<{ profile: Profile }>("/profile");
  const [d, setD] = useState<Draft>(emptyDraft);
  const [tab, setTab] = useState<Tab>("Basics");
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (data) { setD(toDraft(data.profile)); setDirty(false); } }, [data]);
  useEffect(() => {
    let url: string | null = null; let alive = true;
    if (data?.profile.photoUrl && user) api.blob(`/profile/photo/${user.id}`).then((b) => { url = URL.createObjectURL(b); if (alive) setPhoto(url); }).catch(() => {});
    else setPhoto(null);
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [data?.profile.photoUrl, user]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (p: Partial<Draft>) => { setD((x) => ({ ...x, ...p })); setDirty(true); };
  const save = async () => {
    setBusy(true); setErrors({});
    try { await api.put("/profile", toPayload(d)); setDirty(false); toast("success", "Profile saved"); window.dispatchEvent(new Event("profile-updated")); await reload(); }
    catch (e) { if (e instanceof ApiError && e.details) setErrors(e.details); toast("error", errMsg(e)); } finally { setBusy(false); }
  };
  const upload = async (f: File) => {
    if (f.size > 2 * 1024 * 1024) return toast("error", "Image must be 2 MB or smaller");
    setUploading(true);
    try { const fd = new FormData(); fd.append("photo", f); await api.upload("/profile/photo", fd); toast("success", "Photo updated"); window.dispatchEvent(new Event("profile-updated")); await reload(); }
    catch (e) { toast("error", errMsg(e)); } finally { setUploading(false); }
  };
  const removePhoto = async () => { try { await api.del("/profile/photo"); toast("success", "Photo removed"); window.dispatchEvent(new Event("profile-updated")); await reload(); } catch (e) { toast("error", errMsg(e)); } };

  if (loading) return <CardSkeletons count={2} className="h-64" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div>
      <PageHeader title="Profile" subtitle="Your matches, roadmaps and interview questions are built from this information." />
      <div className="flex gap-1 overflow-x-auto scroll-thin mb-5 -mx-1 px-1" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap", tab === t ? "bg-ink text-white" : "text-slate hover:bg-wash")}>{t}</button>)}
      </div>
      <Card className="p-5 sm:p-7 max-w-3xl">
        {tab === "Basics" && <BasicsSection d={d} set={set} errors={errors} photo={photo} onPhoto={upload} onRemovePhoto={removePhoto} uploading={uploading} />}
        {tab === "Education" && <EducationSection d={d} set={set} errors={errors} />}
        {tab === "Skills" && <SkillsSection d={d} set={set} />}
        {tab === "Experience" && <ExperienceSection d={d} set={set} />}
        {tab === "Preferences" && <PreferencesSection d={d} set={set} errors={errors} />}
        {tab === "Security" && <ChangePassword />}
        {tab !== "Security" && (
          <div className="flex items-center justify-end gap-3 mt-7 pt-5 border-t border-line">
            {dirty && <span className="text-sm text-warn">Unsaved changes</span>}
            <Button loading={busy} onClick={save} disabled={!dirty}>Save changes</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function ChangePassword() {
  const toast = useToast(); const { setUser } = useAuth();
  const [f, setF] = useState({ currentPassword: "", newPassword: "", confirm: "" }); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErrs({});
    if (f.newPassword !== f.confirm) return setErrs({ confirm: "Passwords do not match" });
    setBusy(true);
    try { await api.post("/auth/change-password", { currentPassword: f.currentPassword, newPassword: f.newPassword }); toast("success", "Password changed. Please sign in again."); setAccessToken(null); setUser(null); }
    catch (ex) { if (ex instanceof ApiError && ex.details) setErrs(ex.details); toast("error", errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4 max-w-sm">
      <h3 className="font-semibold text-[17px]">Change password</h3>
      <p className="text-sm text-slate">You'll be signed out on all devices after changing it.</p>
      <Field label="Current password" error={errs.currentPassword}><Input type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} required /></Field>
      <Field label="New password" hint="8+ characters with upper, lower case and a number" error={errs.newPassword}><Input type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required /></Field>
      <Field label="Confirm new password" error={errs.confirm}><Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required /></Field>
      <Button type="submit" loading={busy}>Change password</Button>
    </form>
  );
}
