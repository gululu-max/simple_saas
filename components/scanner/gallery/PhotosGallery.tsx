"use client";

// ═══════════════════════════════════════════════════════════════
// PhotosGallery — iPhone-Photos-style grid for /subscribe/photos.
// 3-column square thumbnails grouped by date with sticky section
// headers; tap a thumb → fullscreen PhotoViewer.
//
// Empty state → placeholder + "Generate photos" CTA (per product
// decision: album holds post-generation photos; no photos → go make some).
//
// Recreated from the design bundle's gallery.jsx GalleryScreen.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import Link from "next/link";
import { ImageIcon, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import PhotoViewer, { type GalleryPhoto } from "./PhotoViewer";

interface PhotosGalleryProps {
  photos: GalleryPhoto[];
}

function dateGroupLabel(
  iso: string,
  t: { groupToday: string; groupYesterday: string; groupPrevious7: string },
): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayMs = 86400000;
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / dayMs);
  if (diffDays <= 0) return t.groupToday;
  if (diffDays === 1) return t.groupYesterday;
  if (diffDays <= 7) return t.groupPrevious7;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PhotosGallery({ photos }: PhotosGalleryProps) {
  const t = useT().gallery;
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Attach a date-section label to each photo, then group consecutive
  // photos that share a label (list is already newest-first).
  const { labeled, sections } = useMemo(() => {
    const labeled = photos.map((p) => ({
      ...p,
      groupLabel: dateGroupLabel(p.createdAt, t),
    }));
    const sections: { label: string; items: { p: GalleryPhoto; i: number }[] }[] = [];
    labeled.forEach((p, i) => {
      const last = sections[sections.length - 1];
      if (last && last.label === p.groupLabel) last.items.push({ p, i });
      else sections.push({ label: p.groupLabel, items: [{ p, i }] });
    });
    return { labeled, sections };
  }, [photos, t]);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-6">
        <div className="grid place-items-center size-16 rounded-full bg-surface-soft mb-5">
          <ImageIcon className="size-7 text-ink-muted" />
        </div>
        <h2 className="text-lg font-bold text-ink mb-1.5">{t.emptyTitle}</h2>
        <p className="text-sm text-ink-muted max-w-xs mb-6">{t.emptyDesc}</p>
        <Link
          href="/subscribe/scanner"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-btn bg-rausch text-white font-semibold hover:bg-rausch-active transition-colors"
        >
          <Sparkles className="size-4" /> {t.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <>
      {sections.map((sec, si) => (
        <div key={si}>
          <div className="sticky top-16 z-10 px-1 pt-3 pb-2 text-[15px] font-bold text-ink tracking-[-0.3px] bg-canvas/90 backdrop-blur">
            {sec.label}
          </div>
          <div className="grid grid-cols-3 gap-0.5">
            {sec.items.map(({ p, i }) => (
              <button
                key={p.id}
                onClick={() => setOpenIdx(i)}
                className="relative overflow-hidden bg-surface-soft aspect-square group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.enhancedPreviewUrl}
                  alt={p.look}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  draggable={false}
                />
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-black/50 backdrop-blur">
                  {p.look}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="text-center py-6 text-[12.5px] text-ink-muted">
        {photos.length} {t.photosWord} · {t.countSuffix}
      </div>

      {openIdx !== null && (
        <PhotoViewer
          photos={labeled}
          index={openIdx}
          onIndex={setOpenIdx}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </>
  );
}
