"use client";

// ═══════════════════════════════════════════════════════════════
// components/AnalysisResultCard.tsx — v4
//
// v4 changes vs v3:
// 1. Adapted to new JSON schema: copy.{headline,one_liner_positive,
//    one_liner_issue,first_impression,cta} instead of main_issue/positive
// 2. New route === 'needs_real_photo' renders a dedicated simple card
//    (no scores, no diagnostics, no enhance trigger)
// 3. authenticity enum: usable / suspiciously_edited / unusable
//    (suspiciously_edited shows a soft inline hint)
// 4. Backward compatible fallback: if old main_issue/positive present, use them
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from "react";
import {
  Sun, Camera, Mountain, Eye, Smile, Palette, Shirt, Focus,
  AlertTriangle, ThumbsUp, Crosshair, Copy, Check, TrendingUp,
  ChevronRight, ImageOff, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Route = 'needs_real_photo' | 'already_great' | 'can_improve';
type Authenticity = 'usable' | 'suspiciously_edited' | 'unusable';

interface AnalysisData {
  authenticity?: Authenticity | string;
  route?: Route | string;
  scores?: { attractiveness?: number; approachability?: number; confidence?: number } | null;
  percentile?: number | null;
  diagnostics?: {
    lighting?: number; composition?: number; background?: number; eye_contact?: number;
    expression?: number; color_grading?: number; clothing?: number; sharpness?: number;
  } | null;
  match_prediction?: { current_rate?: string; enhanced_rate?: string } | null;
  copy?: {
    headline?: string;
    one_liner_positive?: string | null;
    one_liner_issue?: string | null;
    first_impression?: string | null;
    cta?: string;
  };
  // Legacy fallback fields (old prompt)
  main_issue?: string;
  positive?: string;
  red_flags?: string[];
  fix_plan?: { visual_outcome?: string } | null;
}

interface AnalysisResultCardProps {
  analysisJSON: string | null;
  visibleText: string;
  onCopy: () => void;
  isCopied: boolean;
}

// ── Circular Gauge ───────────────────────────────────────────
function CircularGauge({ score, label }: { score: number; label: string }) {
  const r = 28, circ = 2 * Math.PI * r;
  const s = Math.max(0, Math.min(10, score));
  const progress = (s / 10) * circ;
  const color = s >= 8 ? { stroke: "#34d399", text: "text-emerald-400" } : s >= 5 ? { stroke: "#fbbf24", text: "text-amber-400" } : { stroke: "#f87171", text: "text-red-400" };
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative size-[68px]">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-800/60" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={color.stroke} strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - progress} className="transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center"><span className={`text-lg font-bold ${color.text}`}>{s}</span></div>
      </div>
      <span className="text-[11px] text-slate-500 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

// ── Diagnostic Bar ───────────────────────────────────────────
const diagnosticConfig: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'lighting', label: 'Lighting', icon: Sun },
  { key: 'composition', label: 'Composition', icon: Camera },
  { key: 'background', label: 'Background', icon: Mountain },
  { key: 'eye_contact', label: 'Eye Contact', icon: Eye },
  { key: 'expression', label: 'Expression', icon: Smile },
  { key: 'color_grading', label: 'Color Grading', icon: Palette },
  { key: 'clothing', label: 'Clothing', icon: Shirt },
  { key: 'sharpness', label: 'Sharpness', icon: Focus },
];

function DiagnosticBar({ icon: Icon, label, score }: { icon: React.ElementType; label: string; score: number }) {
  const s = Math.max(0, Math.min(10, score));
  const pct = s * 10;
  const barColor = s >= 8 ? 'bg-emerald-500' : s >= 5 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = s >= 8 ? 'text-emerald-400' : s >= 5 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-3.5 text-slate-500 flex-shrink-0" />
      <span className="text-xs text-slate-400 w-[90px] flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-5 text-right ${textColor}`}>{s}</span>
    </div>
  );
}

