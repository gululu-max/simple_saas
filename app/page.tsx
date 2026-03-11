"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Flame, Wand2, Ghost, CheckCircle2, ScanSearch, X, Check } from "lucide-react";
import { PricingSection } from "@/components/pricing-section";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50 selection:bg-red-500/30">
      
      {/* 1. Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-600/10 rounded-full blur-[120px] -z-10" />
        
        <div className="container px-4 md:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8 text-center lg:text-left"
            >
              <div className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
                <ScanSearch className="w-3 h-3 mr-2" /> Matchfix: The Ultimate AI Profile Roaster
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter">
                Why are you still single?<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
                  Let AI destroy your dating delusions.
                </span>
              </h1>
              <p className="text-xl text-slate-400 max-w-[600px] mx-auto lg:mx-0">
                Stop blaming the algorithm. Upload your Tinder/Hinge screenshots or those tragic mirror selfies, and get the most ruthless, honest roast. Get a reality check, then get matches.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/dashboard/scanner">
                  <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg gap-2 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                    🔥 Get Roasted <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-slate-400">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> No sign-up required</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Auto-deleted instantly</div>
              </div>
            </motion.div>

            {/* 右侧：动态雷达扫描图 (已加入真实图片位置) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative mx-auto w-full max-w-[400px] aspect-[3/4] rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl"
            >
              {/* 🎯 替换这里的 src，放一张油腻的网图作为靶子 */}
              <img 
                src="/hero-demo.jpg" 
                alt="Target Profile" 
                className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity hover:mix-blend-normal transition-all duration-500"
                onError={(e) => {
                  // 如果图片还没放进去，给个默认灰色背景防报错
                  e.currentTarget.style.display = 'none';
                }}
              />
              
              {/* 底部渐变遮罩，确保如果没有图片时背景不难看 */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />

              {/* 雷达扫描线动效 */}
              <motion.div
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] z-10"
              />

              {/* 动态弹出的警告标签 */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }}
                className="absolute top-12 right-4 bg-slate-950/90 border border-red-500 text-red-400 text-xs px-3 py-1.5 rounded flex items-center gap-2 backdrop-blur-sm"
              >
                🚩 <span>Cringe gym selfie</span>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 }}
                className="absolute top-1/2 left-4 bg-slate-950/90 border border-orange-500 text-orange-400 text-xs px-3 py-1.5 rounded flex items-center gap-2 backdrop-blur-sm"
              >
                🚩 <span>Zero personality bio</span>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 }}
                className="absolute bottom-6 right-4 bg-red-600 text-white font-bold text-xs px-3 py-1.5 rounded shadow-[0_0_10px_rgba(220,38,38,0.5)]"
              >
                📉 Swipe Left: 99.9%
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Before & After 处刑展示区 (已加入图片对比) */}
      <section className="py-20 border-y border-slate-800 bg-slate-950/50">
        <div className="container px-4 md:px-6 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">See The Difference</h2>
            <p className="text-slate-400 text-lg">Don't be the guy on the left.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Before Card */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
              {/* 🎯 Before 图片区域 */}
              <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-slate-800 relative">
                <img 
                  src="/before-demo.jpg" 
                  alt="Bad Profile" 
                  className="w-full h-full object-cover opacity-60 grayscale"
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

            {/* After/Roast Card */}
            <div className="p-6 rounded-xl border border-red-500/50 bg-red-950/20 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl" />
              
              {/* 🎯 After 图片区域 */}
              <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-slate-800 relative border border-red-500/30">
                <img 
                  src="/after-demo.jpg" 
                  alt="Good Profile" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">Score: 89/100</div>
              </div>

              <div className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Flame className="w-4 h-4" /> Matchfix Roast & Fix
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
            <p className="text-slate-400 text-lg">Better to get roasted by us than swiped left by everyone else.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Link href={feature.link} key={index} className="block group">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-slate-900 p-8 rounded-xl border border-slate-800 hover:border-red-500/50 transition-all h-full cursor-pointer shadow-lg relative overflow-hidden"
                >
                  <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center mb-6 text-red-500 group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-red-400 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                  
                  {/* 引导箭头 */}
                  <div className="mt-6 flex items-center text-sm font-medium text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Try it now <ArrowRight className="ml-2 w-4 h-4" />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
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
                 <div className="flex items-center gap-2 text-sm text-slate-400"><X className="w-4 h-4 text-red-500"/> Wasted weekends</div>
                 <div className="flex items-center gap-2 text-sm text-slate-400 mt-2"><X className="w-4 h-4 text-red-500"/> Zero feedback</div>
              </div>
              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 opacity-70">
                 <h4 className="font-bold text-slate-300 mb-2">Dating Coach</h4>
                 <div className="text-2xl font-bold mb-4">$200/hr</div>
                 <div className="flex items-center gap-2 text-sm text-slate-400"><X className="w-4 h-4 text-red-500"/> Expensive</div>
                 <div className="flex items-center gap-2 text-sm text-slate-400 mt-2"><X className="w-4 h-4 text-red-500"/> Sugarcoated advice</div>
              </div>
              <div className="p-6 rounded-xl border border-red-500 bg-red-950/20 shadow-[0_0_30px_rgba(220,38,38,0.15)] relative transform md:-translate-y-2">
                 <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">SMART CHOICE</div>
                 <h4 className="font-bold text-red-400 mb-2">Matchfix AI</h4>
                 <div className="text-2xl font-bold text-white mb-4">From $9.90</div>
                 <div className="flex items-center gap-2 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500"/> Brutally honest</div>
                 <div className="flex items-center gap-2 text-sm text-slate-300 mt-2"><Check className="w-4 h-4 text-emerald-500"/> Instant results</div>
              </div>
           </div>
        </div>
      </section>

      {/* 6. CTA Section (荷尔蒙暧昧粉红版) */}
      <section className="py-20 bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700 text-white relative overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.2)]">
        
        {/* 保留了纹理层，但改了混合模式，让背景更有肉感 */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay" />
        
        <div className="container px-4 md:px-6 text-center relative z-10">
            {/* 之前深色渐变的字在粉色背景下会看不清，这里给你改成了带阴影的纯白，视觉冲击力极强 */}
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6 text-white drop-shadow-lg tracking-tight">
              Ready to face reality?
            </h2>
            
            <p className="text-pink-50 mb-10 max-w-2xl mx-auto text-lg drop-shadow-md">
                Don't let terrible photos ruin your dating life. Upload a screenshot and let our AI give you the reality check you desperately need.
            </p>
            
            <Link href="/dashboard/scanner">
                {/* 按钮用深渊黑 (slate-950) 压住阵脚，在亮粉色背景中形成极其强烈的反差，拉满点击欲 */}
                <Button size="lg" className="h-14 px-10 text-lg gap-2 bg-slate-950 text-white hover:bg-slate-900 shadow-2xl border border-pink-400/50 transition-transform hover:scale-105">
                  Upload Profile <ArrowRight className="w-5 h-5" />
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

const features = [
  {
    title: "The Matchfix Scanner",
    description: "Your gym selfies are cringe. Our AI will use ruthless but accurate feedback to point out exactly why you're scaring away matches.",
    icon: <Flame className="w-6 h-6" />,
    link: "/dashboard/scanner" // 对应第一个路由
  },
  {
    title: "AI Photo Scorer",
    description: "Stop guessing which photo works. Our AI analyzes facial expressions, lighting, and social cues to pick your top 3 winners. Get a data-backed ranking and expert reasoning on why some photos attract while others repel.",
    icon: <Wand2 className="w-6 h-6" />,
    link: "/dashboard/photo-scorer" // 对应第二个路由
  },
  {
    title: "Burn After Reading",
    description: "Your embarrassing photos are safe. We don't save your tragic screenshots—they are permanently deleted from our servers the second your roast is done.",
    icon: <Ghost className="w-6 h-6" />,
    link: "/dashboard" // 第三个通常也导向主功能
  },
];

const stats = [
  { value: "100%", label: "Unfiltered Roasts" },
  { value: "3", label: "Key Fixes Per Roast" },
  { value: "0", label: "Privacy Risks" },
  { value: "24/7", label: "Relentless Roasting" },
];