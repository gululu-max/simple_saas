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
    <div className="flex items-center gap-3 bg-slate-800/60 backdrop-blur-sm rounded-full px-4 py-2">
      {/* 头像组 */}
      <div className="flex -space-x-2">
        {AVATARS.map((src, i) => (
          <div
            key={i}
            className="relative w-6 h-6 rounded-full border-2 border-slate-900 overflow-hidden"
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
      <p className="text-xs text-slate-400">
        <span className="text-amber-400 font-semibold tabular-nums">
          {count.toLocaleString()}
        </span>{" "}
        photos enhanced this week
      </p>
    </div>
  );
}