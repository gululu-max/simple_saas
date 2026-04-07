"use client";

// ═══════════════════════════════════════════════════════════════
// components/AnalysisResultCard.tsx
// 新建文件
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from "react";
import {
  Sun, Mountain, Smile, AlertTriangle, ThumbsUp, Crosshair, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalysisData {
  scores?: { attractiveness?: number; approachability?: number; confidence?: number };
  percentile?: number;
  lighting?: string;
  background?: string;
  expression?: string;
  main_issue?: string;
  positive?: string;
  red_flags?: string[];
  fix_plan?: { suggestion?: string } | null;
}

interface AnalysisResultCardProps {
  analysisJSON: string | null;
  visibleText: string;
  onCopy: () => void;
  isCopied: boolean;
}

function CircularGauge({ score, label }: { score: number; label: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.max(0, Math.min(10, score));
  const progress = (normalizedScore / 10) * circumference;
  const getColor = (s: number) => {
    if (s >= 8) return { stroke: "#34d399", text: "text-emerald-400" };
    if (s >= 5) return { stroke: "#fbbf24", text: "text-amber-400" };
    return { stroke: "#f87171", text: "text-red-400" };
  };
  const color = getColor(normalizedScore);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative size-[72px]">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-800/60" />
          <circle cx="36" cy="36" r={radius} fill="none" stroke={color.stroke} strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - progress} className="transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${color.text}`}>{normalizedScore}</span>
        </div>
      </div>
      <span className="text-[11px] text-slate-500 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

function AttributePill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  const getStyle = (v: string) => {
    const l = v.toLowerCase();
    if (["high", "clean", "warm"].includes(l)) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (["medium", "neutral"].includes(l)) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 text-slate-500 flex-shrink-0" />
      <span className="text-slate-500">{label}</span>
      <span className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${getStyle(value)}`}>{value}</span>
    </div>
  );
}

export default function AnalysisResultCard({ analysisJSON, visibleText, onCopy, isCopied }: AnalysisResultCardProps) {
  const data: AnalysisData | null = useMemo(() => {
    if (!analysisJSON) return null;
    try { return JSON.parse(analysisJSON); } catch { return null; }
  }, [analysisJSON]);

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

  const { scores, percentile, lighting, background, expression, main_issue, positive, red_flags } = data;
  const overallScore = scores ? Math.round(((scores.attractiveness ?? 0) + (scores.approachability ?? 0) + (scores.confidence ?? 0)) / 3 * 10) : 0;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/30 border-b border-slate-800/40">
        <span className="text-rose-400 font-semibold text-sm flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded bg-rose-500/10">🎯</span> Your Profile Breakdown
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-300" onClick={onCopy}>
          {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="p-4 space-y-5">
        {/* Score Gauges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-4 sm:gap-6">
            <CircularGauge score={scores?.attractiveness ?? 0} label="Attractive" />
            <CircularGauge score={scores?.approachability ?? 0} label="Approachable" />
            <CircularGauge score={scores?.confidence ?? 0} label="Confident" />
          </div>
          <div className="flex flex-col items-center gap-1 pl-2 border-l border-slate-800/40">
            <div className="text-2xl font-bold text-white">{overallScore}</div>
            <div className="text-[10px] text-slate-500 font-medium text-center leading-tight">/100 overall</div>
            {percentile != null && <div className="text-[10px] text-slate-500 mt-0.5">Top {percentile}%</div>}
          </div>
        </div>

        {/* Photo Attributes */}
        {(lighting || background || expression) && (
          <div className="rounded-lg border border-slate-800/40 bg-slate-950/40 p-3 space-y-2.5">
            {lighting && <AttributePill icon={Sun} label="Lighting" value={lighting} />}
            {background && <AttributePill icon={Mountain} label="Background" value={background} />}
            {expression && <AttributePill icon={Smile} label="Expression" value={expression} />}
          </div>
        )}

        {/* Main Issue */}
        {main_issue && main_issue !== "none" && (
          <div className="rounded-lg border border-red-500/15 bg-red-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-red-500/10 flex-shrink-0 mt-0.5"><Crosshair className="size-3.5 text-red-400" /></div>
              <div><div className="text-xs font-semibold text-red-400 mb-0.5">#1 Issue Killing Your Matches</div><div className="text-sm text-slate-300 leading-relaxed">{main_issue}</div></div>
            </div>
          </div>
        )}

        {/* Red Flags */}
        {red_flags && red_flags.length > 0 && (
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-amber-500/10 flex-shrink-0 mt-0.5"><AlertTriangle className="size-3.5 text-amber-400" /></div>
              <div>
                <div className="text-xs font-semibold text-amber-400 mb-1">Red Flags</div>
                <div className="flex flex-wrap gap-1.5">
                  {red_flags.map((flag, i) => <span key={i} className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-full">{flag}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Positive */}
        {positive && (
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 flex-shrink-0 mt-0.5"><ThumbsUp className="size-3.5 text-emerald-400" /></div>
              <div><div className="text-xs font-semibold text-emerald-400 mb-0.5">What&apos;s Working</div><div className="text-sm text-slate-300 leading-relaxed">{positive}</div></div>
            </div>
          </div>
        )}

        {/* Full text (collapsed) */}
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