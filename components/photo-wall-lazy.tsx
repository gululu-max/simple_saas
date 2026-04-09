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
  return <PhotoWall />;
}