import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError, api, errMsg } from "../lib/api";
import type { Profile } from "../lib/types";
import { BasicsSection, Draft, EducationSection, ExperienceSection, PreferencesSection, SkillsSection, emptyDraft, toDraft, toPayload } from "../components/ProfileForm";
import { Button, Card, Logo, Notice, Spinner, cx } from "../components/ui";

const STEPS = [
  { key: "about", title: "About you", blurb: "Start with the basics." },
  { key: "education", title: "Education", blurb: "Where you study and when you graduate." },
  { key: "skills", title: "Skills", blurb: "These drive your job matches, so be thorough." },
  { key: "experience", title: "Experience", blurb: "Projects, internships and certifications all count." },
  { key: "goals", title: "Goals", blurb: "Tell us what you're aiming for." },
];

export default function Onboarding() {
  const { user, reload } = useAuth();
  const nav = useNavigate(); const toast = useToast();
  const [d, setD] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<{ profile: Profile }>("/profile").then((r) => setD(toDraft({ ...r.profile, fullName: r.profile.fullName }))).catch((e) => toast("error", errMsg(e))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const save = async (finish: boolean) => {
    setBusy(true); setErrors({});
    try {
      await api.put("/profile", { ...toPayload(d), ...(finish ? { completeOnboarding: true } : {}) });
      if (finish) { await reload(); toast("success", "Profile saved. Let's find your matches."); nav(`/resume`, { replace: true }); }
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.details) { setErrors(e.details); const first = Object.keys(e.details)[0]; if (["fullName", "phone", "headline", "summary"].includes(first)) setStep(0); else if (["college", "degree", "graduationYear", "cgpa"].includes(first)) setStep(1); }
      toast("error", errMsg(e)); return false;
    } finally { setBusy(false); }
  };
  const next = async () => { if (step === 0 && d.fullName.trim().length < 2) return setErrors({ fullName: "Enter your full name" }); if (await save(false)) setStep((s) => s + 1); };
  const last = step === STEPS.length - 1;

  if (loading) return <div className="min-h-screen grid place-items-center"><Spinner className="h-8 w-8" /></div>;
  return (
    <div className="min-h-screen bg-paper">
      <header className="max-w-3xl mx-auto px-5 h-[76px] flex items-center justify-between"><Logo /><span className="text-sm text-slate">Hi {user?.fullName.split(" ")[0]}</span></header>
      <div className="max-w-3xl mx-auto px-5 pb-16">
        <ol className="flex gap-2 mb-8" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex-1">
              <div className={cx("h-1.5 rounded-full transition-colors", i <= step ? "bg-brand" : "bg-line")} />
              <p className={cx("mt-2 text-xs font-semibold hidden sm:flex items-center gap-1", i === step ? "text-ink" : "text-mist")}>{i < step && <Check size={12} className="text-good" />}{s.title}</p>
            </li>
          ))}
        </ol>
        <h1 className="text-3xl font-semibold">{STEPS[step].title}</h1>
        <p className="text-slate mt-1 mb-6">{STEPS[step].blurb}</p>
        <Card className="p-5 sm:p-7">
          {Object.keys(errors).length > 0 && <div className="mb-5"><Notice tone="bad">Please fix the highlighted fields.</Notice></div>}
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {step === 0 && <BasicsSection d={d} set={set} errors={errors} />}
              {step === 1 && <EducationSection d={d} set={set} errors={errors} />}
              {step === 2 && <SkillsSection d={d} set={set} />}
              {step === 3 && <ExperienceSection d={d} set={set} />}
              {step === 4 && <PreferencesSection d={d} set={set} errors={errors} />}
            </motion.div>
          </AnimatePresence>
        </Card>
        <div className="flex justify-between mt-6">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy} icon={<ArrowLeft size={16} />}>Back</Button>
          {last ? <Button loading={busy} onClick={() => save(true)}>Finish setup</Button> : <Button loading={busy} onClick={next}>Continue <ArrowRight size={16} /></Button>}
        </div>
        <p className="text-xs text-mist text-center mt-6">You can edit everything later from Profile.</p>
      </div>
    </div>
  );
}
