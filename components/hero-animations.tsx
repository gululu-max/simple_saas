"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

/* ─── 按钮文案常量 ─── */
const DEFAULT_TEXT = "Get 1 Free Photo Now";
const RETURNING_TEXT = "Instant Glow-Up";

export function HeroButtons() {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [buttonText, setButtonText] = useState(DEFAULT_TEXT);

  // 后台查用户状态，不阻塞渲染
  useEffect(() => {
    let cancelled = false;
    async function checkText() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: customer } = await supabase
          .from("customers")
          .select("free_enhance_used")
          .eq("user_id", user.id)
          .single();

        if (!cancelled && customer?.free_enhance_used) {
          setButtonText(RETURNING_TEXT);
        }
      } catch {
        // 失败保持默认文案
      }
    }
    checkText();
    return () => { cancelled = true; };
  }, []);

  // sticky 按钮的 IntersectionObserver
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
      {/* 主 CTA — 纯 HTML，SSR 阶段就可见 */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
        <Link href="/subscribe/scanner" ref={btnRef}>
          <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg gap-2 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            🔥 {buttonText} <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* 信任标签 */}
      <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm text-slate-400">
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No sign-up required</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Auto-deleted instantly</div>
      </div>

      {/*
        底部悬浮 CTA：纯 CSS transition 替代 framer-motion AnimatePresence
        - 省掉 framer-motion 在首屏 bundle 里的 40-50KB
        - transition 效果视觉上完全一样
      */}
      <div
        className={`
          md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pt-4
          bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent
          transition-all duration-300 ease-out
          ${showSticky
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-full opacity-0 pointer-events-none"
          }
        `}
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <Link href="/subscribe/scanner">
          <Button
            size="lg"
            className="w-full h-14 text-lg gap-2 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] rounded-xl border-0"
          >
            🔥 {buttonText} <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </>
  );
}