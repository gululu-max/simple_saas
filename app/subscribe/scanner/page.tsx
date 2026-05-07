"use client";

import BoostScanner from "@/components/BoostScanner";
import { ShieldCheck, Zap, Users } from "lucide-react";

export default function ScannerPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">

        {/* ── Hero — 降低摩擦，推用户完成上传 ── */}
        <div className="text-center mb-4 md:mb-6" id="scanner-hero">
          <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-[-0.5px] text-ink leading-[1.18]">
            Same You. Just the Version That Gets Swiped Right.
          </h1>
        </div>

        {/* ── Core ── */}
        <BoostScanner />

        {/* ── Trust Signals — 真实性 + 社会证明 ── */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-[13px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-ink-muted" />
            100% your real face — no AI generation
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-ink-muted" />
            2,847 enhanced this week
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="size-3.5 text-ink-muted" />
            Auto-deleted after processing
          </span>
        </div>
      </div>
    </div>
  );
}
