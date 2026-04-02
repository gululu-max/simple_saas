"use client";

import Image from "next/image";

const issues = [
  {
    id: 1,
    label: "Poor lighting on face",
    anchorX: "62%",
    anchorY: "35%",
  },
  {
    id: 2,
    label: "Distracting background",
    anchorX: "30%",
    anchorY: "22%",
  },
  {
    id: 3,
    label: "Bad cropping",
    anchorX: "15%",
    anchorY: "12%",
  },
  {
    id: 4,
    label: "Closed body language",
    anchorX: "55%",
    anchorY: "62%",
  },
  {
    id: 5,
    label: "No eye connection",
    anchorX: "68%",
    anchorY: "28%",
  },
];

export function PhotoDiagnosis() {
  return (
    <section className="pt-12 pb-10 bg-slate-950">
      <div className="container px-4 md:px-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 leading-tight">
            Think your photos are{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
              fine?
            </span>
          </h2>
          <p className="text-slate-400 text-base md:text-lg">
            That&apos;s what 89% of guys with low matches believe.
          </p>
        </div>

        {/* Annotated Photo */}
        <div className="relative mx-auto rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-red-950/20">
          {/* Image */}
          <div className="relative aspect-[4/3] w-full">
            <Image
              src="/diagnosis-demo.webp"
              alt="Example dating profile photo with issues"
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover"
              priority
            />

            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/30" />

            {/* Score badge — bottom right to cover watermark */}
            <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-lg">
              <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
              Score: 41/100
            </div>

            {/* Numbered issue markers */}
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="absolute z-20 flex items-center justify-center"
                style={{
                  top: issue.anchorY,
                  left: issue.anchorX,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {/* Pulse ring */}
                <span
                  className="absolute w-8 h-8 rounded-full bg-red-500/25 animate-ping"
                  style={{ animationDuration: `${2 + issue.id * 0.4}s` }}
                />
                {/* Numbered dot */}
                <span className="relative flex items-center justify-center w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow-lg shadow-red-500/50 text-white text-[11px] font-bold leading-none">
                  {issue.id}
                </span>
              </div>
            ))}
          </div>

          {/* Issues list below photo */}
          <div className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 px-4 py-4">
            <div className="flex flex-col gap-2.5">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 text-[10px] font-bold">
                    {issue.id}
                  </span>
                  <span className="text-slate-300">{issue.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom text */}
        <p className="text-center text-slate-500 text-sm mt-6 max-w-sm mx-auto">
          The problems you can&apos;t see are the ones killing your matches.
        </p>
      </div>
    </section>
  );
}