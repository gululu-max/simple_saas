"use client";

import BoostScanner from "@/components/BoostScanner";
import { ShieldCheck, Zap, Users } from "lucide-react";

export default function ScannerPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">

        {/* ── Hero — 降低摩擦，推用户完成上传 ── */}
        <div className="text-center mb-6 md:mb-8" id="scanner-hero">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Same You. Just the Version That Gets Swiped Right.
          </h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base max-w-2xl mx-auto">
            AI-enhanced lighting, framing & color that no one can tell apart from a great photographer.
            2,847 guys upgraded this week — the rest are still wondering why they&apos;re getting left-swiped.
          </p>
        </div>

        {/* ── Core ── */}
        <BoostScanner />

        {/* ── Trust Signals — 真实性 + 社会证明 ── */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-slate-600" />
            100% your real face — no AI generation
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-slate-600" />
            2,847 enhanced this week
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="size-3.5 text-slate-600" />
            Auto-deleted after processing
          </span>
        </div>
      </div>
    </div>
  );
}