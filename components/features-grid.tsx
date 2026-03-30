"use client";

import Image from "next/image";

const cases = [
  {
    app: "Tinder",
    location: "New York",
    emoji: "📱",
    beforeImg: "/cases/kevin-before.webp",
    afterImg: "/cases/kevin-after.webp",
    quote:
      "I was getting almost no matches for months and had no idea why. The AI showed exactly what was wrong with my photos — bad lighting, awkward posture, and zero personality. I fixed a few shots, and the same night I got more matches than the entire previous month.",
    name: "Kevin L.",
    meta: "26 · Software Engineer",
    avatarBg: "linear-gradient(135deg, #1e3a5f, #0d1f35)",
    avatarEmoji: "👨",
    metrics: [
      { val: "+312%", label: "matches in 7 days" },
      { val: "+89%", label: "more replies" },
    ],
    featured: true,
  },
  {
    app: "Hinge",
    location: "Los Angeles",
    emoji: "📱",
    beforeImg: "/cases/mia-before.webp",
    afterImg: "/cases/mia-after.webp",
    quote:
      "I always thought my best photo was actually hurting my profile. The AI pointed it out instantly. I replaced it — and my matches and conversations literally doubled overnight.",
    name: "Mia Z.",
    meta: "28 · Brand Designer",
    avatarBg: "linear-gradient(135deg, #3a1e3a, #200d35)",
    avatarEmoji: "👩",
    metrics: [{ val: "+204%", label: "more conversations" }],
    featured: false,
  },
  {
    app: "Bumble",
    location: "Chicago",
    emoji: "📱",
    beforeImg: "/cases/jason-before.webp",
    afterImg: "/cases/jason-after.webp",
    quote:
      "I had no idea what made a good dating photo. My first score was 3/10. The feedback was clear and practical — I followed it, retook my photos, and jumped to 8.5. I finally started getting consistent matches.",
    name: "Jason W.",
    meta: "31 · Marketing Manager",
    avatarBg: "linear-gradient(135deg, #1e3a28, #0d3520)",
    avatarEmoji: "🧔",
    metrics: [{ val: "3 → 8.5", label: "photo score" }],
    featured: false,
  },
];

const miniQuotes = [
  {
    quote:
      "The first upload already showed me something I never noticed — I looked the same in every photo. Fixing that alone made my profile feel way more natural and attractive.",
    name: "Sophie T.",
    sub: "24 · Tinder",
    avatarBg: "#1e2535",
    avatarEmoji: "👧",
  },
  {
    quote:
      "I almost didn't try it because of privacy. But knowing my photos get deleted instantly made me trust it — and the feedback was actually useful.",
    name: "Ryan C.",
    sub: "29 · Hinge",
    avatarBg: "#201a15",
    avatarEmoji: "🧑",
  },
  {
    quote:
      "Getting a score changed everything. I finally understood what works and what doesn't — and I could actually improve instead of guessing.",
    name: "Alex M.",
    sub: "33 · Bumble",
    avatarBg: "#1a2035",
    avatarEmoji: "👦",
  },
];

