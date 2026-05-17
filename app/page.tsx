import { Suspense } from "react";
import dynamic from "next/dynamic";
import { PhotoWallLazy } from "@/components/photo-wall-lazy";
import { HeroButtons } from "@/components/hero-animations";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SocialProofBar } from "@/components/social-proof-bar";
import { Shield, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PhotoDiagnosis } from "@/components/photo-diagnosis";

const FeaturesGrid = dynamic(() =>
  import("@/components/features-grid").then((m) => ({
    default: m.FeaturesGrid,
  }))
);

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // [no-login pivot 2026-05-18] 一次性买卖统一用 "Instant Glow-Up"，
  // free_enhance_used 不再用（登录态恢复时这段逻辑可解开复用）。
  const buttonText = "Instant Glow-Up";
  // if (user) {
  //   const { data: customer } = await supabase
  //     .from("customers")
  //     .select("free_enhance_used")
  //     .eq("user_id", user.id)
  //     .single();
  //   if (customer?.free_enhance_used) {
  //     buttonText = "Instant Glow-Up";
  //   }
  // }
  void user;

  return (
    <main className="flex flex-col min-h-screen bg-canvas text-ink font-cereal selection:bg-rausch/15 pb-24 md:pb-0">
      {/* 1. Hero — Airbnb 白底 · 克制标题 · 单色 Rausch CTA */}
      <section className="bg-canvas pt-12 lg:pt-section pb-8 lg:pb-12">
        <div className="container max-w-[760px] mx-auto px-6 text-center">
          <h1 className="text-[28px] lg:text-[32px] font-bold leading-[1.18] tracking-[-0.5px] text-ink">
            Your photos are costing you matches
          </h1>
          <p className="mt-4 text-base lg:text-[17px] text-ink-body leading-[1.5] max-w-[520px] mx-auto">
            One AI fix on the photos you already have — better lighting, framing
            and color. Same face, more matches.
          </p>

          <div className="mt-8 flex flex-col items-center gap-5">
            <HeroButtons initialText={buttonText} />
            <SocialProofBar />
          </div>
        </div>
      </section>

      {/* 1b. Photo wall band — 白底滚动展示 · Airbnb editorial photo strip 风格 */}
      <section className="bg-canvas pb-12 lg:pb-section">
        <PhotoWallLazy />
      </section>

      {/* 2. Diagnosis — Airbnb 标题 + 卡片化标注图 */}
      <PhotoDiagnosis />

      {/* 3. Before & After Results — Airbnb 白底 case 卡片 */}
      <section id="features" className="bg-canvas pt-12 lg:pt-section pb-12 lg:pb-section border-t border-hairline-soft">
        <div className="container px-6 max-w-[640px] mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-[22px] lg:text-[28px] font-bold tracking-[-0.4px] text-ink leading-[1.18] mb-3">
              Small fixes, real results.
            </h2>
            <p className="text-ink-muted text-base leading-[1.5]">
              Three guys. Same face. Different outcomes.
            </p>
          </div>
          <FeaturesGrid />
        </div>
      </section>

      {/* 4. Trust + Final CTA — Airbnb 白底 amenity row + 单色 Rausch CTA */}
      <section className="bg-canvas pt-12 lg:pt-section pb-12 lg:pb-section border-t border-hairline-soft">
        <div className="container px-6 max-w-[640px] mx-auto">
          {/* Trust row — 三个 ink 单色 amenity 卡片 */}
          <div className="grid grid-cols-3 gap-3 mb-12">
            <div className="text-center space-y-2 p-4 rounded-card border border-hairline bg-canvas">
              <Zap className="w-5 h-5 text-ink mx-auto" />
              <h3 className="text-[13px] font-semibold text-ink leading-[1.25]">No sign-up</h3>
            </div>
            <div className="text-center space-y-2 p-4 rounded-card border border-hairline bg-canvas">
              <Trash2 className="w-5 h-5 text-ink mx-auto" />
              <h3 className="text-[13px] font-semibold text-ink leading-[1.25]">Auto-deleted</h3>
            </div>
            <div className="text-center space-y-2 p-4 rounded-card border border-hairline bg-canvas">
              <Shield className="w-5 h-5 text-ink mx-auto" />
              <h3 className="text-[13px] font-semibold text-ink leading-[1.25]">First one free</h3>
            </div>
          </div>

          {/* Final CTA — 白底 ink 标题 + Rausch 实色按钮 */}
          <div className="text-center space-y-5 py-10">
            <h2 className="text-[22px] lg:text-[28px] font-bold tracking-[-0.4px] text-ink leading-[1.18]">
              Every day you wait,
              <br />
              you&apos;re swiped left on.
            </h2>
            <p className="text-ink-body text-base leading-[1.5] max-w-[440px] mx-auto">
              The matches you&apos;re missing right now won&apos;t come back. One
              upload. 30 seconds.
            </p>
            <div className="pt-2 flex justify-center">
              <Link
                href="/subscribe/scanner"
                className="inline-flex items-center justify-center gap-2 rounded-sm bg-rausch px-6 h-12 text-base font-medium text-white transition-colors hover:bg-rausch-active"
              >
                Instant Glow-Up
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ScrollToTop />
    </main>
  );
}
