import { HeroAnimations, HeroButtons } from "@/components/hero-animations";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Flame, Wand2, Ghost, CheckCircle2, ScanSearch, X, Check } from "lucide-react";
import { PricingSection } from "@/components/pricing-section";
import { FeaturesGrid } from "@/components/features-grid";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50 selection:bg-red-500/30">

      {/* 1. Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-600/10 rounded-full blur-[120px] -z-10" />

        <div className="container px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">

            {/* 文字内容直接渲染，不参与动画 */}
            <div className="space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
                <ScanSearch className="w-3 h-3 mr-2" /> Matchfix: The Ultimate AI Profile booster
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter">
                Get More Matches With Better Photos<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
                We analyze and fix your dating photos so you stand out instantly.
                </span>
              </h1>
              <p className="text-xl text-slate-400 max-w-[600px] mx-auto lg:mx-0">
              Upload your photos and see how to get more matches.
              </p>

              <HeroButtons />
            </div>

            <HeroAnimations />
          </div>
        </div>
      </section>

      {/* 2. Before & After 处刑展示�?(已加入图片对�? */}
      <section className="py-20 border-y border-slate-800 bg-slate-950/50">
        <div className="container px-4 md:px-6 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Gets Matches</h2>
            <p className="text-slate-400 text-lg">Don't be the guy on the left.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Before Card */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
              {/* 🎯 Before 图片区域 */}
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

              <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Their Bio (Generic)</div>
              <p className="text-lg italic text-slate-400">"I love food, traveling, and the gym. Fluent in sarcasm. Don't be boring."</p>
              <div className="pt-2 flex flex-col gap-2 text-red-400 text-sm font-medium">
                <div className="flex items-center gap-2"><X className="w-4 h-4" /> Hiding face with sunglasses</div>
                <div className="flex items-center gap-2"><X className="w-4 h-4" /> Cliché bio with zero effort</div>
              </div>
            </div>

            {/* After/boost Card */}
            <div className="p-6 rounded-xl border border-red-500/50 bg-red-950/20 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl" />

              {/* 🎯 After 图片区域 */}
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
                <Flame className="w-4 h-4" /> Matchfix boost & Fix
              </div>
              <p className="text-lg text-slate-200">"Translation: You have no actual hobbies. Remove the sunglasses, show your smile, and swap the sarcasm line for a weird fact about yourself."</p>
              <div className="pt-2 flex flex-col gap-2 text-emerald-400 text-sm font-medium">
                <div className="flex items-center gap-2"><Check className="w-4 h-4" /> Eye contact established</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4" /> Clear, confident posture</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Grid */}
      <section id="features" className="py-20">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Fix Your Awful Profile</h2>
            <p className="text-slate-400 text-lg">Better to get boosted by us than swiped left by everyone else.</p>
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

      {/* 5. 价格锚点对比 */}
      <section className="py-20">
        <div className="container px-4 md:px-6 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">100X Cheaper Than Remaining Single.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 opacity-70">
              <h4 className="font-bold text-slate-300 mb-2">Bad Dates</h4>
              <div className="text-2xl font-bold mb-4">$100+</div>
              <div className="flex items-center gap-2 text-sm text-slate-400"><X className="w-4 h-4 text-red-500" /> Wasted weekends</div>
              <div className="flex items-center gap-2 text-sm text-slate-400 mt-2"><X className="w-4 h-4 text-red-500" /> Zero feedback</div>
            </div>
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 opacity-70">
              <h4 className="font-bold text-slate-300 mb-2">Dating Coach</h4>
              <div className="text-2xl font-bold mb-4">$200/hr</div>
              <div className="flex items-center gap-2 text-sm text-slate-400"><X className="w-4 h-4 text-red-500" /> Expensive</div>
              <div className="flex items-center gap-2 text-sm text-slate-400 mt-2"><X className="w-4 h-4 text-red-500" /> Sugarcoated advice</div>
            </div>
            <div className="p-6 rounded-xl border border-red-500 bg-red-950/20 shadow-[0_0_30px_rgba(220,38,38,0.15)] relative transform md:-translate-y-2">
              <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">SMART CHOICE</div>
              <h4 className="font-bold text-red-400 mb-2">Matchfix AI</h4>
              <div className="text-2xl font-bold text-white mb-4">From $6.99</div>
              <div className="flex items-center gap-2 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500" /> Brutally honest</div>
              <div className="flex items-center gap-2 text-sm text-slate-300 mt-2"><Check className="w-4 h-4 text-emerald-500" /> Instant results</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CTA Section (荷尔蒙暧昧粉红版) */}
      <section className="py-20 bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700 text-white relative overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.2)]">

        {/* 保留了纹理层，但改了混合模式，让背景更有肉感 */}
        <div className="absolute inset-0 bg-[url('/textures/cubes.png')] opacity-20 mix-blend-overlay" />

        <div className="container px-4 md:px-6 text-center relative z-10">
          {/* 之前深色渐变的字在粉色背景下会看不清，这里给你改成了带阴影的纯白，视觉冲击力极强 */}
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-white drop-shadow-lg tracking-tight">
            Ready to face reality?
          </h2>

          <p className="text-pink-50 mb-10 max-w-2xl mx-auto text-lg drop-shadow-md">
            Don't let terrible photos ruin your dating life. Upload a screenshot and let our AI give you the reality check you desperately need.
          </p>

          <Link href="/dashboard/scanner">
            {/* 按钮用深渊黑 (slate-950) 压住阵脚，在亮粉色背景中形成极其强烈的反差，拉满点击�?*/}
            <Button size="lg" className="h-14 px-10 text-lg gap-2 bg-slate-950 text-white hover:bg-slate-900 shadow-2xl border border-pink-400/50 transition-transform hover:scale-105">
            Fix My Profile Now <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 7. PricingSection */}
      <div className="bg-slate-950 pb-20 pt-10">
        <PricingSection />
      </div>
    </div>
  );
}


const stats = [
  { value: "100%", label: "Unfiltered boosts" },
  { value: "3", label: "Key Fixes Per boost" },
  { value: "0", label: "Privacy Risks" },
  { value: "24/7", label: "Relentless boosting" },
];
