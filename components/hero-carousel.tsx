"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const slides = [
  { before: "/hero/before-1.webp", after: "/hero/after-1.webp" },
  { before: "/hero/before-2.webp", after: "/hero/after-2.webp" },
  { before: "/hero/before-3.webp", after: "/hero/after-3.webp" },
];

const INTERVAL = 4000;

export function HeroCarousel() {
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

  // 只渲染当前帧 + 下一帧（用于预加载过渡），其余不挂载
  const next = (current + 1) % slides.length;
  const visibleIndices = new Set([current, next]);

  return (
    <div className="absolute inset-0 z-0">
      {/* 第一帧：始终用原生 <img> SSR 渲染，保证 FCP */}
      {current === 0 || next === 0 ? (
        <div
          className="absolute inset-0 grid grid-cols-2 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: current === 0 ? 1 : 0 }}
          aria-hidden={current !== 0}
        >
          <div className="relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slides[0].before}
              alt=""
              fetchPriority="low"
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover grayscale opacity-60"
            />
            <div className="absolute bottom-4 left-4 z-10">
              <span className="bg-red-600/90 text-white text-xs font-bold px-2 py-1 rounded">Before</span>
            </div>
          </div>
          <div className="relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slides[0].after}
              alt=""
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute bottom-4 right-4 z-10">
              <span className="bg-emerald-500/90 text-white text-xs font-bold px-2 py-1 rounded">After</span>
            </div>
          </div>
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/20 z-10" />
        </div>
      ) : null}

      {/* 其余帧：hydrate 后才渲染，且只渲染当前+下一帧 */}
      {hydrated &&
        slides.map((slide, i) => {
          if (i === 0) return null; // 第一帧已经单独处理
          if (!visibleIndices.has(i)) return null; // 不可见的不挂载

          return (
            <div
              key={i}
              className="absolute inset-0 grid grid-cols-2 transition-opacity duration-1000 ease-in-out"
              style={{ opacity: i === current ? 1 : 0 }}
              aria-hidden={i !== current}
            >
              <div className="relative overflow-hidden">
                <Image
                  src={slide.before}
                  alt=""
                  fill
                  sizes="50vw"
                  className="object-cover grayscale opacity-60"
                  loading="lazy"
                />
                <div className="absolute bottom-4 left-4 z-10">
                  <span className="bg-red-600/90 text-white text-xs font-bold px-2 py-1 rounded">Before</span>
                </div>
              </div>
              <div className="relative overflow-hidden">
                <Image
                  src={slide.after}
                  alt=""
                  fill
                  sizes="50vw"
                  className="object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-4 right-4 z-10">
                  <span className="bg-emerald-500/90 text-white text-xs font-bold px-2 py-1 rounded">After</span>
                </div>
              </div>
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/20 z-10" />
            </div>
          );
        })}

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === current ? "bg-white w-6" : "bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}