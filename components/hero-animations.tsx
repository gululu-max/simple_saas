"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Flame } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ─── 按钮文案常量 ─── */
const DEFAULT_TEXT = "Get 1 Free Photo Now";
const RETURNING_TEXT = "Instant Glow-Up";

export function HeroButtons() {
  const btnRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [buttonText, setButtonText] = useState(DEFAULT_TEXT);

  useEffect(() => {
    let cancelled = false;

    function run() {
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

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 3000 });
      return () => { cancelled = true; cancelIdleCallback(id); };
    } else {
      const id = setTimeout(run, 1500);
      return () => { cancelled = true; clearTimeout(id); };
    }
  }, []);

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
      <div ref={btnRef as React.RefObject<HTMLDivElement>} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
        <Link
          href="/subscribe/scanner"
          className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-8 h-14 text-lg font-bold text-white shadow-xl shadow-red-600/25 transition-all hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Flame className="w-5 h-5 transition-transform group-hover:rotate-12" />
          {buttonText}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm text-slate-400">
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No sign-up required</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Auto-deleted instantly</div>
      </div>

      {/* sticky 底部按钮 */}
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
        <Link
          href="/subscribe/scanner"
          className="group flex items-center justify-center gap-2 w-full h-14 rounded-full bg-gradient-to-r from-red-600 to-orange-500 text-lg font-bold text-white shadow-xl shadow-red-600/25 transition-all active:scale-[0.98]"
        >
          <Flame className="w-5 h-5" />
          {buttonText}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </>
  );
}