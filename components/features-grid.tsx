"use client";

import Image from "next/image";

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
          className="border border-slate-800 rounded-2xl bg-slate-900 overflow-hidden hover:border-red-500/30 transition-colors"
        >
          <div className="flex gap-3 p-4">
            {/* Before */}
            <div className="relative flex-1 rounded-xl overflow-hidden aspect-[3/4]">
              <Image
                src={c.beforeImg}
                alt={`${c.name} before`}
                fill
                sizes="(max-width: 768px) 45vw, 20vw"
                className="object-cover grayscale opacity-70"
                loading="lazy"
              />
              <div className="absolute top-2 left-2 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md z-10">
                {c.scoreBefore}/100
              </div>
              <span className="absolute bottom-2 left-2 text-[9px] font-bold uppercase tracking-widest bg-slate-800/80 backdrop-blur-sm text-slate-300 px-2 py-0.5 rounded z-10">
                Before
              </span>
            </div>

            {/* Arrow */}
            <div className="self-center text-slate-600 text-lg shrink-0">→</div>

            {/* After */}
            <div className="relative flex-1 rounded-xl overflow-hidden aspect-[3/4] ring-1 ring-emerald-500/30">
              <Image
                src={c.afterImg}
                alt={`${c.name} after`}
                fill
                sizes="(max-width: 768px) 45vw, 20vw"
                className="object-cover"
                loading="lazy"
              />
              <div className="absolute top-2 left-2 bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md z-10">
                {c.scoreAfter}/100
              </div>
              <span className="absolute bottom-2 left-2 text-[9px] font-bold uppercase tracking-widest bg-slate-800/80 backdrop-blur-sm text-slate-300 px-2 py-0.5 rounded z-10">
                After
              </span>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="px-4 pb-4 flex items-center justify-between">
            <span className="text-sm text-slate-400">{c.name}</span>
            <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-lg">
              ↑ {c.metric}
            </span>
          </div>
        </div>
      ))}

      {/* Your turn CTA text */}
      <p className="text-center text-slate-400 text-lg font-medium pt-2">
        Your turn.
      </p>
    </div>
  );
}