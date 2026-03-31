"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ─── 按钮文案常量 ─── */
const DEFAULT_TEXT = "Get 1 Free Photo Now";
const RETURNING_TEXT = "Instant Glow-Up";

export function HeroButtons() {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [buttonText, setButtonText] = useState(DEFAULT_TEXT);

  // 延迟到浏览器空闲时才查用户状态，不影响 FCP/LCP
  useEffect(() => {
    let cancelled = false;

    function run() {
      // 动态 import supabase client — 不在首屏 bundle 里
      import("@/utils/supabase/client").then(async ({ createClient }) => {
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
      });
    }

    // requestIdleCallback — 等首屏渲染完再执行
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 3000 });
      return () => { cancelled = true; cancelIdleCallback(id); };
    } else {
      const id = setTimeout(run, 1500);
      return () => { cancelled = true; clearTimeout(id); };
    }
  }, []);

  // sticky 按钮
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
      <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
        <Link href="/subscribe/scanner" ref={btnRef}>
          <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg gap-2 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            🔥 {buttonText} <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm text-slate-400">
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No sign-up required</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Auto-deleted instantly</div>
      </div>

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