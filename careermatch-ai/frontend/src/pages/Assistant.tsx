import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Send, Trash2 } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { ApiError, api, errMsg } from "../lib/api";
import { useApi } from "../lib/useApi";
import { Button, Card, ConfirmDialog, ErrorState, Notice, PageHeader, Skeleton, cx } from "../components/ui";

interface Msg { id: string; role: "USER" | "ASSISTANT"; content: string; createdAt: string; }
const STARTERS = ["What skills should I learn next for a full stack role?", "How can I make my projects stand out on a fresher resume?", "How do I prepare for a first technical interview?", "Which of my skills are strongest for the job market?"];

export default function Assistant() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ messages: Msg[]; aiConfigured: boolean }>("/assistant/messages");
  const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [clear, setClear] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (data) setMsgs(data.messages); }, [data]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);

  const send = async (content: string) => {
    const c = content.trim(); if (!c || busy) return;
    setErr(""); setBusy(true); setText("");
    const temp: Msg = { id: "tmp", role: "USER", content: c, createdAt: new Date().toISOString() };
    setMsgs((m) => [...m, temp]);
    try { const r = await api.post<{ messages: Msg[] }>("/assistant/messages", { content: c }); setMsgs((m) => [...m.filter((x) => x.id !== "tmp"), ...r.messages]); }
    catch (e) { setMsgs((m) => m.filter((x) => x.id !== "tmp")); setText(c); setErr(e instanceof ApiError && e.code === "AI_NOT_CONFIGURED" ? "The assistant needs an AI API key. Add ANTHROPIC_API_KEY to the backend environment, restart the server and try again." : errMsg(e)); }
    finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); send(text); };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Career assistant" subtitle="Ask about skills, resumes, interviews or your next move. It knows your profile." actions={msgs.length > 0 && <Button variant="secondary" size="sm" icon={<Trash2 size={14} />} onClick={() => setClear(true)}>Clear chat</Button>} />
      {loading ? <Skeleton className="h-96 rounded-[20px]" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <Card className="flex flex-col h-[calc(100vh-290px)] min-h-[420px]">
          <div className="flex-1 overflow-y-auto scroll-thin p-5 space-y-4" aria-live="polite">
            {msgs.length === 0 && (
              <div className="h-full grid place-items-center text-center">
                <div><span className="inline-grid place-items-center h-14 w-14 rounded-2xl bg-brand-soft text-brand mb-3"><Bot size={26} /></span><h2 className="text-lg font-semibold">What would you like help with?</h2>
                  <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-xl">{STARTERS.map((s) => <button key={s} onClick={() => send(s)} className="text-sm rounded-xl border border-line px-3 py-2 text-left hover:border-brand hover:bg-brand-soft/40">{s}</button>)}</div></div>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={cx("flex", m.role === "USER" ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[85%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap text-[15px] leading-relaxed", m.role === "USER" ? "bg-brand text-white rounded-br-md" : "bg-wash text-ink rounded-bl-md")}>{m.content}</div>
              </div>
            ))}
            {busy && <div className="flex"><div className="bg-wash rounded-2xl rounded-bl-md px-4 py-3 flex gap-1" aria-label="Assistant is typing">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-mist animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div></div>}
            <div ref={end} />
          </div>
          {err && <div className="px-5 pb-3"><Notice tone="warn">{err}</Notice></div>}
          <form onSubmit={submit} className="border-t border-line p-3 flex gap-2 items-end">
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} rows={1} maxLength={2000} placeholder="Ask a question…" aria-label="Message"
              className="flex-1 resize-none rounded-xl border border-line px-3.5 py-2.5 text-sm max-h-32 focus:outline-none focus:ring-4 focus:ring-brand/15 focus:border-brand" />
            <Button type="submit" loading={busy} disabled={!text.trim()} aria-label="Send message" icon={<Send size={16} />}>Send</Button>
          </form>
        </Card>
      )}
      <p className="text-xs text-mist mt-3">AI advice can be wrong. It has no live job-market data, so check important decisions yourself.</p>
      <ConfirmDialog open={clear} danger title="Clear this conversation?" confirmLabel="Clear chat" body="All messages will be deleted." onClose={() => setClear(false)}
        onConfirm={async () => { try { await api.del("/assistant/messages"); setMsgs([]); setClear(false); toast("success", "Conversation cleared"); } catch (e) { toast("error", errMsg(e)); } }} />
    </div>
  );
}
