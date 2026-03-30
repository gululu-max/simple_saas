"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

// Each slide is a before/after pair shown side by side as the background
const slides = [
  { before: "/hero/before-1.webp", after: "/hero/after-1.webp" },
  { before: "/hero/before-2.webp", after: "/hero/after-2.webp" },
  { before: "/hero/before-3.webp", after: "/hero/after-3.webp" },
];

const INTERVAL = 4000; // 4s per slide

export function HeroCarousel() {
  // 初始值 0 — 和 SSR 输出一致，避免 hydration mismatch
  const [current, setCurrent] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [hydrated]);

  const goTo = useCallback((i: number) => setCurrent(i), []);

  return (
    <div className="absolute inset-0 z-0">
      {slides.map((slide, i) => (
        <div
          key={i}
          className="absolute inset-0 grid grid-cols-2 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === current ? 1 : 0 }}
          // 非当前 slide 设为 hidden，减少不可见图片的渲染开销
          aria-hidden={i !== current}
        >
          {/* Before half */}
          <div className="relative overflow-hidden">
            <Image
              src={slide.before}
              alt=""
              fill
              sizes="50vw"
              className="object-cover grayscale opacity-60"
              // 第一张 slide 的图片：priority + eager loading
              // 其余 slide 的图片：lazy loading
              priority={i === 0}
              loading={i === 0 ? "eager" : "lazy"}
            />
            {/* Before label */}
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
              <span className="bg-red-600/90 text-white text-xs font-bold px-2 py-1 rounded">
                Before
              </span>
            </div>
          </div>

          {/* After half — 第一张 after 图就是 LCP 元素 */}
          <div className="relative overflow-hidden">
            <Image
              src={slide.after}
              alt=""
              fill
              sizes="50vw"
              className="object-cover"
              priority={i === 0}
              loading={i === 0 ? "eager" : "lazy"}
              // 关键：LCP 图片需要 fetchPriority high
              // Next.js 的 priority prop 会自动加 fetchPriority="high"
              // 但为了保险，显式声明
              {...(i === 0 ? { fetchPriority: "high" as const } : {})}
            />
            {/* After label */}
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
              <span className="bg-emerald-500/90 text-white text-xs font-bold px-2 py-1 rounded">
                After
              </span>
            </div>
          </div>

          {/* Center divider line */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/20 z-10" />
        </div>
      ))}

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === current
                ? "bg-white w-6"
                : "bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}