"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const ROW1 = [
  "/hero/women/w01.webp",
  "/hero/women/w02.webp",
  "/hero/women/w03.webp",
  "/hero/women/w04.webp",
  "/hero/women/w05.webp",
];

const ROW2 = [
  "/hero/women/w06.webp",
  "/hero/women/w07.webp",
  "/hero/women/w08.webp",
  "/hero/women/w09.webp",
  "/hero/women/w10.webp",
];

const ROW3 = [
  "/hero/women/w11.webp",
  "/hero/women/w12.webp",
  "/hero/women/w13.webp",
  "/hero/women/w14.webp",
  "/hero/women/w15.webp",
];

// 根据屏幕宽度计算需要重复几次才能铺满
function useRepeatCount(cardWidth: number, gap: number, baseCount: number) {
  // ✅ 初始值从 3 降到 2，减少首次渲染的 DOM 节点数
  const [repeat, setRepeat] = useState(2);

  useEffect(() => {
    function calc() {
      const screenWidth = window.innerWidth;
      const oneSetWidth = baseCount * (cardWidth + gap);
      // 需要至少2倍屏幕宽度才能无缝滚动
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
          // ✅ 提示浏览器走 GPU 合成层，动画不占主线程，降低 TBT
          willChange: "transform",
        }}
      >
        {repeated.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative flex-shrink-0 w-[130px] h-[190px] md:w-[170px] md:h-[220px] rounded-lg overflow-hidden"
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width: 768px) 130px, 170px"
              className="object-cover"
              // ✅ 每行只有前 5 张 eager（首屏可见），其余全部 lazy
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
    <div className="absolute inset-0 z-0 flex flex-col justify-start gap-2 overflow-hidden">
      <PhotoRow images={ROW1} direction="left" speed={20} />
      <PhotoRow images={ROW2} direction="right" speed={25} />
      <PhotoRow images={ROW3} direction="left" speed={22} />

      {/* 四边渐变遮罩 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-slate-950/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
        <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-slate-950 to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-slate-950 to-transparent" />
      </div>
    </div>
  );
}