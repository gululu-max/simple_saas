"use client";

// ═══════════════════════════════════════════════════════════════
// components/AnalysisResultCard.tsx — 直接覆盖
//
// 改动：
// - 新增 diagnostics 8维进度条面板
// - 新增 match prediction 区域
// - 保留原有的3个圆形仪表盘 + 属性pills + main_issue + positive + red_flags
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from "react";
import {
  Sun, Camera, Mountain, Eye, Smile, Palette, Shirt, Focus,
  AlertTriangle, ThumbsUp, Crosshair, Copy, Check, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalysisData {
  scores?: { attractiveness?: number; approachability?: number; confidence?: number };
  percentile?: number;
  diagnostics?: {
    lighting?: number; composition?: number; background?: number; eye_contact?: number;
    expression?: number; color_grading?: number; clothing?: number; sharpness?: number;
  };
  match_prediction?: { current_rate?: string; enhanced_rate?: string };
  main_issue?: string;
  positive?: string;
  red_flags?: string[];
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

// ═══════════════════════════════════════════════════════════════
export default function AnalysisResultCard({ analysisJSON, visibleText, onCopy, isCopied }: AnalysisResultCardProps) {
  const data: AnalysisData | null = useMemo(() => {
    if (!analysisJSON) return null;
    try { return JSON.parse(analysisJSON); } catch { return null; }
  }, [analysisJSON]);

  // Fallback: no JSON → plain text
  if (!data || !data.scores) {
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

  const { scores, percentile, diagnostics, match_prediction, main_issue, positive, red_flags } = data;
  const overallScore = scores ? Math.round(((scores.attractiveness ?? 0) + (scores.approachability ?? 0) + (scores.confidence ?? 0)) / 3 * 10) : 0;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/30 border-b border-slate-800/40">
        <span className="text-rose-400 font-semibold text-sm flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded bg-rose-500/10">🎯</span> Photo Analysis
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-300" onClick={onCopy}>
          {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* ── Score Gauges + Overall ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-3 sm:gap-5">
            <CircularGauge score={scores?.attractiveness ?? 0} label="Attractive" />
            <CircularGauge score={scores?.approachability ?? 0} label="Approachable" />
            <CircularGauge score={scores?.confidence ?? 0} label="Confident" />
          </div>
          <div className="flex flex-col items-center gap-0.5 pl-3 border-l border-slate-800/40">
            <div className="text-2xl font-bold text-white">{overallScore}</div>
            <div className="text-[10px] text-slate-500 font-medium">/100</div>
            {percentile != null && <div className="text-[10px] text-slate-500">Top {percentile}%</div>}
          </div>
        </div>

        {/* ── Match Prediction ── */}
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

        {/* ── Diagnostics Panel ── */}
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

        {/* ── Main Issue ── */}
        {main_issue && main_issue !== "none" && (
          <div className="rounded-lg border border-red-500/15 bg-red-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-red-500/10 flex-shrink-0 mt-0.5"><Crosshair className="size-3.5 text-red-400" /></div>
              <div><div className="text-xs font-semibold text-red-400 mb-0.5">#1 Issue Killing Your Matches</div><div className="text-sm text-slate-300 leading-relaxed">{main_issue}</div></div>
            </div>
          </div>
        )}

        {/* ── Red Flags ── */}
        {red_flags && red_flags.length > 0 && (
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-amber-500/10 flex-shrink-0 mt-0.5"><AlertTriangle className="size-3.5 text-amber-400" /></div>
              <div>
                <div className="text-xs font-semibold text-amber-400 mb-1">Red Flags</div>
                <div className="flex flex-wrap gap-1.5">{red_flags.map((f, i) => <span key={i} className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-full">{f}</span>)}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Positive ── */}
        {positive && (
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 flex-shrink-0 mt-0.5"><ThumbsUp className="size-3.5 text-emerald-400" /></div>
              <div><div className="text-xs font-semibold text-emerald-400 mb-0.5">What&apos;s Working</div><div className="text-sm text-slate-300 leading-relaxed">{positive}</div></div>
            </div>
          </div>
        )}

        {/* ── Full text (collapsed) ── */}
        {visibleText && (
          <details className="group">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 transition-colors flex items-center gap-1">
              <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span> Full analysis text
            </summary>
            <div className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-800/40 bg-slate-950/40 p-4 text-sm leading-relaxed text-slate-400">{visibleText}</div>
          </details>
        )}
      </div>
    </div>
  );
}