// ── Card Header (shared) ─────────────────────────────────────
function CardHeader({ onCopy, isCopied, title = 'Photo Analysis' }: { onCopy: () => void; isCopied: boolean; title?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-slate-800/30 border-b border-slate-800/40">
      <span className="text-rose-400 font-semibold text-sm flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded bg-rose-500/10">🎯</span> {title}
      </span>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-300" onClick={onCopy}>
        {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function AnalysisResultCard({ analysisJSON, visibleText, onCopy, isCopied }: AnalysisResultCardProps) {
  const data: AnalysisData | null = useMemo(() => {
    if (!analysisJSON) return null;
    try { return JSON.parse(analysisJSON); } catch { return null; }
  }, [analysisJSON]);

  // ── Fallback: 没有 JSON，只展示流式原文 ──
  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-rose-400 font-semibold text-sm flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded bg-rose-500/10">🎯</span> Your Profile Breakdown
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-300" onClick={onCopy}>
            {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{visibleText}</div>
      </div>
    );
  }

  // ── Route: needs_real_photo —— 不是真实照片，简洁提示卡 ──
  if (data.route === 'needs_real_photo') {
    const headline = data.copy?.headline ?? "This doesn't look like a real photo of you.";
    const cta = data.copy?.cta ?? "Upload a real photo of you. That's the one worth working with.";
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
        <CardHeader onCopy={onCopy} isCopied={isCopied} title="Quick Note" />
        <div className="p-5 flex flex-col items-center text-center gap-4">
          <div className="grid size-14 place-items-center rounded-full bg-amber-500/10 border border-amber-500/20">
            <ImageOff className="size-7 text-amber-500" />
          </div>
          <p className="text-base text-slate-200 leading-relaxed max-w-md">{headline}</p>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md">{cta}</p>
        </div>
      </div>
    );
  }

  // ── Route: already_great / can_improve —— 完整分析面板 ──
  const { scores, percentile, diagnostics, match_prediction, copy, red_flags, fix_plan, authenticity } = data;

  // 兼容旧字段：如果没有 copy.one_liner_issue 但有 main_issue，用旧字段
  const oneLinerIssue = copy?.one_liner_issue ?? data.main_issue ?? null;
  const oneLinerPositive = copy?.one_liner_positive ?? data.positive ?? null;
  const headline = copy?.headline ?? null;
  const firstImpression = copy?.first_impression ?? null;
  const cta = copy?.cta ?? null;

  const overallScore = scores ? Math.round(((scores.attractiveness ?? 0) + (scores.approachability ?? 0) + (scores.confidence ?? 0)) / 3 * 10) : 0;
  const isSuspicious = authenticity === 'suspiciously_edited';
  const isAlreadyGreat = data.route === 'already_great';

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
      <CardHeader onCopy={onCopy} isCopied={isCopied} />

      <div className="p-4 space-y-4">

        {/* ── Suspicious edit hint (very soft, inline) ── */}
        {isSuspicious && (
          <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2 leading-relaxed">
            Heads up — this one looks noticeably filtered. The analysis below is based on what we can see.
          </div>
        )}

        {/* ── 1. Headline (new) ── */}
        {headline && (
          <div className="text-base text-slate-200 leading-relaxed font-medium">
            {headline}
          </div>
        )}

        {/* ── 2. Score Gauges + Overall ── */}
        {scores && (
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-3 sm:gap-5">
              <CircularGauge score={scores.attractiveness ?? 0} label="Attractive" />
              <CircularGauge score={scores.approachability ?? 0} label="Approachable" />
              <CircularGauge score={scores.confidence ?? 0} label="Confident" />
            </div>
            <div className="flex flex-col items-center gap-0.5 pl-3 border-l border-slate-800/40">
              <div className="text-2xl font-bold text-white">{overallScore}</div>
              <div className="text-[10px] text-slate-500 font-medium">/100</div>
              {percentile != null && <div className="text-[10px] text-slate-500">Top {percentile}%</div>}
            </div>
          </div>
        )}

        {/* ── 3. Match Rate Prediction ── */}
        {match_prediction && (match_prediction.current_rate || match_prediction.enhanced_rate) && (
          <div className="rounded-lg border border-slate-800/40 bg-slate-950/40 p-3">
            <div className="flex items-center gap-1.5 mb-2.5">
              <TrendingUp className="size-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-400">Match Rate Prediction</span>
            </div>
            <div className="flex items-center gap-4">
              {match_prediction.current_rate && (
                <div className="flex-1 text-center">
                  <div className="text-lg font-bold text-red-400">{match_prediction.current_rate}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Current photo</div>
                </div>
              )}
              {match_prediction.current_rate && match_prediction.enhanced_rate && (
                <div className="text-slate-600 text-lg">→</div>
              )}
              {match_prediction.enhanced_rate && (
                <div className="flex-1 text-center">
                  <div className="text-lg font-bold text-emerald-400">{match_prediction.enhanced_rate}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">After enhancement</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 4. Diagnostics Panel ── */}
        {diagnostics && (
          <div className="rounded-lg border border-slate-800/40 bg-slate-950/40 p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-400 mb-1">Photo Diagnostics</div>
            {diagnosticConfig.map(({ key, label, icon }) => {
              const val = (diagnostics as any)[key];
              if (val == null) return null;
              return <DiagnosticBar key={key} icon={icon} label={label} score={val} />;
            })}
          </div>
        )}

        {/* ── 5. Main Issue (can_improve only — already_great has no issue) ── */}
        {oneLinerIssue && oneLinerIssue !== "none" && !isAlreadyGreat && (
          <div className="rounded-lg border border-red-500/15 bg-red-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-red-500/10 flex-shrink-0 mt-0.5"><Crosshair className="size-3.5 text-red-400" /></div>
              <div>
                <div className="text-xs font-semibold text-red-400 mb-0.5">#1 Issue Killing Your Matches</div>
                <div className="text-sm text-slate-300 leading-relaxed">{oneLinerIssue}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. Positive ── */}
        {oneLinerPositive && (
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 flex-shrink-0 mt-0.5"><ThumbsUp className="size-3.5 text-emerald-400" /></div>
              <div>
                <div className="text-xs font-semibold text-emerald-400 mb-0.5">What&apos;s Working</div>
                <div className="text-sm text-slate-300 leading-relaxed">{oneLinerPositive}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── 7. First Impression (new) ── */}
        {firstImpression && (
          <div className="rounded-lg border border-slate-800/40 bg-slate-950/40 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-slate-800/60 flex-shrink-0 mt-0.5"><Eye className="size-3.5 text-slate-400" /></div>
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-0.5">First Impression on a Dating App</div>
                <div className="text-sm text-slate-300 leading-relaxed">{firstImpression}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── 8. Red Flags ── */}
        {red_flags && red_flags.length > 0 && (
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-amber-500/10 flex-shrink-0 mt-0.5"><AlertTriangle className="size-3.5 text-amber-400" /></div>
              <div>
                <div className="text-xs font-semibold text-amber-400 mb-1">Red Flags</div>
                <div className="flex flex-wrap gap-1.5">
                  {red_flags.map((f, i) => (
                    <span key={i} className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-full">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 9. Visual Outcome ── */}
        {fix_plan?.visual_outcome && fix_plan.visual_outcome !== 'no edit needed' && (
          <div className="rounded-lg border border-rose-500/15 bg-rose-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-rose-500/10 flex-shrink-0 mt-0.5 text-sm">✨</div>
              <div>
                <div className="text-xs font-semibold text-rose-400 mb-0.5">What Enhancement Will Do</div>
                <div className="text-sm text-slate-300 leading-relaxed">{fix_plan.visual_outcome}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── 10. CTA (already_great has fun "ready to go" text) ── */}
        {cta && isAlreadyGreat && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-4 flex items-center gap-3">
            <Sparkles className="size-5 text-emerald-400 flex-shrink-0" />
            <div className="text-sm text-emerald-200 font-medium leading-relaxed">{cta}</div>
          </div>
        )}

        {/* ── 11. Full Analysis Text (collapsible, for copy/debug) ── */}
        {visibleText && (
          <details className="group">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 transition-colors flex items-center gap-1.5 py-1">
              <ChevronRight className="size-3.5 transition-transform duration-200 group-open:rotate-90" />
              <span>Full analysis</span>
            </summary>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300 rounded-lg border border-slate-800/40 bg-slate-950/40 p-3">
              {visibleText}
            </div>
          </details>
        )}

      </div>
    </div>
  );
}