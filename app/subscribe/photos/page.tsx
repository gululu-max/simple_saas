"use client";

// ═══════════════════════════════════════════════════════════════
// /subscribe/photos — "My Photos" album.
// Standalone route (entry lives in the global top header). Reads the
// user's enhanced photos from /api/my-photos (DB-backed) and renders
// the iPhone-Photos-style grid.
//
// States: loading / signed-out / error / grid (PhotosGallery handles
// the empty placeholder + "Generate" CTA internally).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import PhotosGallery from "@/components/scanner/gallery/PhotosGallery";
import type { GalleryPhoto } from "@/components/scanner/gallery/PhotoViewer";

type State =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error" }
  | { kind: "ready"; photos: GalleryPhoto[] };

export default function MyPhotosPage() {
  const t = useT().gallery;
  const { openAuthModal } = useAuthModal();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/my-photos");
      if (res.status === 401) {
        setState({ kind: "signed-out" });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      const data = await res.json();
      setState({ kind: "ready", photos: data.photos ?? [] });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-2xl px-3 py-4 md:py-6">
        <h1 className="text-xl md:text-2xl font-bold tracking-[-0.5px] text-ink px-1 mb-2">
          {t.title}
        </h1>

        {state.kind === "loading" && (
          <div className="flex items-center justify-center py-24 text-ink-muted">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}

        {state.kind === "signed-out" && (
          <div className="flex flex-col items-center text-center py-24 px-6">
            <h2 className="text-lg font-bold text-ink mb-1.5">{t.signInTitle}</h2>
            <p className="text-sm text-ink-muted max-w-xs mb-6">{t.signInDesc}</p>
            <button
              onClick={() => openAuthModal("sign-in")}
              className="inline-flex items-center justify-center h-11 px-6 rounded-btn bg-rausch text-white font-semibold hover:bg-rausch-active transition-colors"
            >
              {t.signInCta}
            </button>
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex flex-col items-center text-center py-24 px-6">
            <p className="text-sm text-ink-muted mb-5">{t.loadError}</p>
            <button
              onClick={load}
              className="inline-flex items-center justify-center h-10 px-5 rounded-btn border border-hairline text-ink font-semibold hover:bg-surface-soft transition-colors"
            >
              {t.retry}
            </button>
          </div>
        )}

        {state.kind === "ready" && <PhotosGallery photos={state.photos} />}
      </div>
    </div>
  );
}
