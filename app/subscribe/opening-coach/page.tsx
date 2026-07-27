"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, MessageCircleHeart, RefreshCw, Sparkles } from "lucide-react";

type Opener = { text: string; label: string; why: string; watchOut: string };
type GenerateResult = { strategy: string; openers: Opener[] };
type Simulation = { reply: string; tip: string };
type Review = { scores: Record<string, number>; feedback: string; rewrite: string };
type Vibe = "playful" | "natural" | "direct" | "thoughtful";

async function callCoach(body: Record<string, unknown>) {
  const res = await fetch("/api/opening-coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function OpeningCoachPage() {
  const [profile, setProfile] = useState("");
  const [vibe, setVibe] = useState<Vibe>("natural");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [selected, setSelected] = useState<Opener | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [reply, setReply] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState<"generate" | "simulate" | "review" | null>(null);
  const [error, setError] = useState("");

  const generate = async () => {
    setError(""); setLoading("generate"); setResult(null); setSelected(null); setSimulation(null); setReview(null);
    try { setResult(await callCoach({ action: "generate", profile, vibe })); }
    catch (err) { setError(err instanceof Error ? err.message : "Try again."); }
    finally { setLoading(null); }
  };
  const simulate = async (opener: Opener) => {
    setError(""); setSelected(opener); setSimulation(null); setReview(null); setLoading("simulate");
    try { setSimulation(await callCoach({ action: "simulate", profile, vibe, opener: opener.text })); }
    catch (err) { setError(err instanceof Error ? err.message : "Try again."); }
    finally { setLoading(null); }
  };
  const reviewReply = async () => {
    if (!selected || !reply.trim()) return;
    setError(""); setLoading("review");
    try { setReview(await callCoach({ action: "review", profile, vibe, opener: selected.text, userReply: reply })); }
    catch (err) { setError(err instanceof Error ? err.message : "Try again."); }
    finally { setLoading(null); }
  };

  return <main className="min-h-screen bg-canvas text-ink">
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="text-center mb-8">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-rausch/10 text-rausch"><MessageCircleHeart className="size-6" /></div>
        <h1 className="text-3xl font-bold tracking-tight">Opening Coach</h1>
        <p className="mt-2 text-ink-muted">Turn a match into a conversation — without copy-paste lines.</p>
      </div>

      <section className="rounded-card border border-hairline bg-white p-5 shadow-ab-card md:p-7">
        <label className="text-sm font-semibold">Their profile, bio, or prompts</label>
        <textarea value={profile} onChange={(e) => setProfile(e.target.value)} maxLength={1200} rows={6} placeholder="Example: Loves tiny bookstores, is training for a half marathon, and says her ideal Sunday is coffee and a museum." className="mt-2 w-full resize-y rounded-btn border border-hairline bg-canvas p-3 text-sm outline-none focus:border-rausch" />
        <div className="mt-4"><p className="text-sm font-semibold">Your tone</p><div className="mt-2 flex flex-wrap gap-2">{(["playful", "natural", "direct", "thoughtful"] as Vibe[]).map((item) => <button key={item} onClick={() => setVibe(item)} className={`rounded-pill px-4 py-2 text-sm font-medium capitalize transition-colors ${vibe === item ? "bg-rausch text-white" : "bg-surface-soft text-ink-body hover:bg-surface-strong"}`}>{item}</button>)}</div></div>
        <button onClick={generate} disabled={profile.trim().length < 10 || !!loading} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-btn bg-rausch px-5 font-semibold text-white hover:bg-rausch-active disabled:opacity-50 sm:w-auto">
          {loading === "generate" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Create openers
        </button>
        {error && <p className="mt-3 text-sm text-rausch">{error}</p>}
      </section>

      {result && <section className="mt-6"><p className="mb-4 text-center text-sm text-ink-muted">{result.strategy}</p><div className="grid gap-4">{result.openers?.slice(0, 3).map((opener, index) => <article key={`${opener.text}-${index}`} className={`rounded-card border p-5 ${selected?.text === opener.text ? "border-rausch bg-rausch/5" : "border-hairline bg-white"}`}><div className="flex items-center justify-between gap-3"><span className="rounded-pill bg-surface-soft px-2.5 py-1 text-xs font-semibold text-ink-muted">{opener.label}</span><span className="text-xs text-ink-muted">Option {index + 1}</span></div><p className="mt-3 text-base font-medium leading-relaxed">“{opener.text}”</p><p className="mt-3 text-sm text-ink-body"><b>Why it works:</b> {opener.why}</p><p className="mt-1 text-sm text-ink-muted"><b>Watch out:</b> {opener.watchOut}</p><button onClick={() => simulate(opener)} disabled={!!loading} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-rausch hover:underline disabled:opacity-50">{loading === "simulate" && selected?.text === opener.text ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Practice this opener</button></article>)}</div></section>}

      {simulation && selected && <section className="mt-6 rounded-card border border-hairline bg-white p-5 shadow-ab-card md:p-7"><div className="flex items-center gap-2 text-sm font-semibold"><Check className="size-4 text-emerald-600" /> Plausible reply to practice with</div><p className="mt-3 rounded-btn bg-surface-soft p-3 text-sm leading-relaxed">“{simulation.reply}”</p><p className="mt-3 text-sm text-ink-muted">Coach tip: {simulation.tip}</p><label className="mt-5 block text-sm font-semibold">Write your next message</label><textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={700} rows={3} placeholder="Reply as you normally would…" className="mt-2 w-full resize-y rounded-btn border border-hairline bg-canvas p-3 text-sm outline-none focus:border-rausch" /><button onClick={reviewReply} disabled={!reply.trim() || !!loading} className="mt-3 inline-flex h-10 items-center gap-2 rounded-btn bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50">{loading === "review" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Coach my reply</button></section>}

      {review && <section className="mt-6 rounded-card border border-emerald-200 bg-emerald-50/50 p-5"><h2 className="font-bold">Your coaching notes</h2><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(review.scores || {}).map(([name, score]) => <div key={name} className="rounded-btn bg-white px-3 py-2 text-center"><div className="text-lg font-bold">{score}/5</div><div className="text-xs capitalize text-ink-muted">{name}</div></div>)}</div><p className="mt-4 text-sm leading-relaxed">{review.feedback}</p><div className="mt-3 rounded-btn border border-emerald-200 bg-white p-3 text-sm"><b>A stronger version:</b> “{review.rewrite}”</div></section>}
    </div>
  </main>;
}
