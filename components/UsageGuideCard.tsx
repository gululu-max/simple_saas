"use client";

// ═══════════════════════════════════════════════════════════════
// components/UsageGuideCard.tsx
// 新建文件
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from "react";
import { Rocket, Sparkles, Target, Clock, Heart } from "lucide-react";

interface UsageGuideData {
  platform?: string;
  impression?: string[];
  action_steps?: string[];
  vibe?: string;
}

interface UsageGuideCardProps {
  analysisJSON: string | null;
}

// Platform badge colors
function getPlatformStyle(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("hinge")) return { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/25" };
  if (p.includes("bumble")) return { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/25" };
  if (p.includes("tinder")) return { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/25" };
  return { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/25" };
}

export default function UsageGuideCard({ analysisJSON }: UsageGuideCardProps) {
  const guide: UsageGuideData | null = useMemo(() => {
    if (!analysisJSON) return null;
    try {
      const parsed = JSON.parse(analysisJSON);
      return parsed.usage_guide ?? null;
    } catch {
      return null;
    }
  }, [analysisJSON]);

  if (!guide) return null;

  const { platform, impression, action_steps, vibe } = guide;
  const platformStyle = platform ? getPlatformStyle(platform) : null;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/30 border-b border-slate-800/40">
        <span className="text-emerald-400 font-semibold text-sm flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded bg-emerald-500/10">
            <Rocket className="size-3 text-emerald-400" />
          </span>
          Your Action Plan
        </span>
      </div>

      <div className="p-4 space-y-4">

        {/* Platform recommendation */}
        {platform && platformStyle && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Best for</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${platformStyle.bg} ${platformStyle.text} ${platformStyle.border}`}>
              <Target className="size-3.5" />
              {platform}
            </span>
          </div>
        )}

        {/* Vibe / impression summary */}
        {vibe && (
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
            <div className="flex items-start gap-2.5">
              <div className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 flex-shrink-0 mt-0.5">
                <Heart className="size-3.5 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-emerald-400 mb-0.5">The vibe this gives off</div>
                <div className="text-sm text-slate-300 leading-relaxed">{vibe}</div>
              </div>
            </div>
          </div>
        )}

        {/* Impression tags */}
        {impression && impression.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-2">People will see you as</div>
            <div className="flex flex-wrap gap-2">
              {impression.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/60 border border-slate-700/40 text-slate-300 capitalize"
                >
                  <Sparkles className="size-2.5 text-emerald-400" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action steps */}
        {action_steps && action_steps.length > 0 && (
          <div className="rounded-lg border border-slate-800/40 bg-slate-950/40 p-3 space-y-2.5">
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Clock className="size-3 text-slate-500" />
              Do this tonight
            </div>
            {action_steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="grid size-5 place-items-center rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-300 leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}