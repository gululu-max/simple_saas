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

  // hydrate 前不渲染任何东西 — page.tsx 的静态第一帧已经在显示
  if (!hydrated) return null;

  const next = (current + 1) % slides.length;
  const visibleIndices = new Set([current, next]);

  return (
    <div className="absolute inset-0 z-0">
      {slides.map((slide, i) => {
        if (!visibleIndices.has(i)) return null;

        return (
          <div
            key={i}
            className="absolute inset-0 grid grid-cols-2 transition-opacity duration-1000 ease-in-out"
            style={{ opacity: i === current ? 1 : 0 }}
            aria-hidden={i !== current}
          >
            <div className="relative overflow-hidden">
              {i === 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.before}
                  alt=""
                  fetchPriority="low"
                  loading="eager"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover grayscale opacity-60"
                />
              ) : (
                <Image
                  src={slide.before}
                  alt=""
                  fill
                  sizes="50vw"
                  className="object-cover grayscale opacity-60"
                  loading="lazy"
                />
              )}
              <div className="absolute bottom-4 left-4 z-10">
                <span className="bg-red-600/90 text-white text-xs font-bold px-2 py-1 rounded">Before</span>
              </div>
            </div>
            <div className="relative overflow-hidden">
              {i === 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.after}
                  alt=""
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={slide.after}
                  alt=""
                  fill
                  sizes="50vw"
                  className="object-cover"
                  loading="lazy"
                />
              )}
              <div className="absolute bottom-4 right-4 z-10">
                <span className="bg-emerald-500/90 text-white text-xs font-bold px-2 py-1 rounded">After</span>
              </div>
            </div>
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/20 z-10" />
          </div>
        );
      })}

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