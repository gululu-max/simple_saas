"use client";

import dynamic from "next/dynamic";

const PhotoWall = dynamic(
  () =>
    import("@/components/photo-wall").then((m) => ({
      default: m.PhotoWall,
    })),
  { ssr: false }
);

export function PhotoWallLazy() {
  // min-h 占位防 CLS：2 行 × (180/220px) + 8px gap
  return (
    <div className="min-h-[368px] md:min-h-[448px]">
      <PhotoWall />
    </div>
  );
}
