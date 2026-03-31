import { HeroButtons } from "@/components/hero-animations";
import { Flame, ScanSearch, X, Check } from "lucide-react";
import Image from "next/image";
import { FeaturesGrid } from "@/components/features-grid";
import { ScrollToTop } from "@/components/scroll-to-top";
import { HeroCarousel } from "@/components/hero-carousel";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50 selection:bg-red-500/30 pb-24 md:pb-0">

      {/* 1. Hero Section */}
      <section className="relative min-h-[85vh] md:min-h-[90vh] flex flex-col justify-center overflow-hidden">

        {/* 第一帧静态背景 — 服务端 HTML 直出，不等任何 JS */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 grid grid-cols-2">
            <div className="relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero/before-1.webp"
                alt=""
                fetchPriority="low"
                loading="eager"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover grayscale opacity-80"
                style={{ objectPosition: "center" }}
              />
              <div className="absolute bottom-4 left-4 z-10">
                <span className="bg-red-600/90 text-white text-xs font-bold px-2 py-1 rounded">Before</span>
              </div>
            </div>
            <div className="relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero/after-1.webp"
                alt=""
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: "center" }}
              />
              <div className="absolute bottom-4 right-4 z-10">
                <span className="bg-emerald-500/90 text-white text-xs font-bold px-2 py-1 rounded">After</span>
              </div>
            </div>
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/20 z-10" />
          </div>
        </div>

        {/* 客户端 carousel — hydrate 后覆盖上去接管轮播 */}
        <HeroCarousel />

        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/20 to-slate-950/90 z-[1]" />

        <div className="absolute inset-0 z-10 flex flex-col items-center text-center px-4 md:px-6">
          <div className="mt-[28vh] md:mt-[18vh] flex flex-col items-center gap-4">
            <div className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 backdrop-blur-sm px-3 py-1 text-xs font-medium text-red-400">
              <ScanSearch className="w-3 h-3 mr-2" /> Matchfix AI Profile Booster
            </div>
            <p className="text-lg md:text-2xl text-slate-300 font-medium max-w-lg">
              AI fixes your dating photos in seconds.
            </p>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter max-w-3xl leading-[1.1]">
              Your Photos Are
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
                Costing You Matches
              </span>
            </h1>
            <p className="text-base md:text-lg text-slate-400 max-w-md">
              Users go from 2 matches to 30+ after one boost.
            </p>
          </div>
          <div className="mt-8 md:mt-10 flex flex-col items-center gap-5">
            <HeroButtons />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-950 to-transparent z-[1]" />
      </section>

      {/* 2. Before & After */}
      <section className="py-20 border-y border-slate-800 bg-slate-950/50">
        <div className="container px-4 md:px-6 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-slate-400 text-lg">Upload Your Photos → See What&#39;s Killing Your Matches → Fix It Instantly</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
              <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-slate-800 relative">
                <Image
                  src="/before-demo.jpg"
                  alt="Bad Profile"
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover opacity-60 grayscale"
                />
                <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">Score: 31/100</div>
              </div>
              <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Low Match Potential</div>
              <p className="text-lg italic text-slate-400">&quot;I love food, traveling, and the gym.&quot;</p>
              <div className="pt-2 flex flex-col gap-2 text-red-400 text-sm font-medium">
                <div className="flex items-center gap-2"><X className="w-4 h-4" /> Face not clearly visible</div>
                <div className="flex items-center gap-2"><X className="w-4 h-4" /> Weak first impression</div>
                <div className="flex items-center gap-2"><X className="w-4 h-4" /> Generic bio (no personality)</div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-red-500/50 bg-red-950/20 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl" />
              <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-slate-800 relative border border-red-500/30">
                <Image
                  src="/after-demo.jpg"
                  alt="Good Profile"
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">Score: 89/100</div>
              </div>
              <div className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Flame className="w-4 h-4" /> Optimized for Matches
              </div>
              <p className="text-lg text-slate-200">&quot;We help you stand out instantly with small but powerful changes.&quot;</p>
              <div className="pt-2 flex flex-col gap-2 text-emerald-400 text-sm font-medium">
                <div className="flex items-center gap-2"><Check className="w-4 h-4" /> Clear eye contact</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4" /> Confident, approachable vibe</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4" /> Bio that sparks curiosity</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. User Cases */}
      <section id="features" className="py-20">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 mb-4">
              Real User Stories
            </div>
            <h2 className="text-3xl font-bold mb-4">
              They changed their dating luck{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
                with better photos
              </span>
            </h2>
            <p className="text-slate-400 text-lg">
              Not filters. Not editing. The kind of change that makes you genuinely look your best.
            </p>
          </div>
          <FeaturesGrid />
        </div>
      </section>

      {/* 4. Social Proof / Stats */}
      <section className="py-16 border-y border-slate-800 bg-slate-900/50">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="space-y-2">
                <div className="text-4xl font-bold text-slate-100">{stat.value}</div>
                <div className="text-sm text-red-500 font-semibold uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CTA Section */}
      <section className="pt-12 pb-12 bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700 text-white relative overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.2)]">
        <div className="absolute inset-0 bg-[url('/textures/cubes.png')] opacity-20 mix-blend-overlay" />
        <div className="container px-4 md:px-6 text-center relative z-10 pb-[env(safe-area-inset-bottom)]">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 text-white drop-shadow-lg tracking-tight">
            Ready for dating?
          </h2>
          <p className="text-pink-50 max-w-2xl mx-auto text-lg drop-shadow-md">
            With the right photos, your matches go up — fast.<br />
            More people interested, more choices, and more nights that don&apos;t end early.
          </p>
        </div>
      </section>

      <ScrollToTop />
    </div>
  );
}

const stats = [
  { value: "100%", label: "Unfiltered boosts" },
  { value: "5+", label: "Key Fixes Per boost" },
  { value: "0", label: "Privacy Risks" },
  { value: "24/7", label: "Relentless boosting" },
];