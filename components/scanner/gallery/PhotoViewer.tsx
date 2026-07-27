"use client";

// ═══════════════════════════════════════════════════════════════
// Fullscreen photo viewer (iPhone Photos style).
// - swipe / arrow / keyboard nav across the flat photo list
// - 「Hold to see original」: press-and-hold swaps enhanced → original
//   (instant src swap, no transition — matches the design's chosen
//    compare gesture)
// - 「Regenerate」 → routes to the real generation page (/subscribe/scanner)
// - download button → /api/download/[id] (full-res, existing credit gate)
//   + a "Saved" toast
//
// Recreated from the design bundle's gallery.jsx PhotoViewer.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, Sparkles, Check, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

export interface GalleryPhoto {
  id: string;
  groupId: string | null;
  look: string;
  score: number | null;
  variantIndex: number;
  createdAt: string;
  mimeType: string;
  downloaded: boolean;
  unlocked: boolean;
  enhancedPreviewUrl: string;
  originalUrl: string | null;
  /** date-section label, filled in by PhotosGallery */
  groupLabel?: string;
}

interface PhotoViewerProps {
  photos: GalleryPhoto[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}

export default function PhotoViewer({ photos, index, onClose, onIndex }: PhotoViewerProps) {
  const t = useT().gallery;
  const router = useRouter();
  const [peek, setPeek] = useState(false); // holding "original"
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const startX = useRef<number | null>(null);

  const photo = photos[index];

  const go = (dir: number) => {
    const next = index + dir;
    if (next < 0 || next >= photos.length) return;
    setPeek(false);
    onIndex(next);
  };

  // keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 1900);
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/download/${photo.id}`);
      if (res.status === 402) {
        showToast("err", t.needCredits);
        return;
      }
      if (!res.ok) {
        showToast("err", t.downloadFailed);
        return;
      }
      const blob = await res.blob();
      const ext = photo.mimeType === "image/jpeg" ? "jpg" : "png";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `matchfix-${photo.look.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("ok", t.saved);
    } catch {
      showToast("err", t.downloadFailed);
    } finally {
      setDownloading(false);
    }
  };

  const canPeek = !!photo.originalUrl;
  const showingOriginal = peek && canPeek;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 h-14 shrink-0">
        <button
          onClick={onClose}
          aria-label={t.back}
          className="grid place-items-center size-10 rounded-full bg-white/10 text-white"
        >
          <ChevronRight className="size-5 -scale-x-100" />
        </button>
        <div className="text-center">
          <div className="text-[13px] font-semibold text-white">{photo.look}</div>
          {photo.groupLabel && (
            <div className="text-[10.5px] text-white/55">{photo.groupLabel}</div>
          )}
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          aria-label={t.saved}
          className="grid place-items-center size-10 rounded-full bg-white/10 text-white disabled:opacity-50"
        >
          <Download className="size-5" />
        </button>
      </div>

      {/* Image stage */}
      <div
        className="flex-1 relative min-h-0 flex items-center justify-center px-3 select-none"
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
          startX.current = null;
        }}
      >
        {/* Single image — swaps src on peek (instant, no transition) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={showingOriginal ? (photo.originalUrl as string) : photo.enhancedPreviewUrl}
          alt={photo.look}
          className="max-w-full max-h-full object-contain rounded-[10px]"
          draggable={false}
        />

        {/* State label */}
        <div
          className={`absolute top-2 left-5 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 text-white backdrop-blur ${
            showingOriginal ? "bg-black/60" : "bg-rausch"
          }`}
        >
          {showingOriginal ? (
            t.original
          ) : (
            <>
              <Sparkles className="size-3" /> {t.aiEnhanced}
            </>
          )}
        </div>

        {/* Desktop arrows */}
        {index > 0 && (
          <button
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-4 top-1/2 -translate-y-1/2 size-9 rounded-full grid place-items-center bg-white/15 text-white"
          >
            <ChevronRight className="size-4 -scale-x-100" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-4 top-1/2 -translate-y-1/2 size-9 rounded-full grid place-items-center bg-white/15 text-white"
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>

      {/* Counter */}
      <div className="flex items-center justify-center py-2 shrink-0">
        <span className="text-[11px] tabular-nums text-white/50">
          {index + 1} / {photos.length}
        </span>
      </div>

      {/* Bottom action row — hold-for-original + regenerate */}
      <div className="shrink-0 px-4 pt-2 pb-6 flex items-center gap-3">
        <button
          disabled={!canPeek}
          onMouseDown={() => setPeek(true)}
          onMouseUp={() => setPeek(false)}
          onMouseLeave={() => setPeek(false)}
          onTouchStart={(e) => {
            e.preventDefault();
            setPeek(true);
          }}
          onTouchEnd={() => setPeek(false)}
          className="flex-1 h-[52px] rounded-[13px] flex items-center justify-center gap-2 font-bold text-[15px] select-none transition-colors disabled:opacity-40"
          style={{
            background: showingOriginal ? "#fff" : "rgba(255,255,255,0.14)",
            color: showingOriginal ? "#000" : "#fff",
            boxShadow: showingOriginal ? "0 6px 20px rgba(255,255,255,0.25)" : "none",
          }}
        >
          <RefreshCw className="size-4 -scale-x-100" />
          {showingOriginal ? t.releaseToSeeEnhanced : t.holdToSeeOriginal}
        </button>
        <button
          onClick={() => router.push("/subscribe/scanner")}
          className="flex-1 h-[52px] rounded-[13px] flex items-center justify-center gap-2 font-bold text-[15px] text-white bg-rausch"
          style={{ boxShadow: "0 6px 20px rgba(255,56,92,0.4)" }}
        >
          <Sparkles className="size-4" /> {t.regenerate}
        </button>
      </div>

      {/* toast */}
      {toast && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 bottom-24 px-4 py-2.5 rounded-full flex items-center gap-2 z-10 text-white text-[13px] font-bold ${
            toast.kind === "ok" ? "bg-green-600/95" : "bg-black/85"
          }`}
        >
          {toast.kind === "ok" && <Check className="size-4" strokeWidth={3} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
