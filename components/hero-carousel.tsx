"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

// Each slide is a before/after pair shown side by side as the background
const slides = [
  { before: "/hero/before-1.jpg", after: "/hero/after-1.jpg" },
  { before: "/hero/before-2.jpg", after: "/hero/after-2.jpg" },
  { before: "/hero/before-3.jpg", after: "/hero/after-3.jpg" },
];

const INTERVAL = 4000; // 4s per slide

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      {slides.map((slide, i) => (
        <div
          key={i}
          className="absolute inset-0 grid grid-cols-2 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          {/* Before half */}
          <div className="relative overflow-hidden">
            <Image
              src={slide.before}
              alt=""
              fill
              sizes="50vw"
              className="object-cover grayscale opacity-60"
              priority={i === 0}
            />
            {/* Before label */}
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
              <span className="bg-red-600/90 text-white text-xs font-bold px-2 py-1 rounded">
                Before
              </span>
            </div>
          </div>

          {/* After half */}
          <div className="relative overflow-hidden">
            <Image
              src={slide.after}
              alt=""
              fill
              sizes="50vw"
              className="object-cover"
              priority={i === 0}
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
            onClick={() => setCurrent(i)}
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