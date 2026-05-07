"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";

const cases = [
  {
    beforeImg: "/cases/kevin-before.webp",
    afterImg: "/cases/kevin-after.webp",
    name: "Kevin L., 26",
    scoreBefore: 31,
    scoreAfter: 89,
    metric: "+312% matches in 7 days",
  },
  {
    beforeImg: "/cases/ryan-before.webp",
    afterImg: "/cases/ryan-after.webp",
    name: "Ryan C., 28",
    scoreBefore: 38,
    scoreAfter: 85,
    metric: "+204% more conversations",
  },
  {
    beforeImg: "/cases/jason-before.webp",
    afterImg: "/cases/jason-after.webp",
    name: "Jason W., 31",
    scoreBefore: 27,
    scoreAfter: 91,
    metric: "30+ matches in first week",
  },
];

export function FeaturesGrid() {
  return (
    <div className="space-y-4">
      {cases.map((c, i) => (
        <div
          key={i}
          className="border border-hairline rounded-card bg-canvas overflow-hidden transition-shadow hover:shadow-ab-card"
        >
          <div className="flex items-center gap-3 p-4">
            {/* Before */}
            <div className="relative flex-1 rounded-card overflow-hidden aspect-[3/4] bg-surface-soft">
              <Image
                src={c.beforeImg}
                alt={`${c.name} before`}
                fill
                sizes="(max-width: 768px) 45vw, 20vw"
                className="object-cover"
                loading="lazy"
              />
              {/* Score badge — 白底 ink，单层阴影 */}
              <div className="absolute top-2 left-2 z-10 inline-flex items-center bg-canvas text-ink text-[11px] font-semibold px-2 py-0.5 rounded-pill shadow-ab-card">
                {c.scoreBefore}
              </div>
              {/* BEFORE label — 白底 ink uppercase */}
              <span className="absolute bottom-2 left-2 z-10 bg-canvas text-ink text-[8px] font-bold uppercase tracking-[0.32px] px-2 py-0.5 rounded-pill">
                Before
              </span>
            </div>

            {/* Arrow — ink-soft */}
            <ArrowRight className="w-5 h-5 text-ink-soft shrink-0" />

            {/* After — ink solid badge 强化"对比终点" */}
            <div className="relative flex-1 rounded-card overflow-hidden aspect-[3/4] bg-surface-soft">
              <Image
                src={c.afterImg}
                alt={`${c.name} after`}
                fill
                sizes="(max-width: 768px) 45vw, 20vw"
                className="object-cover"
                loading="lazy"
              />
              {/* Score badge — ink 实心白字（"高亮态"，类似 date-picker selected） */}
              <div className="absolute top-2 left-2 z-10 inline-flex items-center bg-ink text-white text-[11px] font-semibold px-2 py-0.5 rounded-pill">
                {c.scoreAfter}
              </div>
              <span className="absolute bottom-2 left-2 z-10 bg-ink text-white text-[8px] font-bold uppercase tracking-[0.32px] px-2 py-0.5 rounded-pill">
                After
              </span>
            </div>
          </div>

          {/* Bottom bar — ink-muted 名字，Rausch 单色 metric */}
          <div className="px-4 pb-4 flex items-center justify-between border-t border-hairline-soft pt-3">
            <span className="text-sm text-ink-muted">{c.name}</span>
            <span className="inline-flex items-center gap-1 text-rausch text-[13px] font-semibold">
              ↑ {c.metric}
            </span>
          </div>
        </div>
      ))}

      <p className="text-center text-ink-muted text-base font-medium pt-2">
        Your turn.
      </p>
    </div>
  );
}
