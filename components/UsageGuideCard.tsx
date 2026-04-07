"use client";

// ═══════════════════════════════════════════════════════════════
// components/UsageGuideCard.tsx — 直接覆盖
//
// 改动：从大段结构化卡片简化成3条简短tips
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from "react";
import { Rocket } from "lucide-react";

interface UsageGuideCardProps {
  analysisJSON: string | null;
}

export default function UsageGuideCard({ analysisJSON }: UsageGuideCardProps) {
  const tips: string[] | null = useMemo(() => {
    if (!analysisJSON) return null;
    try {
      const parsed = JSON.parse(analysisJSON);
      // Support both new usage_tips array and old usage_guide object
      if (Array.isArray(parsed.usage_tips) && parsed.usage_tips.length > 0) return parsed.usage_tips;
      if (parsed.usage_guide?.action_steps) return parsed.usage_guide.action_steps;
      if (typeof parsed.usage_guide === 'string') return [parsed.usage_guide];
      return null;
    } catch { return null; }
  }, [analysisJSON]);

  if (!tips || tips.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="grid size-6 place-items-center rounded-lg bg-emerald-500/10">
          <Rocket className="size-3 text-emerald-400" />
        </div>
        <span className="text-sm font-semibold text-emerald-400">Next Steps</span>
      </div>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-sm text-slate-300 leading-relaxed">{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}