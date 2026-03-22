"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function HeroAnimations() {
  return (
    <div className="relative mx-auto w-full max-w-[400px] aspect-[3/4] rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl">
      <Image
        src="/hero-demo.jpg"
        alt="Target Profile"
        fill
        priority
        sizes="400px"
        className="object-cover opacity-60 mix-blend-luminosity hover:mix-blend-normal transition-all duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="absolute inset-0"
      >
        <motion.div
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-1 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] z-10"
        />
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
          className="absolute bottom-6 right-4 bg-slate-950/90 border border-red-500 text-red-400 text-xs px-3 py-1.5 rounded flex items-center gap-2 backdrop-blur-sm"
        >
          📉 <span>Swipe Left: 99.9%</span>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function HeroButtons() {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
      >
        <Link href="/dashboard/scanner" ref={btnRef}>
          <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg gap-2 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            🔥 get matches <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-slate-400"
      >
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No sign-up required</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Auto-deleted instantly</div>
      </motion.div>

      {/* 底部悬浮 CTA：仅移动端显示，桌面端不需要 */}
      <AnimatePresence>
        {showSticky && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-4 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent"
          >
            <Link href="/dashboard/scanner">
              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] rounded-xl border-0"
              >
                🔥 get matches <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}