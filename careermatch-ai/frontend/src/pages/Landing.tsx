import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, FileSearch, Mic, Route, Target, ClipboardList } from "lucide-react";
import { BreakdownBar, Button, Logo, ScoreRing } from "../components/ui";

const FEATURES = [
  { icon: FileSearch, t: "Resume analysis", d: "Upload a PDF. We pull out your skills, education and projects, score it for ATS readability, and let you correct anything we got wrong." },
  { icon: Target, t: "Matches you can check", d: "Every score is built from skills, role fit, location, experience and education, and each part is shown. No black box." },
  { icon: Route, t: "Learning roadmaps", d: "Pick a job and get an ordered plan for the skills you're missing, with a progress tracker." },
  { icon: Mic, t: "Mock interviews", d: "Answer role-specific questions and get a score, feedback and a model answer for each one." },
  { icon: ClipboardList, t: "Application tracker", d: "Keep every application, follow-up date and note in one place, from saved to offer." },
  { icon: BrainCircuit, t: "Career assistant", d: "Ask what to learn next or how to word a project. It knows your profile." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper overflow-x-clip">
      <header className="max-w-[1180px] mx-auto flex items-center justify-between px-5 h-[76px]">
        <Logo />
        <div className="flex items-center gap-2"><Link to="/login"><Button variant="ghost">Sign in</Button></Link><Link to="/register"><Button>Create free account</Button></Link></div>
      </header>

      <section className="max-w-[1180px] mx-auto px-5 pt-10 pb-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
        <div>
          <h1 className="text-[44px] sm:text-[58px] leading-[1.02] font-semibold text-ink">Know why a job fits you, and what to learn if it doesn't.</h1>
          <p className="text-lg text-slate mt-5 max-w-xl">CareerMatch AI reads your resume, scores every opening against your real skills, and builds the learning plan that closes the gap.</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/register"><Button className="px-6 py-3 text-[15px]">Get started <ArrowRight size={16} /></Button></Link>
            <Link to="/login"><Button variant="secondary" className="px-6 py-3 text-[15px]">I have an account</Button></Link>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative">
          <div className="absolute -inset-4 rounded-[36px] bg-brand-soft/70 -rotate-2" aria-hidden />
          <div className="relative bg-surface border border-line rounded-[24px] shadow-lift p-6">
            <div className="flex items-start gap-4">
              <ScoreRing value={78} size={76} stroke={8} label="Example match" />
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold leading-tight">Full Stack Developer</p>
                <p className="text-slate text-sm">Example listing · Hyderabad · Hybrid</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {["React", "Node.js", "PostgreSQL"].map((s) => <span key={s} className="rounded-md bg-good-soft text-good text-xs font-semibold px-2 py-0.5">{s}</span>)}
                  {["REST APIs", "Docker"].map((s) => <span key={s} className="rounded-md bg-bad-soft text-bad text-xs font-semibold px-2 py-0.5">{s} missing</span>)}
                </div>
              </div>
            </div>
            <div className="mt-6"><BreakdownBar breakdown={{ skills: 36, role: 14, location: 5, level: 10, education: 10 }} weights={{ skills: 55, role: 15, location: 10, level: 10, education: 10 }} /></div>
            <p className="text-xs text-mist mt-4">Illustration of how a score is explained. Your own matches use your profile and real listings.</p>
          </div>
        </motion.div>
      </section>

      <section className="bg-surface border-y border-line">
        <div className="max-w-[1180px] mx-auto px-5 py-16">
          <h2 className="text-3xl font-semibold max-w-xl">Everything between your resume and your offer letter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-9 mt-10">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex gap-4">
                <span className="grid place-items-center h-11 w-11 rounded-xl bg-brand-soft text-brand shrink-0"><f.icon size={20} /></span>
                <div><h3 className="font-semibold text-[17px]">{f.t}</h3><p className="text-slate text-sm mt-1">{f.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="max-w-[1180px] mx-auto px-5 py-10 text-sm text-slate flex flex-wrap justify-between gap-3">
        <span>CareerMatch AI — a BCA final-year project.</span>
        <span>Job listings in this build are fictional demonstration data.</span>
      </footer>
    </div>
  );
}
