"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * 头像命名：/public/hero/avatars/a1.webp, a2.webp, a3.webp
 * 建议尺寸：64x64px，webp，质量 80
 */

const AVATARS = [
  "/hero/avatars/a1.webp",
  "/hero/avatars/a2.webp",
  "/hero/avatars/a3.webp",
];

export function SocialProofBar() {
  const [count, setCount] = useState(2847);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 3) + 1);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center gap-2.5 bg-surface-soft rounded-pill px-3 py-1.5">
      {/* 头像组 */}
      <div className="flex -space-x-2">
        {AVATARS.map((src, i) => (
          <div
            key={i}
            className="relative w-6 h-6 rounded-pill border-2 border-canvas overflow-hidden"
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="24px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      <p className="text-[13px] text-ink-muted leading-[1.23]">
        <span className="font-semibold text-ink tabular-nums">
          {count.toLocaleString()}
        </span>{" "}
        photos enhanced this week
      </p>
    </div>
  );
}
