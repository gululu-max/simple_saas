import dynamic from "next/dynamic";
import { PhotoWallLazy } from "@/components/photo-wall-lazy";
import { HeroButtons } from "@/components/hero-animations";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SocialProofBar } from "@/components/social-proof-bar";
import { Shield, Trash2, Zap } from "lucide-react";

// ✅ 折叠屏下方组件延迟加载，减少首屏 JS bundle
const PhotoDiagnosis = dynamic(() =>
  import("@/components/photo-diagnosis").then((m) => ({
    default: m.PhotoDiagnosis,
  }))
);

const FeaturesGrid = dynamic(() =>
  import("@/components/features-grid").then((m) => ({
    default: m.FeaturesGrid,
  }))
);

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50 selection:bg-red-500/30 pb-24 md:pb-0">
      {/* 1. Hero Section */}
      <section className="relative min-h-[85vh] md:min-h-[90vh] flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-slate-950" />
        <PhotoWallLazy />
        <div className="absolute inset-0 bg-slate-950/50 z-[1]" />

        {/* ✅ h1 是服务端 HTML，直接 paint，不等 PhotoWall */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-end text-center px-4 md:px-6 pb-[2vh] md:pb-[4vh]">
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter max-w-3xl leading-[1.1]">
              Your Photos Are
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
                Costing You Matches
              </span>
            </h1>
            <p className="text-lg md:text-2xl text-white font-medium max-w-lg">
              Get 30+ matches in seconds with one AI fix.
            </p>
          </div>
          <div className="mt-6 flex flex-col items-center gap-4">
            <HeroButtons />
            <SocialProofBar />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-950 to-transparent z-[1]" />
      </section>

      {/* 2. Pain Point Diagnosis */}
      <PhotoDiagnosis />

      {/* 3. Before & After Results */}
      <section id="features" className="pt-6 pb-10">
        <div className="container px-4 md:px-6 max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Small fixes.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
                Real results.
              </span>
            </h2>
          </div>
          <FeaturesGrid />
        </div>
      </section>

      {/* 4. Trust + Final CTA */}
      <section className="pt-10 pb-8 border-t border-slate-800">
        <div className="container px-4 md:px-6 max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-3 mb-10">
            <div className="text-center space-y-2 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <Zap className="w-5 h-5 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-100">No sign-up</h3>
            </div>
            <div className="text-center space-y-2 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <Trash2 className="w-5 h-5 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-100">Auto-deleted</h3>
            </div>
            <div className="text-center space-y-2 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <Shield className="w-5 h-5 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-100">First one free</h3>
            </div>
          </div>

          <div className="text-center space-y-4 py-10 px-6 rounded-2xl bg-gradient-to-br from-red-950/60 via-slate-900 to-orange-950/40 border border-red-500/20">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Every day you wait,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
                you&apos;re swiped left on.
              </span>
            </h2>
            <p className="text-slate-300 text-lg max-w-md mx-auto">
              The matches you&apos;re missing right now won&apos;t come back. One
              upload. 30 seconds. See what&apos;s been holding you back.
            </p>
          </div>
        </div>
      </section>

      <ScrollToTop />
    </div>
  );
}