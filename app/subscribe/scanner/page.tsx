"use client";

import BoostScanner from "@/components/BoostScanner";
import { ShieldCheck, Zap, Clock } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// app/subscribe/scanner/page.tsx
// 直接覆盖现有文件
// ═══════════════════════════════════════════════════════════════

export default function ScannerPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">

        {/* ── Hero Header — compact, get to upload fast ── */}
        <div className="text-center mb-6 md:mb-8">
          <p className="text-emerald-400 text-sm font-semibold mb-2 tracking-wide">
            2,847 photos enhanced this week
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Your Photos Are Costing You Matches
          </h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base max-w-xl mx-auto">
            Upload your cover photo. See the AI-enhanced version side by side in 30 seconds.
          </p>
        </div>

        {/* ── Core: BoostScanner handles everything ── */}
        <BoostScanner />

        {/* ── Trust Signals ── */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-slate-600" />
            Photos never stored or shared
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="size-3.5 text-slate-600" />
            Auto-deleted after processing
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-slate-600" />
            Results in under 30 seconds
          </span>
        </div>
      </div>
    </div>
  );
}