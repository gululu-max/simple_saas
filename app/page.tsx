"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Flame, Wand2, Ghost, CheckCircle2 } from "lucide-react";
import { PricingSection } from "@/components/pricing-section";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section (首屏扎心区) */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background -z-10" />
        
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                Matchfix AI 毒舌鉴渣师上线
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                为什么你还单身？<br className="hidden sm:inline" />
                让 AI 撕开你的脱单假象。
              </h1>
              <p className="text-xl text-muted-foreground max-w-[600px] mx-auto">
                别再怪算法了。上传你的 Tinder / Hinge 截图或对镜自拍，听听最无情、最真实的吐槽。被骂醒之后，你才知道怎么脱单。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 w-full justify-center"
            >
              <Link href="/dashboard/scanner">
                <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-lg gap-2">
                  🔥 开始受虐 <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-lg">
                  👀 查看公开处刑
                </Button>
              </Link>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="pt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground"
            >
                <div className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500"/> 无需注册直接开喷</div>
                <div className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500"/> 分析完毕立即销毁</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid (核心卖点) */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">拯救你的糟糕审美</h2>
            <p className="text-muted-foreground text-lg">与其被左滑，不如先被我们骂一顿。</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-background p-8 rounded-xl border hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6 text-primary">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Stats (趣味数据) */}
      <section className="py-20 border-y">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="space-y-2">
                <div className="text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
       {/* CTA Section (底部召唤) */}
       <section className="py-20 bg-primary text-primary-foreground">
        <div className="container px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">准备好面对真实的自己了吗？</h2>
            <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto text-lg">
                别让糟糕的照片毁了你的桃花运。上传照片，让 AI 给你一场灵魂暴击。
            </p>
            <Link href="/dashboard/scanner">
                <Button size="lg" variant="secondary" className="h-12 px-8 text-lg gap-2">
                  马上上传照片 <ArrowRight className="w-4 h-4" />
                </Button>
            </Link>
        </div>
      </section>
      
      {/* 这里的 PricingSection 引用了另一个文件 */}
      <PricingSection />    
    </div>
  );
}

const features = [
  {
    title: "绝对毒舌，拒绝讨好",
    description: "你的对镜自拍真的很土。AI 会用最刻薄但也最真实的语言，指出你照片里赶走桃花的雷区。",
    icon: <Flame className="w-6 h-6" />,
  },
  {
    title: "听劝改造，一针见血",
    description: "光骂不练假把式。每次毒舌之后，附赠 3 条含金量极高的改造建议，照着做，配对率翻倍。",
    icon: <Wand2 className="w-6 h-6" />,
  },
  {
    title: "阅后即焚，保护社死",
    description: "你的黑历史极其安全。我们不会保存你那些不忍直视的照片，分析完立马在云端物理超度。",
    icon: <Ghost className="w-6 h-6" />,
  },
];

const stats = [
  { value: "100%", label: "无滤镜真实吐槽" },
  { value: "3条", label: "核心改造建议" },
  { value: "0", label: "数据泄露风险" },
  { value: "24h", label: "全天候在线开喷" },
];