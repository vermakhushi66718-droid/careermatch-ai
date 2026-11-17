import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Flag, Send } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { api, errMsg } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { InterviewQuestion, InterviewSession } from "../lib/types";
import { Badge, Button, Card, ErrorState, Notice, ScoreRing, Skeleton, Textarea, cx } from "../components/ui";

export default function InterviewSessionPage() {
  const { id } = useParams(); const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<{ session: InterviewSession }>(`/interviews/${id}`);
  const [idx, setIdx] = useState(0); const [answer, setAnswer] = useState(""); const [busy, setBusy] = useState(false); const [finishing, setFinishing] = useState(false);
  const s = data?.session;
  useEffect(() => { if (s && s.status === "IN_PROGRESS") { const first = s.questions.findIndex((q) => !q.answeredAt); setIdx(first === -1 ? 0 : first); } }, [s?.id]); // eslint-disable-line
  useEffect(() => { setAnswer(""); }, [idx]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-72 rounded-[20px]" /></div>;
  if (error || !s) return <ErrorState message={error ?? "Interview not found"} onRetry={reload} />;

  const q = s.questions[idx]; const done = s.status === "COMPLETED";
  const answeredCount = s.questions.filter((x) => x.answeredAt).length;
  const patchQ = (nq: InterviewQuestion) => setData({ session: { ...s, questions: s.questions.map((x) => (x.id === nq.id ? nq : x)) } });

  const submit = async () => {
    setBusy(true);
    try { const r = await api.post<{ question: InterviewQuestion }>(`/interviews/${s.id}/questions/${q.id}/answer`, { answer }); patchQ(r.question); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  };
  const finish = async () => {
    setFinishing(true);
    try { const r = await api.post<{ session: InterviewSession }>(`/interviews/${s.id}/complete`); setData({ session: r.session }); toast("success", "Interview completed"); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { toast("error", errMsg(e)); } finally { setFinishing(false); }
  };

  return (
    <div className="max-w-4xl">
      <Link to="/interviews" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-ink mb-4"><ArrowLeft size={16} />All interviews</Link>
      <div className="flex flex-wrap items-center gap-2 mb-1"><h1 className="text-[28px] font-semibold">{s.targetRole}</h1><Badge className="capitalize">{s.difficulty}</Badge></div>
      <p className="text-slate mb-6">{done ? "Interview complete. Review your results below." : `${answeredCount} of ${s.questions.length} answered`}</p>

      {done && s.summary && (
        <Card className="p-6 mb-6">
          <div className="flex flex-wrap items-center gap-5"><ScoreRing value={s.overallScore ?? 0} size={92} stroke={10} label="Overall score" /><div className="flex-1 min-w-[240px]"><h2 className="text-xl font-semibold">Overall result</h2><p className="text-ink-soft mt-1">{s.summary.summary}</p></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6 text-sm">
            <div><h3 className="font-semibold text-good mb-1.5">Strengths</h3><ul className="list-disc pl-5 space-y-1">{s.summary.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div><h3 className="font-semibold text-warn mb-1.5">Weaknesses</h3><ul className="list-disc pl-5 space-y-1">{s.summary.weaknesses.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div><h3 className="font-semibold text-brand mb-1.5">Next steps</h3><ul className="list-disc pl-5 space-y-1">{s.summary.nextSteps.map((x) => <li key={x}>{x}</li>)}</ul></div>
          </div>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto scroll-thin pb-2 mb-4" role="tablist" aria-label="Questions">
        {s.questions.map((x, i) => <button key={x.id} role="tab" aria-selected={i === idx} aria-label={`Question ${i + 1}${x.answeredAt ? ", answered" : ""}`} onClick={() => setIdx(i)}
          className={cx("h-10 w-10 shrink-0 rounded-xl text-sm font-semibold grid place-items-center border", i === idx ? "bg-ink text-white border-ink" : x.answeredAt ? "bg-good-soft text-good border-[#bfe8d2]" : "bg-surface border-line text-slate hover:border-brand")}>{x.answeredAt ? <CheckCircle2 size={17} /> : i + 1}</button>)}
      </div>

      <Card className="p-6 sm:p-7">
        <div className="flex items-center gap-2 mb-3"><Badge tone="brand" className="capitalize">{q.category}</Badge><span className="text-sm text-slate">Question {idx + 1} of {s.questions.length}</span></div>
        <h2 className="text-[22px] font-semibold leading-snug">{q.question}</h2>
        {q.answeredAt ? (
          <div className="mt-6 space-y-5">
            <div><p className="text-sm font-semibold text-slate mb-1.5">Your answer</p><p className="rounded-xl bg-paper border border-line p-4 whitespace-pre-line text-[15px]">{q.answer}</p></div>
            {q.feedback && (
              <div className="rounded-2xl border border-line p-5">
                <div className="flex items-center gap-4 mb-4"><ScoreRing value={(q.score ?? 0) * 10} size={56} label="Answer score" /><div><p className="font-semibold">Score {q.score}/10</p><p className="text-sm text-slate">Feedback on this answer</p></div></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                  <div><h3 className="font-semibold text-good mb-1.5">What worked</h3><ul className="list-disc pl-5 space-y-1">{q.feedback.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>
                  <div><h3 className="font-semibold text-warn mb-1.5">To improve</h3><ul className="list-disc pl-5 space-y-1">{q.feedback.improvements.map((x) => <li key={x}>{x}</li>)}</ul></div>
                </div>
                {q.feedback.sampleAnswer && <div className="mt-4 rounded-xl bg-brand-soft/60 p-4 text-sm"><p className="font-semibold mb-1">A strong answer might sound like</p><p className="text-ink-soft">{q.feedback.sampleAnswer}</p></div>}
              </div>
            )}
          </div>
        ) : done ? <p className="mt-5 text-slate">You skipped this question.</p> : (
          <div className="mt-5 space-y-3">
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer as you would say it in the interview…" className="min-h-[170px]" maxLength={6000} aria-label="Your answer" disabled={busy} />
            <div className="flex items-center justify-between"><span className="text-xs text-slate">{answer.length}/6000</span><Button onClick={submit} loading={busy} disabled={answer.trim().length < 10} icon={<Send size={16} />}>{busy ? "Scoring…" : "Submit answer"}</Button></div>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap justify-between gap-3 mt-5">
        <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</Button>
        <div className="flex gap-2">
          {idx < s.questions.length - 1 && <Button variant="secondary" onClick={() => setIdx(idx + 1)}>{q.answeredAt || done ? "Next" : "Skip"}</Button>}
          {!done && <Button variant={answeredCount === s.questions.length ? "primary" : "soft"} loading={finishing} disabled={answeredCount === 0} icon={<Flag size={16} />} onClick={finish}>Finish interview</Button>}
        </div>
      </div>
      {!done && answeredCount === 0 && <div className="mt-4"><Notice tone="info">Answer at least one question to finish and get your overall result.</Notice></div>}
    </div>
  );
}