export function FeaturesGrid() {
  const [featured, ...rest] = cases;

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-800 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900">
        {[
          { num: "+247%", label: "avg. match rate increase" },
          { num: "3.2 days", label: "avg. time to see results" },
          { num: "12,000+", label: "photos optimized" },
          { num: "4.9★", label: "user satisfaction" },
        ].map((s, i) => (
          <div key={i} className="py-5 px-6 text-center">
            <div className="text-2xl font-bold text-orange-400 mb-1">{s.num}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Featured card */}
      <div className="grid md:grid-cols-2 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 hover:border-red-500/30 transition-colors">
        {/* Visual side */}
        <div className="bg-slate-950/60 p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-800">
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
            <div className="relative rounded-xl overflow-hidden aspect-[3/4]">
              <Image
                src={featured.beforeImg}
                alt={`${featured.name} before`}
                fill
                sizes="(max-width: 768px) 50vw, 20vw"
                className="object-cover"
              />
              <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-widest bg-slate-700 text-white px-2.5 py-1 rounded-md shadow-md z-10">
                BEFORE
              </span>
            </div>
            <div className="relative rounded-xl overflow-hidden aspect-[3/4] ring-1 ring-red-500/40">
              <Image
                src={featured.afterImg}
                alt={`${featured.name} after`}
                fill
                sizes="(max-width: 768px) 50vw, 20vw"
                className="object-cover"
              />
              <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-widest bg-green-500 text-white px-2.5 py-1 rounded-md shadow-md z-10">
                AFTER
              </span>
            </div>
          </div>
        </div>

        {/* Text side */}
        <div className="p-8 flex flex-col justify-center space-y-5">
          <div className="w-8 h-[3px] rounded-full bg-gradient-to-r from-red-500 to-transparent" />
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">
            {featured.emoji} {featured.app} · {featured.location}
          </p>
          <p className="text-slate-300 leading-relaxed italic font-light text-[15px]">
            &ldquo;{featured.quote}&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg border border-slate-700 shrink-0"
              style={{ background: featured.avatarBg }}
            >
              {featured.avatarEmoji}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">{featured.name}</div>
              <div className="text-xs text-slate-500">{featured.meta}</div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {featured.metrics.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-lg"
              >
                <span className="text-emerald-400">↑</span>
                <span>{m.val}</span>
                <span className="text-slate-400 font-normal">{m.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Two smaller cards */}
      <div className="grid md:grid-cols-2 gap-5">
        {rest.map((c, i) => (
          <div
            key={i}
            className="border border-slate-800 rounded-2xl bg-slate-900 hover:border-red-500/30 transition-colors overflow-hidden"
          >
            <div className="flex gap-3 p-5 pb-0">
              <div className="relative rounded-lg overflow-hidden flex-1 aspect-[3/4]">
                <Image
                  src={c.beforeImg}
                  alt={`${c.name} before`}
                  fill
                  sizes="(max-width: 768px) 40vw, 15vw"
                  className="object-cover"
                />
                <span className="absolute bottom-1.5 left-1.5 text-[8px] font-bold uppercase tracking-widest bg-slate-700 text-white px-2 py-0.5 rounded shadow-sm z-10">
                  BEFORE
                </span>
              </div>
              <div className="self-center text-slate-600 text-sm shrink-0">→</div>
              <div className="relative rounded-lg overflow-hidden flex-1 aspect-[3/4] ring-1 ring-red-500/30">
                <Image
                  src={c.afterImg}
                  alt={`${c.name} after`}
                  fill
                  sizes="(max-width: 768px) 40vw, 15vw"
                  className="object-cover"
                />
                <span className="absolute bottom-1.5 left-1.5 text-[8px] font-bold uppercase tracking-widest bg-green-500 text-white px-2 py-0.5 rounded shadow-sm z-10">
                  AFTER
                </span>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                {c.emoji} {c.app} · {c.location}
              </p>
              <p className="text-slate-400 text-sm leading-relaxed italic">&ldquo;{c.quote}&rdquo;</p>
              <div className="flex items-center gap-2.5 pt-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm border border-slate-700 shrink-0"
                  style={{ background: c.avatarBg }}
                >
                  {c.avatarEmoji}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">{c.name}</div>
                  <div className="text-[11px] text-slate-500">{c.meta}</div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {c.metrics.map((m, j) => (
                  <span
                    key={j}
                    className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-lg"
                  >
                    ↑ {m.val} <span className="text-slate-400 font-normal">{m.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mini quote row */}
      <div className="grid md:grid-cols-3 gap-4">
        {miniQuotes.map((q, i) => (
          <div
            key={i}
            className="border border-slate-800 rounded-2xl bg-slate-900 p-5 space-y-3 hover:border-red-500/20 transition-colors"
          >
            <span className="block font-serif text-4xl text-red-500 leading-none opacity-50">&ldquo;</span>
            <p className="text-slate-400 text-sm leading-relaxed italic">{q.quote}</p>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm border border-slate-700 shrink-0"
                  style={{ background: q.avatarBg }}
                >
                  {q.avatarEmoji}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">{q.name}</div>
                  <div className="text-[11px] text-slate-500">{q.sub}</div>
                </div>
              </div>
              <span className="text-yellow-400 text-xs tracking-wide">★★★★★</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}