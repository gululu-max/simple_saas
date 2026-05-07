"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function HeroButtons({ initialText = "Get 1 Free Photo" }: { initialText?: string }) {
  const btnRef = useRef<HTMLDivElement>(null);
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
      <div ref={btnRef as React.RefObject<HTMLDivElement>} className="flex flex-col items-center gap-3">
        <Link
          href="/subscribe/scanner"
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-rausch px-6 h-12 text-base font-medium text-white transition-colors hover:bg-rausch-active active:bg-rausch-active"
        >
          {initialText}
          <ArrowRight className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span>No sign-up required</span>
          <span aria-hidden className="text-hairline">·</span>
          <span>Auto-deleted instantly</span>
        </div>
      </div>

      {/* sticky 底部按钮 — 白底 hairline 边 */}
      <div
        className={`
          md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pt-3
          bg-canvas border-t border-hairline-soft
          transition-all duration-300 ease-out
          ${showSticky
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-full opacity-0 pointer-events-none"
          }
        `}
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <Link
          href="/subscribe/scanner"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-sm bg-rausch text-base font-medium text-white transition-colors active:bg-rausch-active"
        >
          {initialText}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </>
  );
}
