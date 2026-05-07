"use client";

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
      if (Array.isArray(parsed.usage_tips) && parsed.usage_tips.length > 0) {
        return parsed.usage_tips.filter((t: any) => typeof t === 'string' && t.trim().length > 0);
      }
      return null;
    } catch { return null; }
  }, [analysisJSON]);

  if (!tips || tips.length === 0) return null;

  return (
    <div className="rounded-card border border-hairline bg-canvas shadow-ab-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-hairline-soft">
        <Rocket className="size-4 text-rausch shrink-0" />
        <h3 className="text-[16px] font-semibold text-ink">Next steps</h3>
      </div>
      <ol className="px-5 py-2">
        {tips.map((tip, i) => (
          <li
            key={i}
            className="flex items-start gap-3 py-3 border-b border-hairline-soft last:border-b-0"
          >
            <span className="grid size-7 place-items-center rounded-full bg-ink text-canvas text-xs font-semibold shrink-0 tabular-nums">
              {i + 1}
            </span>
            <span className="text-sm text-ink-body leading-relaxed pt-0.5">{tip}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
