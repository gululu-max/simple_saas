"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const ROW1 = [
  "/hero/women/w01.webp",
  "/hero/women/w02.webp",
  "/hero/women/w03.webp",
  "/hero/women/w04.webp",
  "/hero/women/w05.webp",
  "/hero/women/w06.webp",
  "/hero/women/w07.webp",
];

const ROW2 = [
  "/hero/women/w08.webp",
  "/hero/women/w09.webp",
  "/hero/women/w10.webp",
  "/hero/women/w11.webp",
  "/hero/women/w12.webp",
  "/hero/women/w13.webp",
  "/hero/women/w14.webp",
  "/hero/women/w15.webp",
];

function useRepeatCount(cardWidth: number, gap: number, baseCount: number) {
  const [repeat, setRepeat] = useState(2);

  useEffect(() => {
    function calc() {
      const screenWidth = window.innerWidth;
      const oneSetWidth = baseCount * (cardWidth + gap);
      const needed = Math.ceil((screenWidth * 2) / oneSetWidth) + 1;
      setRepeat(Math.max(needed, 2));
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [cardWidth, gap, baseCount]);

  return repeat;
}

function PhotoRow({
  images,
  direction,
  speed,
}: {
  images: string[];
  direction: "left" | "right";
  speed: number;
}) {
  const repeat = useRepeatCount(170, 8, images.length);
  const repeated: string[] = [];
  for (let r = 0; r < repeat; r++) {
    repeated.push(...images);
  }

  return (
    <div className="relative overflow-hidden w-full">
      <div
        className={
          direction === "left"
            ? "animate-scroll-left flex gap-2"
            : "animate-scroll-right flex gap-2"
        }
        style={{
          animationDuration: `${speed}s`,
          willChange: "transform",
        }}
      >
        {repeated.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative flex-shrink-0 w-[130px] h-[180px] md:w-[170px] md:h-[220px] rounded-card overflow-hidden bg-surface-soft"
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width: 768px) 130px, 170px"
              className="object-cover"
              loading={i < images.length ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhotoWall() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="flex flex-col gap-2">
        <PhotoRow images={ROW1} direction="left" speed={32} />
        <PhotoRow images={ROW2} direction="right" speed={36} />
      </div>

      {/* 左右白色渐变 mask — 隐藏滚动接缝，强化"画布感" */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-24 bg-gradient-to-r from-canvas to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-24 bg-gradient-to-l from-canvas to-transparent" />
    </div>
  );
}
