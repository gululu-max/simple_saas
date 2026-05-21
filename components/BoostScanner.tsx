'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useCompletion } from 'ai/react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Loader2, Wand2, Download, Lock, ChevronLeft, ChevronRight,
  Image as ImageIcon, Upload, Copy, Check, Coins, Crown,
  ShieldCheck, RefreshCw, Sparkles, XCircle, X,
  AlertCircle, Zap, Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseAnalysisStream } from '@/utils/parseAnalysisStream';
import { createClient } from '@/utils/supabase/client';
import { useAuthModal } from '@/components/auth/auth-modal-context';
import { toast } from '@/hooks/use-toast';
import AnalysisResultCard from '@/components/AnalysisResultCard';
import UsageGuideCard from '@/components/UsageGuideCard';
import PaywallView from '@/components/scanner/PaywallView';
import AnalyzingFlow from '@/components/scanner/AnalyzingFlow';
import RevealScreen from '@/components/scanner/delivery/RevealScreen';
import DeliveryScreen, { type DeliveryVariant } from '@/components/scanner/delivery/DeliveryScreen';
import SaveToast from '@/components/scanner/delivery/SaveToast';
import { FAKE_LOOKS } from '@/components/scanner/FakeThumbnails';
import DatingTrivia from '@/components/DatingTrivia';
import GenerationProgress from '@/components/scanner/delivery/GenerationProgress';
import { useT } from '@/lib/i18n/provider';

// ═══════════════════════════════════════════════════════════════
// components/BoostScanner.tsx — v9.3
//
// v9.3 changes vs v9.2:
// 1. [NEW] Result Showcase Modal — auto-pops after enhance completes
//    with before/after swipe, shimmer download CTA, urgency copy
// 2. All v9.2 logic preserved — zero changes to existing flows
// ═══════════════════════════════════════════════════════════════

// ── Upload guidance examples (reuse home-page case images) ──
const EXAMPLE_PAIRS = [
  { before: '/cases/kevin-before.webp', after: '/cases/kevin-after.webp' },
  { before: '/cases/ryan-before.webp', after: '/cases/ryan-after.webp' },
  { before: '/cases/jason-before.webp', after: '/cases/jason-after.webp' },
];

// ── Safe Storage Helpers (iOS Safari Private Mode throws on setItem) ──
function safeGetItem(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}
function safeSetItem(storage: Storage, key: string, value: string): void {
  try { storage.setItem(key, value); } catch { /* quota exceeded or private mode */ }
}
function safeRemoveItem(storage: Storage, key: string): void {
  try { storage.removeItem(key); } catch { /* ignore */ }
}

// ── requestIdleCallback polyfill (Safari doesn't support it) ──
const scheduleIdle: (cb: () => void) => void =
  (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function')
    ? (cb) => window.requestIdleCallback(cb)
    : (cb) => setTimeout(cb, 0);

// Render `src` to a canvas with an optional CSS-filter applied, then trigger
// a browser download. Used by the post-payment delivery flow to produce the
// 3 "looks" as standalone JPEGs while the real backend variants are mocked
// via CSS filters. Safe with data: URLs (no CORS taint).
async function downloadFilteredImage(src: string, filter: string | undefined, filename: string): Promise<void> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 64)}…`));
  });
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  if (filter) ctx.filter = filter;
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/jpeg', 0.92);
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the download actually triggers in slower browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  // Release canvas memory.
  canvas.width = 0;
  canvas.height = 0;
}

async function compressImage(file: File, options?: { maxSize?: number; quality?: number }): Promise<string> {
  // [v9.2] maxSize 800 (was 1024) — reduces canvas memory ~40% for WebView stability
  const { maxSize = 800, quality = 0.75 } = options || {};
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
  let { width, height } = img;
  if (width > height && width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
  else if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  // [v9.2] Release canvas memory immediately — critical for low-memory WebViews
  canvas.width = 0; canvas.height = 0;
  return dataUrl;
}
const isFacebookWebView = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|FB_IAB|FBIOS|FBSS/i.test(navigator.userAgent || '');
};
const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) window.gtag('event', eventName, params);
};
const dispatchCreditsUpdate = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'));
};

// [v9] added 'download_unlock' modal type
type ModalType = 'enhance' | 'download_choice' | 'download_unlock' | 'membership' | 'credits_shop' | 'privacy_exit' | 'free_limit' | 'enhance_failed' | 'ai_busy';
type SelectedPanel = 'original' | 'enhanced';

// ── Pre-upload hero: auto-sweep before/after demo → upload zone → review tray ──
// Two visible states:
//   1. No photos picked: sweep demo → tap-to-upload overlay
//   2. Photos picked: user's main photo + thumb tray + sticky Enhance CTA
// After the user clicks Enhance, BoostScanner switches to the analyzing view.
type UploadHeroProps = {
  beforeSrc: string;
  afterSrc: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onMainPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAltPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (idx: number) => void;
  onClearAll: () => void;
  onSubmit: () => void;
  photos: string[];        // 0..maxPhotos picked photos (data-url / blob-url)
  maxPhotos: number;       // hard cap (currently 2)
  useFusion: boolean;
  setUseFusion: (v: boolean) => void;
};

function UploadHero({
  beforeSrc,
  afterSrc,
  fileInputRef,
  onMainPhotoSelect,
  onAltPhotoSelect,
  onRemovePhoto,
  onClearAll,
  onSubmit,
  photos,
  maxPhotos,
  useFusion,
  setUseFusion,
}: UploadHeroProps) {
  const t = useT().uploadHero;
  const [phase, setPhase] = useState<'sweep' | 'upload'>('sweep');
  const [sliderPos, setSliderPos] = useState(0);
  const isUpload = phase === 'upload';
  const hasPhotos = photos.length > 0;

  // Auto-sweep choreography on first mount (only runs in no-photos state)
  useEffect(() => {
    if (hasPhotos) {
      // If user already has photos (e.g. session restore), skip sweep.
      setPhase('upload');
      setSliderPos(100);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const HOLD = 350;
    const SWEEP = 1500;
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < HOLD) {
        setSliderPos(0);
      } else if (elapsed < HOLD + SWEEP) {
        const p = (elapsed - HOLD) / SWEEP;
        setSliderPos(ease(p) * 100);
      } else {
        setSliderPos(100);
        setTimeout(() => setPhase('upload'), 250);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // We intentionally only want this to fire on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex flex-col gap-4 w-full max-w-[460px] mx-auto"
      style={{ paddingBottom: hasPhotos ? 116 : 0 }}
    >
      {/* Headline */}
      <div className="text-center px-1">
        <h1 className="font-bold leading-[1.05] text-ink" style={{ fontSize: 26, letterSpacing: '-0.5px' }}>
          {t.headline}
        </h1>
        <p className="mt-1.5 text-[13px] text-ink-muted">
          {t.subhead}
        </p>
      </div>

      {/* MERGED hero: sweep demo (no photos) → user photo + thumb tray (has photos) */}
      <div className="relative">
        {/* Hidden input that opens when sweep overlay is tapped (multi-file for fresh upload). */}
        {!hasPhotos && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onMainPhotoSelect}
            className="hidden"
          />
        )}

        <div
          onClick={() => {
            if (hasPhotos) return; // taps inside the tray handle adds
            if (isUpload) fileInputRef.current?.click();
          }}
          className="relative w-full overflow-hidden select-none rounded-card"
          style={{
            aspectRatio: '4 / 5',
            background: '#f7f7f7',
            boxShadow: hasPhotos
              ? '0 12px 32px rgba(0,0,0,0.16)'
              : isUpload
                ? '0 0 0 2px #ff385c, 0 12px 32px rgba(255,56,92,0.22)'
                : '0 8px 24px rgba(0,0,0,0.08)',
            transition: 'box-shadow 0.4s ease',
            cursor: hasPhotos ? 'default' : isUpload ? 'pointer' : 'default',
          }}
        >
          {hasPhotos ? (
            <>
              {/* User's main photo as hero */}
              <img src={photos[0]} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.55) 100%)',
                }}
              />
              {/* Top-left count badge */}
              <div
                className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11px] font-bold text-white backdrop-blur-md"
                style={{ background: 'rgba(0,0,0,0.6)' }}
              >
                <Camera className="size-3" /> {photos.length} / {maxPhotos} {t.selected}
              </div>
              {/* Top-right clear-all */}
              <button
                type="button"
                onClick={onClearAll}
                className="absolute top-3 right-3 size-7 rounded-full grid place-items-center text-white backdrop-blur-md"
                style={{ background: 'rgba(0,0,0,0.55)' }}
                aria-label={t.clearAll}
              >
                <X className="size-3.5" />
              </button>
              {/* Bottom thumb tray */}
              <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
                {Array.from({ length: maxPhotos }).map((_, i) => {
                  const filled = i < photos.length;
                  if (filled) {
                    return (
                      <div
                        key={i}
                        className="relative size-14 rounded-[10px] overflow-hidden"
                        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.35), 0 0 0 2px #fff' }}
                      >
                        <img src={photos[i]} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemovePhoto(i);
                          }}
                          className="absolute -top-1 -right-1 size-5 rounded-full grid place-items-center bg-ink text-white"
                          aria-label={t.removePhoto}
                        >
                          <X className="size-2.5" />
                        </button>
                        {i === 0 && (
                          <div
                            className="absolute bottom-0 inset-x-0 text-center text-[8px] font-bold py-0.5 bg-rausch text-white"
                          >
                            {t.mainBadge}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <label
                      key={i}
                      className="size-14 rounded-[10px] border-2 border-dashed grid place-items-center cursor-pointer"
                      style={{
                        borderColor: 'rgba(255,255,255,0.7)',
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onAltPhotoSelect}
                        className="hidden"
                      />
                      <Camera className="size-4 text-white" />
                    </label>
                  );
                })}
                <div
                  className="ml-auto px-2.5 py-1.5 rounded-pill text-[10.5px] font-medium text-white backdrop-blur-md"
                  style={{ background: 'rgba(0,0,0,0.55)' }}
                >
                  {photos.length < maxPhotos ? `${maxPhotos - photos.length} ${t.moreAllowed}` : t.maxedOut}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* BEFORE base layer */}
              <img
                src={beforeSrc}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
              {/* AFTER reveals from the LEFT as sweep advances */}
              <div
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{
                  width: `${sliderPos}%`,
                  transition: isUpload ? 'width 0.5s cubic-bezier(0.4,0,0.2,1)' : 'none',
                }}
              >
                <img
                  src={afterSrc}
                  alt=""
                  className="absolute inset-y-0 left-0 h-full object-cover"
                  style={{ width: `${(100 / Math.max(1, sliderPos)) * 100}%`, maxWidth: 'none' }}
                  draggable={false}
                />
              </div>
              {/* BEFORE label — fades out as sweep progresses */}
              <div
                className="absolute top-3 left-3 px-2.5 py-1 rounded-pill text-[11px] font-bold text-white backdrop-blur-md"
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  opacity: isUpload ? 0 : Math.max(0, 1 - sliderPos / 60),
                  transition: 'opacity 0.3s',
                }}
              >
                {t.beforeLabel}
              </div>
              {/* AFTER label — fades in as sweep progresses */}
              <div
                className="absolute top-3 right-3 px-2.5 py-1 rounded-pill text-[11px] font-bold text-white bg-rausch flex items-center gap-1"
                style={{
                  opacity: isUpload ? 0 : Math.min(1, sliderPos / 50),
                  transition: 'opacity 0.3s',
                }}
              >
                <Sparkles className="size-3" /> {t.afterLabel}
              </div>
              {/* Sweep handle */}
              {!isUpload && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: `calc(${sliderPos}% - 1.5px)`,
                    width: 3,
                    background: '#fff',
                    boxShadow: '0 0 16px #ff385c',
                  }}
                >
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-10 rounded-full grid place-items-center bg-canvas"
                    style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}
                  >
                    <Sparkles className="size-4 text-rausch" />
                  </div>
                </div>
              )}
              {/* Sweep status chip */}
              {!isUpload && (
                <div
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-pill text-[11px] font-medium text-white flex items-center gap-1.5 backdrop-blur-md"
                  style={{ background: 'rgba(0,0,0,0.65)' }}
                >
                  <span className="size-1.5 rounded-full bg-rausch animate-pulse" />
                  {t.sweepStatus}
                </div>
              )}
              {/* Upload overlay — fades in after sweep */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
                style={{
                  background: isUpload
                    ? 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)'
                    : 'transparent',
                  opacity: isUpload ? 1 : 0,
                  transition: 'opacity 0.5s ease 0.1s, background 0.5s ease',
                  pointerEvents: isUpload ? 'auto' : 'none',
                }}
              >
                <div
                  className="size-16 rounded-full grid place-items-center mb-3 bg-rausch"
                  style={{
                    boxShadow: '0 10px 28px rgba(255,56,92,0.45)',
                    animation: isUpload ? 'heroPop 0.45s cubic-bezier(0.2,0.8,0.2,1)' : 'none',
                  }}
                >
                  <Camera className="size-7 text-white" />
                </div>
                <div
                  className="font-bold text-[20px] text-white"
                  style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
                >
                  {t.choosePhotos}
                </div>
                <div className="text-[12px] mt-1 text-white/85">
                  {t.uploadHint}
                </div>
                <div
                  className="mt-4 inline-flex items-center justify-center h-12 px-6 rounded-pill font-bold text-[15px] bg-canvas text-rausch"
                  style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}
                >
                  {t.uploadCta}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* [2026-05-15] 3-cell stats row + trust strip (per UI mock).
          Cells use a faint rausch-tinted background to match the design. */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: t.stat1Value, l: t.stat1Label },
          { v: t.stat2Value, l: t.stat2Label },
          { v: t.stat3Value, l: t.stat3Label },
        ].map((s) => (
          <div
            key={s.l}
            className="text-center py-2.5 rounded-[12px]"
            style={{ background: 'rgba(255,56,92,0.06)' }}
          >
            <div className="font-bold text-[16px] text-ink tracking-[-0.4px]">{s.v}</div>
            <div className="text-[10px] mt-0.5 text-ink-muted">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 text-[11px] text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="size-3" /> {t.trustNoStored}
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Lock className="size-3" /> {t.trustEncrypted}
        </span>
      </div>

      {hasPhotos && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 bg-canvas px-4 pt-3 pb-5"
          style={{ boxShadow: '0 -8px 24px rgba(0,0,0,0.08)' }}
        >
          <div className="mx-auto w-full max-w-[460px]">
            <button
              type="button"
              onClick={onSubmit}
              className="relative w-full h-14 rounded-[14px] overflow-hidden flex items-center justify-center gap-2 font-bold text-[17px] text-white"
              style={{
                background: '#ff385c',
                boxShadow: '0 8px 24px rgba(255,56,92,0.4)',
              }}
            >
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.3) 50%, transparent 65%)',
                  animation: 'shimmer 2.4s ease-in-out infinite',
                }}
              />
              <Sparkles className="size-5 relative z-10" />
              <span className="relative z-10">{t.enhanceCta}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BoostScanner() {
  const dict = useT();
  const tCommon = dict.scannerCommon;
  const tOverlay = dict.overlays;
  const tToast = dict.toasts;
  const [preview, setPreview] = useState<string | null>(null);
  // [no-login refactor 2026-05-13] Alt photos for 1-3 photo upload (up to 2 alts).
  // preview = main (slot 0); altPhotos[0..1] = slots 1-2.
  // TODO[no-login]: when enhance is rewired post-payment, batch ALL uploaded
  // photos into the same paid run.
  const [altPhotos, setAltPhotos] = useState<string[]>([]);
  const MAX_PHOTOS = 3;
  // Latched once the user clicks Enhance. Used to keep the analyze view
  // mounted across the brief gap between `isLoading=false` and `visibleText`
  // being populated by onFinish (would otherwise flash back to UploadHero).
  const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [watermarkedImage, setWatermarkedImage] = useState<string | null>(null);
  const [enhancementId, setEnhancementId] = useState<string | null>(null);
  const [enhancedMimeType, setEnhancedMimeType] = useState('image/png');
  const [isGuestEnhanced, setIsGuestEnhanced] = useState(false);
  const [isFreeGeneration, setIsFreeGeneration] = useState(false);
  const [isDownloadFree, setIsDownloadFree] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [visibleText, setVisibleText] = useState<string>('');
  const [analysisJSON, setAnalysisJSON] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel>('original');
  const [sliderIndex, setSliderIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // [v9.2] Auto-start & credit confirm states
  const [autoStartChecking, setAutoStartChecking] = useState(false);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(40);

  // [v9.3] Result Showcase Modal state
  const [showResultShowcase, setShowResultShowcase] = useState(false);
  const [showcaseSlideIndex, setShowcaseSlideIndex] = useState(1); // default to enhanced
  const showcaseTouchStartX = useRef<number | null>(null);
  const showcaseTouchEndX = useRef<number | null>(null);

  // [no-login refactor 2026-05-15] Post-payment delivery flow
  //   reveal: 2s celebration animation (auto-advances to delivery)
  //   delivery: gallery page with drag-compare + Save all CTA
  //   null: not in delivery flow
  // TODO[no-login]: once /api/scan-result/[scanId] exists, replace mock
  // deliveryVariants with real enhancement_ids fetched on payment_success.
  // [no-login pivot 2026-05-18] useState 不能依赖 URL/sessionStorage（SSR 环境
  // 没有这俩，会触发 hydration mismatch）。state 由下面的 useEffect (session
  // restore) 在 mount 时设置。第一帧到 effect 之间会闪一下 upload hero，但是
  // ~16ms，再加下面的 isHydrated 守卫，用户感知不到。
  const [postPaymentStage, setPostPaymentStage] = useState<'reveal' | 'delivery' | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isSavingDelivery, setIsSavingDelivery] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxTouchStartX = useRef<number | null>(null);
  const lightboxTouchEndX = useRef<number | null>(null);
  // Lightbox compare-slider state — drag a vertical handle to reveal BEFORE under AFTER
  const lightboxDragRef = useRef<HTMLDivElement | null>(null);
  const lightboxDraggingRef = useRef(false);
  const [lightboxComparePos, setLightboxComparePos] = useState(50);

  // [fusion] 融合开关 — 默认开启，用户可勾掉切回纯 retouch
  const [useFusion, setUseFusion] = useState(true);
  const [sceneTags, setSceneTags] = useState<string | null>(null);

  // [scan_id] Server-side scan reference returned by the scanner. When
  // present, enhance-photo loads the original + analysis from DB instead
  // of re-uploading them.
  // [no-login pivot 2026-05-18] 同样不能 lazy init 读 URL/sessionStorage
  // (hydration mismatch)。下面 useEffect 会从 URL/sessionStorage 灌进来。
  const [scanId, setScanId] = useState<string | null>(null);

  // [variants] Full variant array from enhance-photo response. Length 1
  // for retouch, up to 3 for fusion. The "currently shown" variant is
  // tracked via selectedVariantIndex; watermarkedImage/enhancementId/
  // enhancedMimeType above mirror variants[selectedVariantIndex] so the
  // existing display + download paths keep working unchanged.
  type VariantData = {
    enhancementId: string;
    image: string;
    mimeType: string;
    matchedScene: string | null;
    variantIndex: number;
  };
  const [variants, setVariants] = useState<VariantData[] | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

  // [pre-pay analyzing 2026-05-18] 上传后到付费墙之间的"假分析"等待 UI
  // analyzingActive: 控制 AnalyzingFlow 是否显示（独占 upload/paywall 视图）
  // analyzingProgress: 0-100，外部 setInterval 推进，stream 完成跳 100 再切付费墙
  const [analyzingActive, setAnalyzingActive] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);

  // [no-login pivot 2026-05-17] 付费墙跳 Creem 期间禁用按钮 + spinner
  const [isUnlocking, setIsUnlocking] = useState(false);
  // 付费回跳后的真实交付图（替代 FAKE_LOOKS mock）
  type DeliveryVariantReal = {
    enhancementId: string;
    image: string;
    mimeType: string;
    matchedScene: string | null;
    variantIndex: number;
  };
  const [paidVariants, setPaidVariants] = useState<DeliveryVariantReal[] | null>(null);
  // [multi-photo 2026-05-18] 后端 enhance 全失败的标记；展示重试按钮
  const [paymentEnhanceFailed, setPaymentEnhanceFailed] = useState(false);
  const [isRetryingEnhance, setIsRetryingEnhance] = useState(false);
  // 给轮询 effect 用的 nonce — 重试时 +1 让 effect 重跑
  const [pollNonce, setPollNonce] = useState(0);

  const hasActiveResult = !!(preview && (analyzingActive || visibleText || watermarkedImage || isGuestEnhanced));
  const showEnhanced = !!(watermarkedImage || isGuestEnhanced);
  const isCompact = !!(visibleText && preview);
  const isEnhancementComplete = !!(enhancementId && !isGuestEnhanced);

  const pendingNavigationRef = useRef<string | null>(null);
  const skipExitWarningRef = useRef(false);
  const autoResumeFromOneTapRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const { openAuthModal } = useAuthModal();

  const enhancedSrc = watermarkedImage ? `data:${enhancedMimeType};base64,${watermarkedImage}` : null;

  // Lightbox images array
  const lightboxImages = React.useMemo(() => {
    const imgs: { src: string; label: string }[] = [];
    if (preview) imgs.push({ src: preview, label: 'Original' });
    if (enhancedSrc && !isGuestEnhanced) imgs.push({ src: enhancedSrc, label: 'AI Enhanced' });
    return imgs;
  }, [preview, enhancedSrc, isGuestEnhanced]);

  // ── Session Restore ────────────────────────────────────────
  useEffect(() => {
    const savedPreview = safeGetItem(sessionStorage, 'mf_preview') || safeGetItem(localStorage, 'mf_preview');
    // [no-login pivot 2026-05-18] savedText / savedJSON 不再恢复到 React state。
    // 原因：mount 时把 visibleText 灌回去会让旧的 AnalysisResultCard 渲染分支
    // 因为 isGuestEnhanced 默认 false 而触发 (bug：付费墙停留太久浏览器把 tab
    // 从内存丢出来 / 页面被 RSC 刷新时，用户会回退到老的分析结果页)。
    // visibleText / analysisJSON 在新流程里只走 server-side (scan_id 里读)，
    // 前端不再展示。下面读取保留作日志变量但不 setState。
    const savedText = safeGetItem(sessionStorage, 'mf_visibleText') || safeGetItem(localStorage, 'mf_visibleText');
    const savedJSON = safeGetItem(sessionStorage, 'mf_analysisJSON') || safeGetItem(localStorage, 'mf_analysisJSON');
    const guestFlag = safeGetItem(localStorage, 'mf_guest_enhanced');
    void savedText; void savedJSON;
    if (savedPreview) setPreview(savedPreview);
    // [DISABLED 2026-05-18 — no-login pivot]
    // if (savedText) setVisibleText(savedText);
    // if (savedJSON) setAnalysisJSON(savedJSON);
    // 批量写回 sessionStorage，避免阻塞渲染
    scheduleIdle(() => {
      if (savedPreview) safeSetItem(sessionStorage, 'mf_preview', savedPreview);
      // 写回也停掉 —— 不读就没必要回写
      // if (savedText) safeSetItem(sessionStorage, 'mf_visibleText', savedText);
      // if (savedJSON) safeSetItem(sessionStorage, 'mf_analysisJSON', savedJSON);
    });
    const savedWatermarked = safeGetItem(sessionStorage, 'mf_watermarkedImage');
    const savedEnhancementId = safeGetItem(sessionStorage, 'mf_enhancementId');
    const savedMimeType = safeGetItem(sessionStorage, 'mf_enhancedMimeType');
    const savedFreeTrial = safeGetItem(sessionStorage, 'mf_isFreeGeneration');
    const savedDownloadFree = safeGetItem(sessionStorage, 'mf_isDownloadFree');
    const savedScanId = safeGetItem(sessionStorage, 'mf_scan_id');
    const savedVariants = safeGetItem(sessionStorage, 'mf_variants');
    const savedVariantsMeta = safeGetItem(sessionStorage, 'mf_variants_meta');
    if (savedWatermarked && savedEnhancementId) {
      setWatermarkedImage(savedWatermarked); setEnhancementId(savedEnhancementId);
      if (savedMimeType) setEnhancedMimeType(savedMimeType);
      setIsFreeGeneration(savedFreeTrial === 'true'); setIsDownloadFree(savedDownloadFree === 'true');
      setSliderIndex(1); setSelectedPanel('enhanced');
    }
    if (savedScanId) setScanId(savedScanId);
    // Prefer full variants payload; fall back to lightweight meta + per-variant
    // image keys when iOS Safari quota dropped the combined blob.
    if (savedVariants) {
      try {
        const parsed = JSON.parse(savedVariants) as VariantData[];
        if (Array.isArray(parsed) && parsed.length > 0) setVariants(parsed);
      } catch { /* ignore */ }
    } else if (savedVariantsMeta) {
      try {
        const meta = JSON.parse(savedVariantsMeta) as Array<Omit<VariantData, 'image'>>;
        if (Array.isArray(meta) && meta.length > 0) {
          const restored: VariantData[] = meta.map((m, i) => {
            const img = safeGetItem(sessionStorage, `mf_variant_image_${i}`) ?? '';
            const fallbackImg = !img && m.enhancementId === savedEnhancementId ? (savedWatermarked ?? '') : img;
            return { ...m, image: fallbackImg };
          });
          setVariants(restored);
        }
      } catch { /* ignore */ }
    }
    if (guestFlag === 'true' && savedPreview) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setIsGuestEnhanced(true); setSliderIndex(1); setSelectedPanel('enhanced'); safeSetItem(sessionStorage, 'mf_pending_enhance', 'true');
        } else {
          // Logged in but stale guest data → user signed in elsewhere (e.g. One Tap on homepage).
          // Clean up flags and auto-resume the enhance flow.
          const hasPending = safeGetItem(localStorage, 'mf_pending_enhance') === 'true';
          ['mf_pending_enhance', 'mf_guest_enhanced', 'mf_preview', 'mf_analysisJSON', 'mf_visibleText']
            .forEach(k => safeRemoveItem(localStorage, k));
          safeRemoveItem(sessionStorage, 'mf_pending_enhance');
          if (hasPending && (savedJSON || savedText)) {
            autoResumeFromOneTapRef.current = true;
          }
        }
      });
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      // [no-login pivot 2026-05-18] 付费回跳：URL 取 scan_id (兜底
      // sessionStorage)，直接进 delivery 阶段 (DatingTrivia + GenerationProgress
      // 等待屏)，跳过 reveal 动画 —— 用户反馈"先闪上传页再到答题"，希望直接到。
      const urlScanId = params.get('scan_id');
      const restoredScanId = urlScanId || safeGetItem(sessionStorage, 'mf_scan_id');
      if (restoredScanId) {
        setScanId(restoredScanId);
        safeSetItem(sessionStorage, 'mf_scan_id', restoredScanId);
      }
      params.delete('payment');
      params.delete('scan_id');
      window.history.replaceState({}, '', params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname);
      trackEvent('payment_return_success');
      dispatchCreditsUpdate();
      safeRemoveItem(sessionStorage, 'mf_showcase_pending_download');
      safeRemoveItem(sessionStorage, 'mf_showcase_pending_download_group');
      safeRemoveItem(sessionStorage, 'mf_payment_just_completed');
      skipExitWarningRef.current = true;
      setPostPaymentStage('delivery');
    }
    if (params.get('download_error') === 'insufficient_credits') { params.delete('download_error'); window.history.replaceState({}, '', params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname); setActiveModal('download_unlock'); }
  }, []);

  // ── Auth State ─────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session) fetch('/api/credits').then(r => r.json()).then(data => { if (typeof data.isSubscribed === 'boolean') setIsSubscribed(data.isSubscribed); }).catch(() => { });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      // [DISABLED 2026-05-16 — no-login pivot]
      // 旧的 SIGNED_IN 自动续跑分支：登录回来后翻掉付费墙、直接调用 handleEnhance。
      // 现在没有登录，但 supabase-js 在 stale session / token refresh 时仍可能触发
      // SIGNED_IN，把 isGuestEnhanced 翻成 false，导致付费墙秒消失 → 看到
      // "Generating your photo" 卡住的 bug。一次性买卖流程下整段无意义，先停用。
      // 未来恢复登录时，把整段注释解开，并把外层 useEffect 的 deps 改回
      // [preview, analysisJSON, visibleText] 即可（handleEnhance 闭包需要它们）。
      // if (event === 'SIGNED_IN' && session) {
      //   setIsGuestEnhanced(false); trackEvent('guest_signin_after_enhance');
      //   const hasPending = safeGetItem(sessionStorage, 'mf_pending_enhance') === 'true' || safeGetItem(localStorage, 'mf_pending_enhance') === 'true';
      //   safeRemoveItem(localStorage, 'mf_pending_enhance'); safeRemoveItem(localStorage, 'mf_guest_enhanced'); safeRemoveItem(localStorage, 'mf_preview'); safeRemoveItem(localStorage, 'mf_analysisJSON'); safeRemoveItem(localStorage, 'mf_visibleText');
      //   if (hasPending) { safeRemoveItem(sessionStorage, 'mf_pending_enhance'); handleEnhance(safeGetItem(sessionStorage, 'mf_analysisJSON') || analysisJSON, (safeGetItem(sessionStorage, 'mf_visibleText') || visibleText) ?? undefined); }
      //   dispatchCreditsUpdate();
      // }
    });
    return () => subscription.unsubscribe();
    // [no-login pivot] deps 从 [preview, analysisJSON, visibleText] 改成 []：
    // 上面的 SIGNED_IN 分支停用后不再需要闭包里的最新值，订阅一次即可，
    // 避免每次分析状态变化都重订阅 listener。
  }, []);

  // [DISABLED 2026-05-16 — no-login pivot]
  // 旧的 One-Tap auto-resume：登录态恢复后自动跑 handleEnhance。
  // 一次性买卖流程下不会进入这条路径（autoResumeFromOneTapRef 不会被置 true），
  // 但留着会让代码读起来误导，且未来登录回归时容易和新付费墙互踩，先停用。
  // 未来恢复登录时整段注释解开即可。
  // useEffect(() => {
  //   if (!autoResumeFromOneTapRef.current) return;
  //   if (!preview || !analysisJSON) return;
  //   autoResumeFromOneTapRef.current = false;
  //   toast({
  //     title: 'Welcome back',
  //     description: 'Generating your enhanced photo...',
  //   });
  //   trackEvent('one_tap_auto_resume_enhance');
  //   handleEnhance(analysisJSON, visibleText);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [preview, analysisJSON, visibleText]);

  // ── [post-pay 2026-05-18] paidVariants 到达后给 GenerationProgress
  // 500ms 窗口走完 90→100% 收尾，再切到 DeliveryScreen，避免进度条还在 90%
  // 就被卸掉，给用户"动画半截被中断"的感觉。
  const [deliveryReadyToShow, setDeliveryReadyToShow] = useState(false);
  useEffect(() => {
    if (!paidVariants) {
      setDeliveryReadyToShow(false);
      return;
    }
    const t = setTimeout(() => setDeliveryReadyToShow(true), 500);
    return () => clearTimeout(t);
  }, [paidVariants]);

  // ── [pre-pay analyzing 2026-05-18] 进度条 ticker ─────────────────
  // scanner stream 实际耗时 ~5-10s。progress 用 setInterval 推 0→95（每 250ms
  // +4%），stream onFinish 后 isGuestEnhanced 翻 true → 本 effect 看到就拉满
  // 100 并清零 analyzingActive（让 AnalyzingFlow 退场给 PaywallView）。
  useEffect(() => {
    if (!analyzingActive) return;
    if (isGuestEnhanced) {
      // stream 已完成 → 收尾：拉满进度，短暂停顿后切付费墙
      setAnalyzingProgress(100);
      const t = setTimeout(() => setAnalyzingActive(false), 450);
      return () => clearTimeout(t);
    }
    const id = setInterval(() => {
      setAnalyzingProgress((p) => {
        // 没收到 onFinish 之前最多走到 95，避免视觉走完了 stream 还没好
        if (p >= 95) return 95;
        return Math.min(95, p + 4);
      });
    }, 250);
    return () => clearInterval(id);
  }, [analyzingActive, isGuestEnhanced]);

  // ── [no-login pivot 2026-05-17] 付费回跳后轮询真实交付图 ─────────────
  // [multi-photo 2026-05-18] 加 failed 状态识别 + 重试机制（pollNonce 触发重跑）
  // 总流程：reveal → trivia (轮询中) → delivery (拿到真图)
  //   - done: 设 paidVariants → 进入 delivery
  //   - failed: 设 paymentEnhanceFailed → 展示重试按钮
  //   - timeout(60s): toast 提示，停止轮询
  useEffect(() => {
    if (!postPaymentStage || !scanId) return;
    if (paidVariants) return; // 已经拿到结果
    if (paymentEnhanceFailed) return; // 失败态等用户点重试
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 30;
    const POLL_INTERVAL_MS = 2000;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch(`/api/scan-result/${scanId}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'done' && Array.isArray(data.variants) && data.variants.length > 0) {
            setPaidVariants(data.variants);
            trackEvent('post_payment_variants_ready', { count: data.variants.length });
            return;
          }
          if (data.status === 'failed') {
            setPaymentEnhanceFailed(true);
            trackEvent('post_payment_enhance_failed', { attempts: data.attempts ?? 0 });
            return;
          }
        }
      } catch (err) {
        console.warn('[scan-result] poll error:', err);
      }
      if (attempts >= MAX_ATTEMPTS) {
        toast({
          title: tToast.stillWorkingTitle,
          description: tToast.stillWorkingDesc,
        });
        trackEvent('post_payment_poll_timeout');
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
    return () => { cancelled = true; };
  }, [postPaymentStage, scanId, paidVariants, paymentEnhanceFailed, pollNonce]);

  // [multi-photo 2026-05-18] 用户点 "Retry generation" → 清后端锁 + 重启轮询
  const handleRetryEnhance = useCallback(async () => {
    if (!scanId || isRetryingEnhance) return;
    setIsRetryingEnhance(true);
    trackEvent('post_payment_retry_click');
    try {
      const res = await fetch(`/api/scan-result/${scanId}/retry`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'RETRY_LIMIT') {
          toast({
            title: tToast.tooManyRetriesTitle,
            description: tToast.tooManyRetriesDesc,
            variant: 'destructive',
          });
          trackEvent('post_payment_retry_blocked', { reason: 'limit' });
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setPaymentEnhanceFailed(false);
      setPollNonce((n) => n + 1); // 重启轮询 effect
    } catch (err) {
      console.error('[retry] failed:', err);
      toast({
        title: tToast.retryFailedTitle,
        description: tToast.retryFailedDesc,
        variant: 'destructive',
      });
    } finally {
      setIsRetryingEnhance(false);
    }
  }, [scanId, isRetryingEnhance]);

  // ── 三重拦截 ───────────────────────────────────────────────
  useEffect(() => { if (!hasActiveResult || isFacebookWebView()) return; const h = (e: BeforeUnloadEvent) => { if (!skipExitWarningRef.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [hasActiveResult]);
  useEffect(() => { if (!hasActiveResult || isFacebookWebView()) return; window.history.pushState({ matchfixGuard: true }, ''); const h = () => { if (!skipExitWarningRef.current) { window.history.pushState({ matchfixGuard: true }, ''); pendingNavigationRef.current = '__back__'; setActiveModal('privacy_exit'); } }; window.addEventListener('popstate', h); return () => window.removeEventListener('popstate', h); }, [hasActiveResult]);
  useEffect(() => { if (!hasActiveResult || isFacebookWebView()) return; const h = (e: MouseEvent) => { if (skipExitWarningRef.current) return; const a = (e.target as HTMLElement).closest('a'); if (!a) return; const href = a.getAttribute('href'); if (!href) return; if (!(a.origin === window.location.origin || href.startsWith('/') || href.startsWith('#'))) return; if (href === pathname || href === '#') return; e.preventDefault(); e.stopPropagation(); pendingNavigationRef.current = href; setActiveModal('privacy_exit'); }; document.addEventListener('click', h, true); return () => document.removeEventListener('click', h, true); }, [hasActiveResult, pathname]);

  useEffect(() => {
    if (isCompact) {
      const hero = document.getElementById('scanner-hero');
      if (hero) hero.style.display = 'none';
    }
  }, [isCompact]);

  // ── Reset ──────────────────────────────────────────────────
  // Switch which variant is currently shown. Updates derived display +
  // download state so the existing slider / lightbox / download paths
  // pick up the new variant without further changes.
  const selectVariant = useCallback(async (idx: number) => {
    if (!variants || idx < 0 || idx >= variants.length) return;
    const v = variants[idx];
    setSelectedVariantIndex(idx);
    setEnhancementId(v.enhancementId);
    setEnhancedMimeType(v.mimeType ?? 'image/png');
    safeSetItem(sessionStorage, 'mf_enhancementId', v.enhancementId);
    safeSetItem(sessionStorage, 'mf_enhancedMimeType', v.mimeType ?? 'image/png');
    trackEvent('variant_selected', { variantIndex: idx, matchedScene: v.matchedScene });

    // Image present → swap immediately. Empty image means iOS Safari quota
    // dropped the per-variant blob on a previous restore; fetch it back from
    // /api/download?watermarked=1 and cache for next click.
    if (v.image) {
      setWatermarkedImage(v.image);
      safeSetItem(sessionStorage, 'mf_watermarkedImage', v.image);
      return;
    }
    try {
      const res = await fetch(`/api/download/${v.enhancementId}?watermarked=1`);
      if (!res.ok) return;
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (!base64) return;
      setVariants(prev => {
        if (!prev) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], image: base64 };
        return next;
      });
      setWatermarkedImage(base64);
      safeSetItem(sessionStorage, 'mf_watermarkedImage', base64);
      safeSetItem(sessionStorage, `mf_variant_image_${idx}`, base64);
    } catch { /* leave previous image visible */ }
  }, [variants]);

  const handleReset = useCallback(() => {
    setPreview(null); setAltPhotos([]); setHasStartedAnalysis(false); setWatermarkedImage(null); setEnhancementId(null); setIsGuestEnhanced(false); setIsFreeGeneration(false); setIsDownloadFree(false); setEnhanceError(null); setSliderIndex(0); setVisibleText(''); setAnalysisJSON(null); setSelectedPanel('original'); setLightboxOpen(false); setLightboxIndex(0);
    // [multi-photo 2026-05-18] 清掉付费流程的轮询/失败状态
    setPaidVariants(null); setPaymentEnhanceFailed(false); setIsUnlocking(false);
    // [pre-pay analyzing 2026-05-18] 清掉分析等待状态
    setAnalyzingActive(false); setAnalyzingProgress(0);
    setVariants(null); setSelectedVariantIndex(0); setScanId(null);
    // [v9.2] clear auto-start states
    setAutoStartChecking(false); setShowCreditConfirm(false);
    // [v9.3] clear showcase state
    setShowResultShowcase(false); setShowcaseSlideIndex(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
    ['mf_preview', 'mf_visibleText', 'mf_analysisJSON', 'mf_scene_tags', 'mf_scan_id', 'mf_variants', 'mf_variants_meta', 'mf_pending_enhance', 'mf_watermarkedImage', 'mf_enhancementId', 'mf_enhancedMimeType', 'mf_isFreeGeneration', 'mf_isDownloadFree', 'mf_payment_just_completed', 'mf_showcase_pending_download'].forEach(k => safeRemoveItem(sessionStorage, k));
    for (let i = 0; i < 4; i++) safeRemoveItem(sessionStorage, `mf_variant_image_${i}`);
    ['mf_pending_enhance', 'mf_guest_enhanced', 'mf_preview', 'mf_analysisJSON', 'mf_visibleText'].forEach(k => safeRemoveItem(localStorage, k));
    trackEvent('boost_image_reset');
    const hero = document.getElementById('scanner-hero');
    if (hero) hero.style.display = '';
  }, []);

  // ── Retry helpers (用 ref 避免闭包陷阱) ─────────────────────
  const handleSubmitRef = useRef<() => void>(() => { });

  const handleRetryCancelAndReset = useCallback(() => {
    setActiveModal(null);
    setRetryCountdown(0);
    setRetryAttempt(0);
    if (retryTimerRef.current) { clearInterval(retryTimerRef.current); retryTimerRef.current = null; }
  }, []);

  const handleRetrySubmit = useCallback(() => {
    setActiveModal(null);
    setRetryCountdown(0);
    if (retryTimerRef.current) { clearInterval(retryTimerRef.current); retryTimerRef.current = null; }
    setTimeout(() => handleSubmitRef.current(), 0);
  }, []);

  const startRetryCountdown = useCallback((seconds: number) => {
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    setRetryCountdown(seconds);

    retryTimerRef.current = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          if (retryTimerRef.current) clearInterval(retryTimerRef.current);
          retryTimerRef.current = null;
          setTimeout(() => handleSubmitRef.current(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 清理计时器
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    };
  }, []);

  const handlePrivacyExitConfirm = useCallback(() => { const t = pendingNavigationRef.current; skipExitWarningRef.current = true; setActiveModal(null); handleReset(); if (t === '__back__') window.history.back(); else if (t) router.push(t); setTimeout(() => { skipExitWarningRef.current = false; pendingNavigationRef.current = null; }, 200); }, [handleReset, router]);
  const handlePrivacyExitCancel = useCallback(() => { setActiveModal(null); pendingNavigationRef.current = null; }, []);
  const handleTryAnother = useCallback(() => { pendingNavigationRef.current = null; setActiveModal('privacy_exit'); }, []);
  const handleTryAnotherConfirm = useCallback(() => { setActiveModal(null); handleReset(); skipExitWarningRef.current = false; pendingNavigationRef.current = null; }, [handleReset]);

  // ── Enhance ────────────────────────────────────────────────
  const handleEnhance = async (jsonFromFinish?: string | null, textFromFinish?: string) => {
    if (!preview) return;
    // getSession() reads from local storage (no network), so it's resilient to transient
    // fetch failures. Server-side /api/enhance-photo will re-validate via getUser() and
    // return LOGIN_REQUIRED if the session is actually invalid.
    const supabase = createClient(); const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsGuestEnhanced(true); setSliderIndex(1); setSelectedPanel('enhanced'); safeSetItem(sessionStorage, 'mf_pending_enhance', 'true'); safeSetItem(localStorage, 'mf_pending_enhance', 'true'); safeSetItem(localStorage, 'mf_guest_enhanced', 'true'); if (preview) safeSetItem(localStorage, 'mf_preview', preview); if (analysisJSON) safeSetItem(localStorage, 'mf_analysisJSON', analysisJSON); if (visibleText) safeSetItem(localStorage, 'mf_visibleText', visibleText); return; }
    setIsEnhancing(true); setEnhanceError(null); trackEvent('enhance_start_click');
    try {
      // Prefer scan_id when available (server-side state). Fall back to
      // legacy imageBase64 + analysisResult so older sessions still work.
      const currentScanId = scanId ?? safeGetItem(sessionStorage, 'mf_scan_id');
      const res = await fetch('/api/enhance-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(currentScanId
            ? { scanId: currentScanId }
            : {
                imageBase64: preview.split(',')[1],
                mimeType: 'image/jpeg',
                analysisResult: jsonFromFinish ?? analysisJSON ?? textFromFinish ?? visibleText ?? '',
              }),
          useFusion,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS') { setActiveModal('enhance'); return; }

        // Route transient upstream failures (overload / timeout / no-image-retryable)
        // to ai_busy with auto-countdown; only true content issues (SAFETY_BLOCKED /
        // generic INTERNAL_ERROR) keep the "try a clearer portrait" modal.
        const msg = data.error || 'Unknown error';
        const isRetryable =
          data.retryable === true ||
          data.code === 'UPSTREAM_OVERLOADED' ||
          data.code === 'UPSTREAM_TIMEOUT' ||
          data.code === 'MODEL_OVERLOADED';

        if (isRetryable) {
          setSliderIndex(0);
          setSelectedPanel('original');
          setIsGuestEnhanced(false);
          setRetryAttempt(prev => prev + 1);
          setActiveModal('ai_busy');
          startRetryCountdown(10);
          trackEvent('enhance_failed', { reason: 'ai_overloaded', code: data.code, attempt: retryAttempt });
          return;
        }

        setEnhanceError(msg);
        setSliderIndex(0);
        setSelectedPanel('original');
        setIsGuestEnhanced(false);
        setActiveModal('enhance_failed');
        trackEvent('enhance_failed', { reason: msg, code: data.code });
        return;
      }
      // New shape: data.variants is an array (length 1 for retouch, up to 3 for
      // fusion). For backward compat the API also exposes the first variant at
      // top level — we still consume that, but persist the full array so the
      // 3-variant gallery can render.
      const variantsFromServer: VariantData[] | undefined = Array.isArray(data.variants) ? data.variants : undefined;
      setVariants(variantsFromServer ?? null);
      setSelectedVariantIndex(0);

      setWatermarkedImage(data.watermarkedImage); setEnhancementId(data.enhancementId); setEnhancedMimeType(data.mimeType ?? 'image/png'); setIsFreeGeneration(data.isFreeTrial); setIsDownloadFree(data.downloadFree ?? false);
      safeSetItem(sessionStorage, 'mf_watermarkedImage', data.watermarkedImage); safeSetItem(sessionStorage, 'mf_enhancementId', data.enhancementId); safeSetItem(sessionStorage, 'mf_enhancedMimeType', data.mimeType ?? 'image/png'); safeSetItem(sessionStorage, 'mf_isFreeGeneration', String(data.isFreeTrial)); safeSetItem(sessionStorage, 'mf_isDownloadFree', String(data.downloadFree ?? false));
      if (variantsFromServer) {
        // Persist a lightweight meta blob unconditionally (small, always fits)
        // so chips can re-render after reload even when iOS Safari drops the
        // larger image payload due to ~5MB sessionStorage quota.
        const meta = variantsFromServer.map(v => ({
          enhancementId: v.enhancementId,
          mimeType: v.mimeType,
          matchedScene: v.matchedScene,
          variantIndex: v.variantIndex,
        }));
        safeSetItem(sessionStorage, 'mf_variants_meta', JSON.stringify(meta));
        // Per-variant image keys — independent writes so partial success still
        // restores some images. Each ~500KB; the selected one is also mirrored
        // in mf_watermarkedImage as a fallback during restore.
        variantsFromServer.forEach((v, i) => {
          safeSetItem(sessionStorage, `mf_variant_image_${i}`, v.image);
        });
        // Best-effort full blob (kept for legacy paths; harmless if it fails).
        safeSetItem(sessionStorage, 'mf_variants', JSON.stringify(variantsFromServer));
      } else {
        safeRemoveItem(sessionStorage, 'mf_variants');
        safeRemoveItem(sessionStorage, 'mf_variants_meta');
        for (let i = 0; i < 4; i++) safeRemoveItem(sessionStorage, `mf_variant_image_${i}`);
      }
      setIsGuestEnhanced(false); setSliderIndex(1); setSelectedPanel('enhanced'); dispatchCreditsUpdate(); router.refresh(); trackEvent('enhance_complete', { status: 'success' });
      // [v9.3] Auto-pop Result Showcase Modal
      setShowcaseSlideIndex(1);
      setShowResultShowcase(true);
      trackEvent('result_showcase_shown');
    } catch {
      setEnhanceError(tToast.networkErrorMsg);
      setSliderIndex(0);
      setSelectedPanel('original');
      setIsGuestEnhanced(false);
      setActiveModal('enhance_failed');
      trackEvent('enhance_failed', { reason: 'network_error' });
    } finally { setIsEnhancing(false); }
  };

  // ── Scanner Stream ─────────────────────────────────────────
  const { complete, completion, isLoading } = useCompletion({
    api: '/api/scanner',
    fetch: async (url, init) => {
      const res = await fetch(url, init);
      const tagsHeader = res.headers.get('x-scene-tags');
      if (tagsHeader) {
        safeSetItem(sessionStorage, 'mf_scene_tags', tagsHeader);
        setSceneTags(tagsHeader);
      }
      const scanIdHeader = res.headers.get('x-scan-id');
      if (scanIdHeader) {
        safeSetItem(sessionStorage, 'mf_scan_id', scanIdHeader);
        setScanId(scanIdHeader);
      }
      return res;
    },
    onFinish: (_prompt, fullCompletion) => {
      const { visibleText: text, analysisJSON: json } = parseAnalysisStream(fullCompletion);
    
      // [fusion] 合并 scene_tags 进 analysisJSON
      let mergedJson = json;
      const tagsStr = safeGetItem(sessionStorage, 'mf_scene_tags');
      if (tagsStr && json) {
        try {
          const parsed = JSON.parse(json);
          parsed.scene_tags = JSON.parse(tagsStr);
          mergedJson = JSON.stringify(parsed);
        } catch { /* ignore */ }
      }
    
      setVisibleText(text);
      setAnalysisJSON(mergedJson);
      safeSetItem(sessionStorage, 'mf_visibleText', text);
      if (mergedJson) safeSetItem(sessionStorage, 'mf_analysisJSON', mergedJson);
    
      trackEvent('boost_complete', { status: 'success' });
      fetch('/api/meta-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: `lead_${Date.now()}` }) }).catch(err => console.error('[Meta CAPI] Lead event failed:', err));
      dispatchCreditsUpdate(); router.refresh();
    
      try {
        const parsed = json ? JSON.parse(json) : null;
        if (parsed?.route === 'needs_real_photo') {
          trackEvent('boost_blocked_unusable_photo');
          // [pre-pay analyzing 2026-05-18] 用户在 AnalyzingFlow 等了一段，发现
          // 是 needs_real_photo —— handleReset 会把 analyzingActive 也清零。
          handleReset();
          toast({
            title: tToast.needRealPhotoTitle,
            description: tToast.needRealPhotoDesc,
          });
          return;
        }
      } catch { /* ignore */ }

      // [pre-pay analyzing 2026-05-18] 分析正常结束 → 拉满进度条然后进付费墙
      // 进度条结尾的 100% 由 effect 监听 isLoading→false 来拉，这里只触发 paywall
      setIsGuestEnhanced(true);
      trackEvent('paywall_enter_after_analyze');
      void mergedJson; void text;
    },
    // ...
    onError: (error) => {
      try {
        const d = JSON.parse(error.message);

        // Credits 不足 → 走原来的逻辑
        if (d.code === 'INSUFFICIENT_CREDITS' || (d.error && d.error.includes('Insufficient credits'))) {
          trackEvent('boost_failed', { reason: 'insufficient_credits' });
          setActiveModal('enhance');
          return;
        }

        // AI 过载 / 可重试 → 显示友好弹窗并自动倒计时
        if (d.code === 'MODEL_OVERLOADED' || d.retryable) {
          trackEvent('boost_failed', { reason: 'ai_overloaded', attempt: retryAttempt });
          setRetryAttempt(prev => prev + 1);
          setActiveModal('ai_busy');
          startRetryCountdown(10); // 10 秒倒计时
          return;
        }

        // 其他错误也用友好弹窗
        trackEvent('boost_failed', { reason: d.error || 'unknown' });
        setActiveModal('ai_busy');
        startRetryCountdown(5);
      } catch {
        // JSON 解析失败
        if (error.message.includes('402')) {
          setActiveModal('enhance');
        } else {
          trackEvent('boost_failed', { reason: 'parse_error' });
          setActiveModal('ai_busy');
          startRetryCountdown(5);
        }
      }
    },
  });
  const displayText = isLoading ? parseAnalysisStream(completion).visibleText : visibleText;
  const handleCopy = () => { if (!visibleText) return; navigator.clipboard.writeText(visibleText); setIsCopied(true); trackEvent('boost_copy_result'); setTimeout(() => setIsCopied(false), 2000); };

  // [no-login refactor 2026-05-13] Capture main photo + optional 2nd photo,
  // do NOT auto-submit. User reviews the photos in UploadHero's review tray,
  // then clicks the "Enhance N photos" CTA to trigger handleSubmit.
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const file = files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert(tCommon.onlyBoostImages); return; }
    if (file.size > 10 * 1024 * 1024) { alert(tCommon.fileTooLarge); return; }
    trackEvent('boost_image_selected', { file_size: Math.round(file.size / 1024), count: files?.length ?? 1 });

    // Reset prior alts + compress optional 2nd/3rd files in background.
    setAltPhotos([]);
    const altFiles: File[] = [];
    for (let i = 1; i < (files?.length ?? 0) && altFiles.length < MAX_PHOTOS - 1; i++) {
      const f = files![i];
      if (f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024) altFiles.push(f);
    }
    if (altFiles.length > 0) {
      Promise.all(altFiles.map((f) => compressImage(f, { maxSize: 800, quality: 0.75 })))
        .then((arr) => setAltPhotos(arr))
        .catch(() => {});
    }
    // 先用 blob URL 秒出预览
    const quickPreview = URL.createObjectURL(file);
    setPreview(quickPreview); setWatermarkedImage(null); setEnhancementId(null); setIsGuestEnhanced(false); setIsFreeGeneration(false); setIsDownloadFree(false); setEnhanceError(null); setSliderIndex(0); setSelectedPanel('original');
    setShowCreditConfirm(false); setAutoStartChecking(false);
    const hero = document.getElementById('scanner-hero');
    if (hero) hero.style.display = '';
    // 后台压缩，完成后替换预览并存 session
    const compressed = await compressImage(file, { maxSize: 800, quality: 0.75 });
    URL.revokeObjectURL(quickPreview);
    setPreview(compressed);
    scheduleIdle(() => {
      safeSetItem(sessionStorage, 'mf_preview', compressed); safeRemoveItem(sessionStorage, 'mf_visibleText'); safeRemoveItem(sessionStorage, 'mf_analysisJSON');
    });
    // NB: no auto-submit. User confirms via UploadHero CTA.
  };

  // Add an alt photo from the review tray "+" slot (single-file picker).
  // Appends to altPhotos if there's room (max MAX_PHOTOS-1 alts).
  const handleAltPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert(tCommon.onlyBoostImages); return; }
    if (file.size > 10 * 1024 * 1024) { alert(tCommon.fileTooLarge); return; }
    if (altPhotos.length >= MAX_PHOTOS - 1) return;
    try {
      const compressed = await compressImage(file, { maxSize: 800, quality: 0.75 });
      setAltPhotos((cur) => (cur.length >= MAX_PHOTOS - 1 ? cur : [...cur, compressed]));
      trackEvent('boost_alt_photo_added', { file_size: Math.round(file.size / 1024) });
    } catch {
      // ignore — alt photo is optional
    } finally {
      // Reset the input so the same file can be picked again later if removed
      e.target.value = '';
    }
  };

  // Remove a specific photo by tray index.
  // idx 0 = main (preview). Removing main promotes altPhotos[0] to main.
  // idx 1..MAX_PHOTOS-1 = alt slots. Splice from altPhotos.
  const handleRemovePhoto = (idx: number) => {
    if (idx === 0) {
      const [next, ...rest] = altPhotos;
      if (next) {
        setPreview(next);
        setAltPhotos(rest);
        scheduleIdle(() => safeSetItem(sessionStorage, 'mf_preview', next));
      } else {
        setPreview(null);
        scheduleIdle(() => safeRemoveItem(sessionStorage, 'mf_preview'));
      }
      return;
    }
    const altIdx = idx - 1;
    setAltPhotos((cur) => cur.filter((_, i) => i !== altIdx));
  };

  const handleSubmit = async () => {
    if (!preview || isLoading) return;
    // Guard: preview can briefly be a blob URL while compressImage finishes.
    // Without this, complete() would send imageBase64=undefined and the
    // analyze view would flash back to "no analysis" state, looking stuck.
    if (!preview.startsWith('data:')) {
      toast({ title: tToast.stillProcessingTitle, description: tToast.stillProcessingDesc });
      return;
    }
    // [no-login refactor 2026-05-13] 一次性买卖：分析免费且无 FREE_LIMIT 限流，
    // 不再做任何登录/积分/次数校验。所有门控都搬到付费墙。
    setHasStartedAnalysis(true);
    // [v9.2] clear credit confirm bar
    setShowCreditConfirm(false); setAutoStartChecking(false);
    setActiveModal(null); setVisibleText(''); setAnalysisJSON(null); setWatermarkedImage(null); setEnhancementId(null); setIsFreeGeneration(false); setIsDownloadFree(false); setEnhanceError(null); setSliderIndex(0); setSelectedPanel('original');
    safeRemoveItem(sessionStorage, 'mf_visibleText'); safeRemoveItem(sessionStorage, 'mf_analysisJSON'); trackEvent('boost_start_click');
    // [pre-pay analyzing 2026-05-18] 不再瞬间打开付费墙，先进 AnalyzingFlow
    // 的「假分析」等待屏。scanner stream 跑完 onFinish 里再把 isGuestEnhanced
    // 翻成 true → 付费墙登场。这一步给用户更强的"AI 正在工作"锚定，提升付费墙
    // 到价时的转化感受。needs_real_photo 边缘 case 仍在 onFinish 里走 handleReset。
    setAnalyzingActive(true);
    setAnalyzingProgress(0);
    trackEvent('analyzing_start', { photo_count: 1 + altPhotos.length });
    // [multi-photo 2026-05-18] 把 1-3 张全部传上去，scanner 会落到
    // photo_scans.original_storage_keys 数组。imageBase64 (主图) 字段保留兼容性。
    const stripDataPrefix = (s: string) => s.includes(',') ? s.split(',')[1] : s;
    const mainB64 = stripDataPrefix(preview);
    const altB64s = altPhotos.map(stripDataPrefix).filter(Boolean);
    void complete('', {
      body: {
        imageBase64: mainB64,
        imageBase64s: [mainB64, ...altB64s],
        mimeType: 'image/jpeg',
      },
    });
  };
  handleSubmitRef.current = handleSubmit;  // ← 加这一行

  // ── Download ───────────────────────────────────────────────
  // Resolve the list of enhancementIds the current download action should
  // fetch. Fusion mode → all 3 variants in the group; otherwise → just the
  // currently selected one. The download API treats the 5-credit fee as a
  // group-level unlock, so triggering all 3 only charges once.
  const getDownloadIds = useCallback((): string[] => {
    if (variants && variants.length > 0) {
      return variants.map(v => v.enhancementId);
    }
    return enhancementId ? [enhancementId] : [];
  }, [variants, enhancementId]);

  // Trigger downloads for one or more enhancementIds. Uses anchor click +
  // small stagger so the browser doesn't block subsequent downloads as
  // a popup.
  const triggerGroupDownloads = useCallback((ids: string[], opts?: { watermarked?: boolean }) => {
    const suffix = opts?.watermarked ? '?watermarked=1' : '';
    skipExitWarningRef.current = true;
    const lastIdx = ids.length - 1;
    ids.forEach((id, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = `/api/download/${id}${suffix}`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (idx === lastIdx) {
          setTimeout(() => { skipExitWarningRef.current = false; }, 200);
        }
      }, idx * 250);
    });
    dispatchCreditsUpdate();
  }, []);

  const handleDownload = () => {
    const ids = getDownloadIds();
    if (ids.length === 0) return;
    trackEvent('enhance_download_click', { isDownloadFree, isFreeGeneration, count: ids.length });
    // [v9 fix] 刚支付完回来，直接下载，不弹窗
    const justPaid = safeGetItem(sessionStorage, 'mf_payment_just_completed') === 'true';
    if (justPaid) {
      safeRemoveItem(sessionStorage, 'mf_payment_just_completed');
      triggerGroupDownloads(ids);
      return;
    }
    if (isFreeGeneration && !isDownloadFree) handleDownloadWithPrecheck();
    else triggerGroupDownloads(ids);
  };
  // [v9] insufficient credits → download_unlock instead of credits_shop
  const handleDownloadWithPrecheck = async () => {
    const ids = getDownloadIds();
    if (ids.length === 0) return;
    setIsDownloading(true);
    try {
      const cr = await fetch('/api/credits');
      if (cr.ok) {
        const cd = await cr.json();
        const s = createClient();
        const { data: { user } } = await s.auth.getUser();
        if (user && cd.isSubscribed) {
          triggerGroupDownloads(ids);
          trackEvent('enhance_download_precheck_ok', { count: ids.length });
          router.refresh();
          return;
        }
        if (user && cd.credits >= 5) {
          setActiveModal('download_choice');
          return;
        }
      }
      // [v9] not enough credits → download_unlock (was credits_shop)
      setActiveModal('download_unlock');
    } catch {
      setActiveModal('download_unlock');
    } finally {
      setIsDownloading(false);
    }
  };
  const handleDownloadWatermarked = () => {
    if (!watermarkedImage) return;
    const ids = getDownloadIds();
    if (ids.length > 0) {
      triggerGroupDownloads(ids, { watermarked: true });
    } else {
      const l = document.createElement('a');
      l.href = `data:${enhancedMimeType};base64,${watermarkedImage}`;
      l.download = 'matchfix-enhanced-watermark.png';
      l.click();
    }
    setActiveModal(null);
    trackEvent('enhance_download_watermark_free', { count: ids.length });
  };
  const handleDownloadWithCredits = async () => {
    const ids = getDownloadIds();
    if (ids.length === 0) return;
    setIsDownloading(true);
    try {
      const cr = await fetch('/api/credits');
      if (cr.ok) {
        const cd = await cr.json();
        if (!cd.isSubscribed && cd.credits < 5) {
          setActiveModal('download_unlock');
          setIsDownloading(false);
          return;
        }
      } else {
        setActiveModal('download_unlock');
        setIsDownloading(false);
        return;
      }
      setActiveModal(null);
      triggerGroupDownloads(ids);
      trackEvent('enhance_download_credits_success', { count: ids.length });
      router.refresh();
    } catch {
      setActiveModal('download_unlock');
    } finally {
      setIsDownloading(false);
    }
  };

  // [v9.3] Showcase download — close showcase then trigger normal download
  const handleShowcaseDownload = () => {
    setShowResultShowcase(false);
    trackEvent('result_showcase_download_click');
    // Small delay to let modal close, then trigger normal download flow
    setTimeout(() => handleDownload(), 100);
  };
  // [v9.4] Direct download for Pro / already-paid users — no pricing UI
  const handleShowcaseDirectDownload = () => {
    const ids = getDownloadIds();
    if (ids.length === 0) return;
    setShowResultShowcase(false);
    trackEvent('result_showcase_direct_download', { count: ids.length });
    setTimeout(() => triggerGroupDownloads(ids), 100);
  };

  // ─── Showcase modal slide model ───────────────────────────────
  // The showcase modal shows: original photo + each variant. The user can
  // swipe between them; "Download" targets whichever slide they're on.
  type ShowcaseSlide = {
    type: 'original' | 'variant';
    src: string;
    label: string;
    enhancementId: string | null;
  };
  const showcaseSlides = useMemo<ShowcaseSlide[]>(() => {
    const slides: ShowcaseSlide[] = [];
    if (preview) {
      slides.push({ type: 'original', src: preview, label: 'Original', enhancementId: null });
    }
    if (variants && variants.length > 0) {
      const showLabel = variants.length > 1;
      variants.forEach((v, i) => {
        slides.push({
          type: 'variant',
          src: `data:${v.mimeType ?? 'image/png'};base64,${v.image}`,
          label: showLabel ? `✨ Look ${i + 1}` : '✨ AI Enhanced',
          enhancementId: v.enhancementId,
        });
      });
    } else if (watermarkedImage) {
      // Legacy single-variant fallback
      slides.push({
        type: 'variant',
        src: `data:${enhancedMimeType};base64,${watermarkedImage}`,
        label: '✨ AI Enhanced',
        enhancementId,
      });
    }
    return slides;
  }, [preview, variants, watermarkedImage, enhancedMimeType, enhancementId]);

  const showcaseCurrentSlide = showcaseSlides[showcaseSlideIndex] ?? null;

  // True when the analysis itself returned a non-actionable verdict
  // (e.g. AI-generated photo, can't be enhanced). Used to surface a
  // "Try Another Photo" CTA only on these dead-ends — on the happy path
  // the button is just clutter that interrupts the flow.
  const analysisFailed = useMemo(() => {
    if (!analysisJSON) return false;
    try {
      const parsed = JSON.parse(analysisJSON);
      return parsed?.route === 'needs_real_photo';
    } catch { return false; }
  }, [analysisJSON]);

  // Download whichever slide the user is currently viewing in the showcase.
  const handleShowcaseDownloadCurrent = useCallback(() => {
    if (!showcaseCurrentSlide) return;
    setShowResultShowcase(false);
    trackEvent('result_showcase_download_current', {
      slideIndex: showcaseSlideIndex,
      type: showcaseCurrentSlide.type,
    });
    setTimeout(() => {
      if (showcaseCurrentSlide.type === 'original') {
        const a = document.createElement('a');
        a.href = showcaseCurrentSlide.src;
        a.download = 'matchfix-original.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else if (showcaseCurrentSlide.enhancementId) {
        triggerGroupDownloads([showcaseCurrentSlide.enhancementId]);
      }
    }, 100);
  }, [showcaseCurrentSlide, showcaseSlideIndex, triggerGroupDownloads]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => { if (touchStartX.current === null || touchEndX.current === null) return; const diff = touchStartX.current - touchEndX.current; if (Math.abs(diff) > 40) { if (diff > 0 && sliderIndex < 1) { setSliderIndex(1); setSelectedPanel('enhanced'); } if (diff < 0 && sliderIndex > 0) { setSliderIndex(0); setSelectedPanel('original'); } } touchStartX.current = null; touchEndX.current = null; };
  const selectOriginal = () => { setSelectedPanel('original'); setSliderIndex(0); };
  const selectEnhanced = () => { setSelectedPanel('enhanced'); setSliderIndex(1); };

  const isOriginalSelected = selectedPanel === 'original';
  const downloadButtonText = isDownloadFree ? tCommon.downloadEnhanced : isFreeGeneration ? tCommon.downloadPhoto : tCommon.downloadEnhanced;
  // [v9.2] Preview area: always capped height. Before analysis: max-h to keep buttons visible.
  // After analysis (isCompact): smaller max-h. During initial display without results: also capped.
  const imgHeightClass = isCompact
    ? 'max-h-[240px] md:max-h-[280px]'
    : 'max-h-[300px] md:max-h-[360px]';

  // ── Lightbox ───────────────────────────────────────────────
  const openLightbox = (src: string) => {
    if (isGuestEnhanced) return;
    const idx = lightboxImages.findIndex(img => img.src === src);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxComparePos(50);
    setLightboxOpen(true);
  };
  const closeLightbox = () => { setLightboxOpen(false); };
  const lightboxPrev = () => { if (lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1); };
  const lightboxNext = () => { if (lightboxIndex < lightboxImages.length - 1) setLightboxIndex(lightboxIndex + 1); };
  const handleLightboxTouchStart = (e: React.TouchEvent) => { lightboxTouchStartX.current = e.touches[0].clientX; };
  const handleLightboxTouchMove = (e: React.TouchEvent) => { lightboxTouchEndX.current = e.touches[0].clientX; };
  const handleLightboxTouchEnd = () => {
    if (lightboxTouchStartX.current === null || lightboxTouchEndX.current === null) return;
    const diff = lightboxTouchStartX.current - lightboxTouchEndX.current;
    if (Math.abs(diff) > 40) { if (diff > 0) lightboxNext(); else lightboxPrev(); }
    lightboxTouchStartX.current = null; lightboxTouchEndX.current = null;
  };

  // Lightbox compare-slider drag handlers
  const updateLightboxComparePos = (clientX: number) => {
    const el = lightboxDragRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setLightboxComparePos(Math.max(0, Math.min(100, pct)));
  };
  const handleCompareMouseDown = (e: React.MouseEvent) => { lightboxDraggingRef.current = true; updateLightboxComparePos(e.clientX); };
  const handleCompareMouseMove = (e: React.MouseEvent) => { if (lightboxDraggingRef.current) updateLightboxComparePos(e.clientX); };
  const handleCompareMouseEnd = () => { lightboxDraggingRef.current = false; };
  const handleCompareTouchStart = (e: React.TouchEvent) => { lightboxDraggingRef.current = true; updateLightboxComparePos(e.touches[0].clientX); };
  const handleCompareTouchMove = (e: React.TouchEvent) => { if (lightboxDraggingRef.current) updateLightboxComparePos(e.touches[0].clientX); };
  const handleCompareTouchEnd = () => { lightboxDraggingRef.current = false; };

  // Shared compare-unlock modal UI — used by both the auto-popup after enhance
  // (showResultShowcase) and the tap-to-fullscreen lightbox compare mode.
  const renderUnlockCompareUI = (onClose: () => void): React.ReactNode => {
    if (!preview || !enhancedSrc || isGuestEnhanced) return null;
    const variantCount = variants?.length ?? 0;
    const groupIds = variants?.map(v => v.enhancementId) ?? (enhancementId ? [enhancementId] : []);
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
        {/* Close + label */}
        <button className="absolute top-4 left-4 z-20 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" onClick={onClose} aria-label={tCommon.close}>
          <X className="size-5" />
        </button>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <span className="text-sm font-bold px-3 py-1 rounded-pill bg-canvas/95 text-ink flex items-center gap-1.5 shadow-ab-card">
            <Sparkles className="size-3.5 text-rausch" /> {tCommon.dragToCompare}
          </span>
        </div>

        {/* Compare image area */}
        <div className="flex-1 flex items-center justify-center w-full px-4 pt-16 pb-2 min-h-0" onClick={(e) => e.stopPropagation()}>
          <div
            ref={lightboxDragRef}
            className="relative select-none touch-none cursor-ew-resize"
            style={{ aspectRatio: '4 / 5', maxHeight: '100%', maxWidth: '92vw', height: '100%' }}
            onMouseDown={handleCompareMouseDown}
            onMouseMove={handleCompareMouseMove}
            onMouseUp={handleCompareMouseEnd}
            onMouseLeave={handleCompareMouseEnd}
            onTouchStart={handleCompareTouchStart}
            onTouchMove={handleCompareTouchMove}
            onTouchEnd={handleCompareTouchEnd}
          >
            {/* AFTER (base layer) */}
            <img src={enhancedSrc} alt={tCommon.aiEnhanced} className="absolute inset-0 w-full h-full object-contain pointer-events-none" draggable={false} />
            {/* BEFORE clipped from the right */}
            <img
              src={preview}
              alt={tCommon.original}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - lightboxComparePos}% 0 0)` }}
              draggable={false}
            />

            {/* BEFORE / AFTER labels */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-pill text-[11px] font-bold bg-black/60 text-white backdrop-blur-md pointer-events-none">{tCommon.before}</div>
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-pill text-[11px] font-bold bg-rausch text-white flex items-center gap-1 pointer-events-none">
              <Sparkles className="size-3" /> {tCommon.after}
            </div>

            {/* Drag handle */}
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `calc(${lightboxComparePos}% - 1.5px)`, width: 3, background: '#fff', boxShadow: '0 0 16px rgba(0,0,0,0.45)' }}>
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-11 rounded-full grid place-items-center bg-canvas shadow-ab-card">
                <div className="flex">
                  <ChevronLeft className="size-3.5 text-ink" />
                  <ChevronRight className="size-3.5 text-ink -ml-1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA panel */}
        <div
          className="shrink-0 px-4 pt-3 pb-5 flex flex-col items-center gap-2.5 relative z-10"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.92) 100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Variant chips */}
          {variants && variantCount > 1 && (
            <div className="flex items-center justify-center gap-2 mb-1">
              {variants.map((v, i) => (
                <button
                  key={v.enhancementId}
                  type="button"
                  onClick={() => selectVariant(i)}
                  className={`px-4 py-1.5 rounded-pill text-[13px] font-semibold border transition-all ${
                    i === selectedVariantIndex
                      ? 'bg-canvas text-ink border-canvas shadow-ab-card'
                      : 'bg-transparent text-white/70 border-white/25 hover:text-white hover:border-white/50'
                  }`}
                  title={v.matchedScene ?? `${tCommon.variant} ${i + 1}`}
                >
                  {tCommon.look} {i + 1}
                </button>
              ))}
            </div>
          )}

          {/* Scarcity (unpaid only) */}
          {!isDownloadFree && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[11px] font-medium" style={{ background: 'rgba(255,170,85,0.16)', color: '#ffb47a' }}>
              {tCommon.scarcityToday}
            </div>
          )}

          {/* Main CTA — Download (paid) or Unlock (unpaid) */}
          {isDownloadFree ? (
            <button
              type="button"
              onClick={() => { onClose(); handleDownload(); }}
              disabled={isDownloading}
              className="w-full max-w-sm h-14 rounded-[12px] font-bold text-[17px] flex items-center justify-center gap-2 bg-rausch hover:bg-rausch-active text-white shadow-ab-card active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {isDownloading ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
              <span>{downloadButtonText}</span>
            </button>
          ) : (
            <div className="w-full max-w-sm">
              <ShowcaseMicroPackButton
                returnPath={pathname}
                enhancementId={enhancementId}
                groupIds={groupIds}
              />
            </div>
          )}

          {/* Trust row (unpaid only) */}
          {!isDownloadFree && (
            <div className="flex items-center justify-center gap-2.5 text-[10px] text-white/60 flex-wrap max-w-sm">
              <span className="flex items-center gap-1"><ShieldCheck className="size-3" /> {tCommon.refund30}</span>
              <span className="text-white/40">·</span>
              <span className="flex items-center gap-1"><Lock className="size-3" /> {tCommon.securedCheckout}</span>
              <span className="text-white/40">·</span>
              <span>{tCommon.instantDownload}</span>
            </div>
          )}

          {/* Maybe later / Close */}
          <button type="button" onClick={onClose} className="text-[12px] text-white/55 hover:text-white/85 transition-colors py-1">
            {isDownloadFree ? tCommon.close : tCommon.maybeLater}
          </button>
        </div>
      </div>
    );
  };

  // [v9.3] Showcase touch handlers
  const handleShowcaseTouchStart = (e: React.TouchEvent) => { showcaseTouchStartX.current = e.touches[0].clientX; };
  const handleShowcaseTouchMove = (e: React.TouchEvent) => { showcaseTouchEndX.current = e.touches[0].clientX; };
  const handleShowcaseTouchEnd = () => {
    if (showcaseTouchStartX.current === null || showcaseTouchEndX.current === null) return;
    const diff = showcaseTouchStartX.current - showcaseTouchEndX.current;
    if (Math.abs(diff) > 40) {
      const lastIdx = Math.max(0, showcaseSlides.length - 1);
      if (diff > 0 && showcaseSlideIndex < lastIdx) setShowcaseSlideIndex(showcaseSlideIndex + 1);
      if (diff < 0 && showcaseSlideIndex > 0) setShowcaseSlideIndex(showcaseSlideIndex - 1);
    }
    showcaseTouchStartX.current = null; showcaseTouchEndX.current = null;
  };

  // Overlays
  const ScanningOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-canvas/70 backdrop-blur-md">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-hairline-soft overflow-hidden">
        <div className="h-full w-1/3 bg-rausch rounded-full" style={{ animation: 'progressIndeterminate 1.6s ease-in-out infinite' }} />
      </div>
      <div className="grid size-12 place-items-center rounded-full bg-canvas border border-hairline shadow-ab-card">
        <Sparkles className="size-5 text-rausch" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink">{tOverlay.scanningTitle}</p>
        <p className="text-sm text-ink-muted">{tOverlay.scanningSubtitle}</p>
      </div>
    </div>
  );
  const EnhancingOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-canvas/70 backdrop-blur-md">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-hairline-soft overflow-hidden">
        <div className="h-full w-1/3 bg-rausch rounded-full" style={{ animation: 'progressIndeterminate 1.6s ease-in-out infinite' }} />
      </div>
      <div className="grid size-12 place-items-center rounded-full bg-canvas border border-hairline shadow-ab-card">
        <Loader2 className="size-5 text-rausch animate-spin" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink">{tOverlay.enhancingTitle}</p>
        <p className="text-sm text-ink-muted">{tOverlay.enhancingSubtitle}</p>
      </div>
    </div>
  );
  const GuestLockOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-canvas/65 backdrop-blur-md">
      <div className="grid size-12 place-items-center rounded-full bg-canvas border border-hairline shadow-ab-card">
        <Lock className="size-5 text-ink" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink">{tOverlay.guestLockTitle}</p>
        <p className="text-sm text-ink-muted">{tOverlay.guestLockSubtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => openAuthModal('sign-up')}
        className="inline-flex items-center justify-center h-12 px-7 rounded-pill bg-rausch hover:bg-rausch-active text-white font-medium text-base shadow-ab-card transition-colors"
      >
        {tOverlay.viewMyPhoto}
      </button>
    </div>
  );

  return (
    <div className="w-full text-foreground relative">
      <div className="mx-auto flex w-full flex-col gap-4">

        {/* ═══ Initial upload — auto-sweep hero that becomes the upload zone ═══ */}
        {/* Upload + review tray — shown until the user actually clicks Enhance.
            When analysis kicks in (hasStartedAnalysis), AnalyzingFlow takes over,
            then PaywallView. */}
        {!hasStartedAnalysis && !analyzingActive && !isLoading && !isEnhancing && !isGuestEnhanced && !visibleText && !showEnhanced && (
          <UploadHero
            beforeSrc={EXAMPLE_PAIRS[0].before}
            afterSrc={EXAMPLE_PAIRS[0].after}
            fileInputRef={fileInputRef}
            onMainPhotoSelect={handleFileSelect}
            onAltPhotoSelect={handleAltPhotoSelect}
            onRemovePhoto={handleRemovePhoto}
            onClearAll={handleReset}
            onSubmit={handleSubmit}
            photos={[preview, ...altPhotos].filter((p): p is string => !!p)}
            maxPhotos={MAX_PHOTOS}
            useFusion={useFusion}
            setUseFusion={setUseFusion}
          />
        )}

        {/* ═══ PRE-PAY ANALYZING FLOW (2026-05-18) ═══ */}
        {/* 假分析等待屏 — scanner stream 运行期间显示扫描线 + 进度 + 流式文字 + trivia。
            stream 结束后 onFinish 把 isGuestEnhanced 置 true，effect 拉满进度
            然后 setAnalyzingActive(false) → 让位给 PaywallView。 */}
        {preview && analyzingActive && !isGuestEnhanced && (
          <AnalyzingFlow preview={preview} progress={analyzingProgress} />
        )}

        {/* ═══ PAYWALL — replaces locked AI Enhanced view (no-login refactor 2026-05-13) ═══ */}
        {/* Fake thumbnails are display-only — onPreviewLook intentionally omitted (2026-05-15). */}
        {preview && isGuestEnhanced && (
          <PaywallView
            mainPhoto={preview}
            unlocking={isUnlocking}
            onUnlock={async (expired) => {
              trackEvent('paywall_unlock_click', { tier: expired ? 'regular' : 'promo' });
              if (!scanId) {
                toast({
                  title: tToast.photoUploadingTitle,
                  description: tToast.photoUploadingDesc,
                });
                return;
              }
              const productId = expired
                ? process.env.NEXT_PUBLIC_PRODUCT_ID_BUNDLE_REGULAR
                : process.env.NEXT_PUBLIC_PRODUCT_ID_BUNDLE_PROMO;
              if (!productId) {
                toast({
                  title: tToast.checkoutMisconfiguredTitle,
                  description: tToast.checkoutMisconfiguredDesc,
                  variant: 'destructive',
                });
                return;
              }
              setIsUnlocking(true);
              try {
                // GA cookie 形如 GA1.1.<client>.<ts>，client.ts 段就是 client_id
                const gaCookie = typeof document !== 'undefined'
                  ? document.cookie.split('; ').find((c) => c.startsWith('_ga='))
                  : undefined;
                const gaClientId = gaCookie?.split('=')[1]?.split('.').slice(2).join('.') ?? '';

                const res = await fetch('/api/creem/create-checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scanId, productId, gaClientId }),
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error || `HTTP ${res.status}`);
                }
                const { checkoutUrl } = await res.json();
                if (!checkoutUrl) throw new Error('No checkoutUrl returned');
                // 落地 scan_id 防回跳时 URL 拿不到（如 Creem 改 successUrl 透传）
                safeSetItem(sessionStorage, 'mf_scan_id', scanId);
                skipExitWarningRef.current = true;
                window.location.href = checkoutUrl;
              } catch (err) {
                console.error('[paywall] checkout failed:', err);
                trackEvent('paywall_unlock_failed', { reason: (err as Error).message });
                toast({
                  title: tToast.checkoutFailedTitle,
                  description: tToast.checkoutFailedDesc,
                  variant: 'destructive',
                });
                setIsUnlocking(false);
              }
            }}
            onReset={handleReset}
          />
        )}

        {/* ═══ DESKTOP: After Enhance click (analysis running or has results) ═══ */}
        {preview && !analyzingActive && !isGuestEnhanced && (hasStartedAnalysis || isLoading || isEnhancing || !!visibleText || !!watermarkedImage) && (
          <div className="hidden md:grid md:grid-cols-2 gap-5">
            <div onClick={showEnhanced ? selectOriginal : undefined}
              className={`rounded-card border-2 transition-all duration-300 overflow-hidden ${showEnhanced ? 'cursor-pointer' : ''} ${showEnhanced ? isOriginalSelected ? 'border-rausch shadow-lg ' : 'border-hairline-soft opacity-60 hover:opacity-90' : 'border-hairline-soft'} bg-canvas`}>
              {showEnhanced && <div className={`text-center py-2 text-sm font-bold tracking-wide transition-colors ${isOriginalSelected ? 'text-rausch bg-rausch/10' : 'text-ink-soft'}`}>{tCommon.originalTab}</div>}
              <div className="px-4 pb-4">
                <div className={`relative w-full overflow-hidden rounded-card border border-hairline bg-surface-soft flex items-center justify-center transition-all duration-500 ${imgHeightClass}`}>
                  <img src={preview} alt="Original" className={`w-full object-contain p-2 cursor-pointer ${isCompact ? 'max-h-[240px] md:max-h-[280px]' : 'max-h-[300px] md:max-h-[360px]'}`} onClick={() => openLightbox(preview!)} />
                  {/* Scan overlay also shows in the transient gap between Enhance click
                      and the first stream chunk (hasStartedAnalysis=true, isLoading=false). */}
                  {(isLoading || (hasStartedAnalysis && !visibleText)) && <ScanningOverlay />}
                </div>
                {!hasStartedAnalysis && !isLoading && !isEnhancing && !showEnhanced && (
                  <div className="flex flex-col gap-3 mt-4">

                    {enhanceError ? (
                      <button type="button" onClick={() => handleEnhance()} disabled={isEnhancing}
                        className="w-full h-12 rounded-btn font-medium text-base flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-ab-card disabled:opacity-40 transition-colors">
                        <RefreshCw className="w-5 h-5" /> Retry Enhancement
                        <span className="inline-flex items-center rounded-pill bg-white/15 px-2.5 py-0.5 text-xs font-semibold">{tCommon.noCharge}</span>
                      </button>
                    ) : autoStartChecking ? (
                      <button type="button" disabled
                        className="w-full h-12 rounded-btn font-medium text-base flex items-center justify-center gap-2 bg-rausch text-white shadow-ab-card opacity-70">
                        <Loader2 className="w-5 h-5 animate-spin" /> Preparing...
                      </button>
                    ) : (
                      // [no-login refactor] Single Enhance button — no credits chip,
                      // no autoStart/creditConfirm branches (dead code in one-shot mode).
                      <button type="button" onClick={handleSubmit} disabled={isLoading || isEnhancing}
                        className="w-full h-12 rounded-btn font-medium text-base flex items-center justify-center gap-2 bg-rausch hover:bg-rausch-active text-white shadow-ab-card disabled:opacity-40 transition-colors">
                        <Wand2 className="w-5 h-5" /> Enhance Photo
                      </button>
                    )}
                    <label className="w-full h-10 rounded-btn text-sm text-ink-muted hover:text-ink-body hover:bg-surface-soft flex items-center justify-center gap-2 cursor-pointer">
                      <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                      <RefreshCw className="w-3.5 h-3.5" /> Change photo
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div onClick={showEnhanced ? selectEnhanced : undefined}
              className={`rounded-card border-2 transition-all duration-300 overflow-hidden ${showEnhanced ? !isOriginalSelected ? 'border-ink shadow-lg  cursor-pointer' : 'border-hairline-soft opacity-60 hover:opacity-90 cursor-pointer' : 'border-hairline-soft'} bg-canvas`}>
              {showEnhanced && <div className={`text-center py-2 text-sm font-bold tracking-wide transition-colors ${!isOriginalSelected ? 'text-ink bg-surface-soft' : 'text-ink-soft'}`}>{tCommon.aiEnhancedTab}</div>}
              <div className="px-4 pb-4">
                <div className={`relative w-full overflow-hidden rounded-card border border-hairline bg-surface-soft flex items-center justify-center transition-all duration-500 ${imgHeightClass}`}>
                  {showEnhanced ? (
                    <div className="relative h-full w-full">
                      <img src={enhancedSrc || preview!} alt="Enhanced" className={`w-full object-contain p-2 ${isGuestEnhanced ? '' : 'cursor-pointer'} ${isCompact ? 'max-h-[240px] md:max-h-[280px]' : 'max-h-[300px] md:max-h-[360px]'}`} style={isGuestEnhanced ? { filter: 'blur(6px)', transform: 'scale(1.02)' } : {}} onClick={() => enhancedSrc && openLightbox(enhancedSrc)} />
                      <div className="absolute top-3 left-3 bg-canvas/95 backdrop-blur-sm text-ink text-xs font-bold px-2.5 py-1 rounded-pill border border-hairline shadow-ab-card flex items-center gap-1"><Sparkles className="size-3" /> AI Enhanced</div>
                      {!isGuestEnhanced && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-pill text-[12px] font-medium flex items-center gap-1.5 pointer-events-none whitespace-nowrap text-white backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.65)' }}>
                          <Sparkles className="size-3" /> Tap to view full screen
                        </div>
                      )}
                      {isGuestEnhanced && <GuestLockOverlay />}
                    </div>
                  ) : isEnhancing ? (
                    <div className="relative w-full h-full min-h-[200px]"><EnhancingOverlay /></div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-center px-6 opacity-30"><div className="grid size-16 place-items-center rounded-card bg-surface-soft border border-hairline-soft"><Sparkles className="size-7 text-ink-soft" /></div><div className="text-base text-ink-muted">{tCommon.enhancedPhotoHere}</div></div>
                  )}
                </div>
                {showEnhanced && variants && variants.length > 1 && !isGuestEnhanced && (
                  <div className="flex items-center justify-center gap-2 pt-3">
                    {variants.map((v, i) => (
                      <button
                        key={v.enhancementId}
                        type="button"
                        onClick={() => selectVariant(i)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          i === selectedVariantIndex
                            ? 'bg-ink text-white border-ink shadow-md '
                            : 'bg-surface-soft text-ink-body border-hairline hover:bg-surface-strong'
                        }`}
                        title={v.matchedScene ?? `Variant ${i + 1}`}
                      >
                        Look {i + 1}{v.matchedScene ? ` · ${v.matchedScene}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ MOBILE: After Enhance click ═══ */}
        <div className="md:hidden">
          {preview && !analyzingActive && !isGuestEnhanced && (hasStartedAnalysis || isLoading || isEnhancing || !!visibleText || !!watermarkedImage) && (
            // 下面原样
            <div className="rounded-card border border-hairline bg-canvas overflow-hidden">
              {showEnhanced && (
                <div className="grid grid-cols-2 border-b border-hairline-soft">
                  <button onClick={selectOriginal} className={`py-2.5 text-sm font-bold tracking-wide transition-colors ${isOriginalSelected ? 'text-rausch bg-rausch/10 border-b-2 border-rausch' : 'text-ink-soft'}`}>{tCommon.originalTab}</button>
                  <button onClick={selectEnhanced} className={`py-2.5 text-sm font-bold tracking-wide transition-colors ${!isOriginalSelected ? 'text-ink bg-surface-soft border-b-2 border-ink' : 'text-ink-soft'}`}>{tCommon.aiEnhancedTab}</button>
                </div>
              )}
              <div className="px-4 pb-4 pt-3">
                {/* [v9.2] Mobile preview: max-h-[280px] before analysis to keep buttons visible */}
                <div className={`relative w-full overflow-hidden rounded-card border border-hairline bg-surface-soft transition-all duration-500 ${isCompact ? 'max-h-[220px]' : 'max-h-[280px]'}`}
                  onTouchStart={showEnhanced ? handleTouchStart : undefined} onTouchMove={showEnhanced ? handleTouchMove : undefined} onTouchEnd={showEnhanced ? handleTouchEnd : undefined}>
                  <div style={{ display: sliderIndex === 0 ? 'block' : 'none' }} className="relative h-full w-full">
                    <img src={preview} alt="Original" className={`w-full object-contain p-2 ${isCompact ? 'max-h-[220px]' : 'max-h-[280px]'}`} onClick={() => openLightbox(preview!)} />
                    {showEnhanced && <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-white/10">{tCommon.original}</div>}
                  </div>
                  {showEnhanced && (
                    <div style={{ display: sliderIndex === 1 ? 'block' : 'none' }}>
                      <div className="relative h-full w-full">
                        <img src={enhancedSrc || preview!} alt="Enhanced" className={`w-full object-contain p-2 ${isCompact ? 'max-h-[220px]' : 'max-h-[280px]'}`} style={isGuestEnhanced ? { filter: 'blur(6px)', transform: 'scale(1.02)' } : {}} onClick={() => enhancedSrc && !isGuestEnhanced && openLightbox(enhancedSrc)} />
                        <div className="absolute top-3 left-3 bg-canvas/95 backdrop-blur-sm text-ink text-xs font-bold px-2.5 py-1 rounded-pill border border-hairline shadow-ab-card flex items-center gap-1"><Sparkles className="size-3" /> AI Enhanced</div>
                        {!isGuestEnhanced && (
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-pill text-[12px] font-medium flex items-center gap-1.5 pointer-events-none whitespace-nowrap text-white backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.65)' }}>
                            <Sparkles className="size-3" /> Tap to view full screen
                          </div>
                        )}
                        {isGuestEnhanced && <GuestLockOverlay />}
                      </div>
                    </div>
                  )}
                  {(isLoading || (hasStartedAnalysis && !visibleText)) && <ScanningOverlay />}
                  {isEnhancing && <EnhancingOverlay />}
                  {showEnhanced && !isLoading && !isEnhancing && (
                    <><button className="absolute left-2 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 disabled:opacity-20 border border-white/10" onClick={selectOriginal} disabled={sliderIndex === 0}><ChevronLeft className="w-4 h-4" /></button><button className="absolute right-2 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 disabled:opacity-20 border border-white/10" onClick={selectEnhanced} disabled={sliderIndex === 1}><ChevronRight className="w-4 h-4" /></button></>
                  )}
                </div>
                {showEnhanced && variants && variants.length > 1 && !isGuestEnhanced && sliderIndex === 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    {variants.map((v, i) => (
                      <button
                        key={v.enhancementId}
                        type="button"
                        onClick={() => selectVariant(i)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          i === selectedVariantIndex
                            ? 'bg-ink text-white border-ink shadow-md '
                            : 'bg-surface-soft text-ink-body border-hairline active:bg-surface-strong'
                        }`}
                      >
                        Look {i + 1}{v.matchedScene ? ` · ${v.matchedScene}` : ''}
                      </button>
                    ))}
                  </div>
                )}
                {showEnhanced && (
                  <div className="flex items-center justify-center gap-2 py-2">{[0, 1].map(i => <button key={i} onClick={() => { setSliderIndex(i); setSelectedPanel(i === 0 ? 'original' : 'enhanced'); }} className={`rounded-full transition-all duration-200 ${sliderIndex === i ? 'w-5 h-2 bg-rausch' : 'w-2 h-2 bg-hairline hover:bg-hairline-strong'}`} />)}</div>
                )}
                {!hasStartedAnalysis && !visibleText && !isLoading && !showEnhanced && (
                  <div className="flex flex-col gap-2 mt-3">
                    {/* [v9.2] Mobile: same auto-start logic as desktop */}
                    {autoStartChecking ? (
                      <button type="button" disabled
                        className="w-full h-12 rounded-btn font-medium text-base flex items-center justify-center gap-2 bg-rausch text-white shadow-ab-card opacity-70">
                        <Loader2 className="w-5 h-5 animate-spin" /> Preparing...
                      </button>
                    ) : (
                      // [no-login refactor] Single Enhance button — no credits chip.
                      <button type="button" onClick={handleSubmit} disabled={isLoading || isEnhancing}
                        className="w-full h-12 rounded-btn font-medium text-base flex items-center justify-center gap-2 bg-rausch text-white shadow-ab-card disabled:opacity-40">
                        <Wand2 className="w-5 h-5" /> Enhance Photo
                      </button>
                    )}
                    <label className="w-full h-9 rounded-btn text-xs text-ink-muted hover:text-ink-body flex items-center justify-center gap-1.5 cursor-pointer">
                      <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                      <RefreshCw className="w-3 h-3" /> Change photo
                    </label>
                  </div>
                )}
                {enhanceError && !isEnhancing && !showEnhanced && (
                  <div className="flex flex-col gap-2 mt-3">
                    <button type="button" onClick={() => handleEnhance()} disabled={isEnhancing}
                      className="w-full h-12 rounded-btn font-medium text-base flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-ab-card disabled:opacity-40 transition-colors">
                      <RefreshCw className="w-5 h-5" /> Retry Enhancement
                      <span className="inline-flex items-center rounded-pill bg-white/15 px-2.5 py-0.5 text-xs font-semibold">{tCommon.noCharge}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ ACTION BUTTONS ═══ */}
        {!isGuestEnhanced && (showEnhanced || enhanceError) && (
          <div className="flex flex-col gap-3">
            {isEnhancementComplete && (
              <button onClick={handleDownload} disabled={isDownloading}
                className="w-full h-12 rounded-btn gap-2 font-medium text-base bg-rausch hover:bg-rausch-active text-white shadow-ab-card transition-colors disabled:opacity-50 flex items-center justify-center">
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} {downloadButtonText}
              </button>
            )}
            {preview && visibleText && !isLoading && !isEnhancing && (enhanceError || analysisFailed) && (
              <Button type="button" variant="outline" className="w-full h-12 text-ink-muted gap-2 border-hairline hover:bg-surface-soft rounded-btn text-sm" onClick={handleTryAnother}><RefreshCw className="w-4 h-4" /> Try Another Photo</Button>
            )}
            {isEnhancementComplete && (
              <UsageGuideCard analysisJSON={analysisJSON} />
            )}
            {enhanceError && !activeModal && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-card border border-destructive/20 bg-destructive/5"><span className="text-destructive text-sm">⚠️ {tCommon.enhanceFailed} {enhanceError}</span><Button size="sm" variant="outline" className="shrink-0 border-destructive/20 text-destructive hover:bg-destructive/10 rounded-lg text-xs" onClick={() => handleEnhance()}>{tCommon.retry}</Button></div>
            )}
          </div>
        )}

        {/* ═══ CONTENT PANEL ═══ */}
        {/* DatingTrivia removed 2026-05-15: paywall shows instantly now, no wait UI. */}
        {isLoading && displayText && (
          <div className="rounded-card border border-hairline bg-surface-soft p-4">
            <div className="flex items-center gap-2 mb-2"><span className="text-rausch font-semibold text-sm flex items-center gap-2"><span className="grid size-5 place-items-center rounded bg-rausch/10">🎯</span> Analyzing...</span></div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-body">{displayText}</div>
          </div>
        )}
        {/* [DISABLED 2026-05-18 — no-login pivot]
            旧的"展示分析结果给免费用户看"分支。新流程里 scanner 分析结果只在
            server-side 用（webhook 后台拿 scene_tags 做 enhance），前端不展示。
            注释掉的原因：mount 时若 session restore 灌回 visibleText 而
            isGuestEnhanced 未持久化 (默认 false)，本块会冒出来盖掉付费墙，
            用户报告"停留一段时间后会回到老的分析结果页"。
            未来如果要恢复"不付费看完整分析"路径，把下面整段解开即可。
        {visibleText && !isLoading && !isGuestEnhanced && (
          <AnalysisResultCard analysisJSON={analysisJSON} visibleText={visibleText} onCopy={handleCopy} isCopied={isCopied} />
        )}
        */}

        {/* ═══ LIGHTBOX ═══ */}
        {lightboxOpen && lightboxImages.length > 0 && (() => {
          const isCompareMode = lightboxImages.length === 2 && !!preview && !!enhancedSrc && !isGuestEnhanced;
          if (isCompareMode) return renderUnlockCompareUI(closeLightbox);
          return (
            <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center" onClick={closeLightbox}>
              <button className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10" onClick={closeLightbox}><X className="size-5" /></button>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                <span className={`text-sm font-bold px-3 py-1 rounded-full backdrop-blur-sm ${lightboxIndex === 0 ? 'text-rausch bg-rausch/10 border border-rausch/20' : 'text-ink bg-surface-soft border border-emerald-500/20'}`}>
                  {lightboxImages[lightboxIndex]?.label}
                </span>
              </div>

              <div className="flex-1 flex items-center justify-center w-full px-4"
                onTouchStart={handleLightboxTouchStart} onTouchMove={handleLightboxTouchMove} onTouchEnd={handleLightboxTouchEnd}>
                <img src={lightboxImages[lightboxIndex]?.src} alt={lightboxImages[lightboxIndex]?.label}
                  className="max-w-full max-h-full object-contain" style={{ touchAction: 'pinch-zoom' }} onClick={e => e.stopPropagation()} />
              </div>
              {lightboxImages.length > 1 && (
                <>
                  <button className="absolute left-3 top-1/2 -translate-y-1/2 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-20 border border-white/10"
                    onClick={e => { e.stopPropagation(); lightboxPrev(); }} disabled={lightboxIndex === 0}><ChevronLeft className="size-5" /></button>
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-20 border border-white/10"
                    onClick={e => { e.stopPropagation(); lightboxNext(); }} disabled={lightboxIndex === lightboxImages.length - 1}><ChevronRight className="size-5" /></button>
                </>
              )}
              {lightboxImages.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {lightboxImages.map((_, i) => (
                    <button key={i} onClick={e => { e.stopPropagation(); setLightboxIndex(i); }}
                      className={`rounded-full transition-all duration-200 ${lightboxIndex === i ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/60'}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ RESULT SHOWCASE MODAL — drag-compare + watermark + unlock CTA ═══ */}
        {showResultShowcase && !isGuestEnhanced && renderUnlockCompareUI(() => setShowResultShowcase(false))}

        {/* ═══ POST-PAYMENT FLOW: reveal → delivery → save toast (no-login refactor) ═══ */}
        {postPaymentStage && (() => {
          const original = preview ?? EXAMPLE_PAIRS[0].before;
          // [no-login pivot 2026-05-17] paidVariants 来自 /api/scan-result 轮询；
          // 还没到 → 回退到 FAKE_LOOKS（带 filter）作为 reveal 期间的占位。
          // 一旦真图就绪，DeliveryScreen 用 afterSrc=base64 渲染真图。
          let deliveryVariants: DeliveryVariant[];
          if (paidVariants && paidVariants.length > 0) {
            deliveryVariants = paidVariants.map((v, i) => ({
              id: v.enhancementId,
              label: FAKE_LOOKS[i]?.label ?? `Look ${i + 1}`,
              tag: FAKE_LOOKS[i]?.tag ?? '',
              afterSrc: `data:${v.mimeType};base64,${v.image}`,
            }));
          } else {
            deliveryVariants = FAKE_LOOKS.map((look) => {
              const cleanFilter = look.filter.replace(/blur\([^)]+\)\s*/g, '').trim();
              return {
                id: look.id,
                label: look.label,
                tag: look.tag,
                filter: cleanFilter || undefined,
              };
            });
          }
          const thumbsForReveal = deliveryVariants.map((v) => v.afterSrc ?? original);
          return (
            <>
              {postPaymentStage === 'reveal' && (
                <RevealScreen
                  thumbs={thumbsForReveal}
                  onContinue={() => {
                    trackEvent('delivery_reveal_done');
                    setPostPaymentStage('delivery');
                  }}
                />
              )}
              {/* [multi-photo 2026-05-18] delivery stage 进来时若真图还没到 →
                  上方 GenerationProgress (6 步 / 15s) + 下方 DatingTrivia 循环答题；
                  失败 → 展示 retry 按钮。paidVariants 到位后自动让位给 DeliveryScreen */}
              {postPaymentStage === 'delivery' && (!paidVariants || !deliveryReadyToShow) && !paymentEnhanceFailed && (
                <div className="fixed inset-0 z-[55] flex flex-col bg-canvas">
                  <div className="flex items-center justify-between px-4 h-14 border-b border-hairline-soft bg-canvas shrink-0">
                    <span className="font-bold text-[20px] text-rausch" style={{ letterSpacing: '-0.5px' }}>matchfix</span>
                    <span className="px-2.5 py-1 rounded-pill text-[10.5px] font-bold flex items-center gap-1" style={{ background: 'rgba(255,56,92,0.10)', color: '#ff385c' }}>
                      <Lock className="size-3" /> Paid · keep app open
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 flex flex-col gap-3">
                    <div className="max-w-md mx-auto w-full flex flex-col gap-3">
                      <GenerationProgress ready={!!paidVariants} />
                      <DatingTrivia active={true} onTrack={trackEvent} />
                      <div className="text-center text-[10.5px] mt-auto pt-2 text-ink-soft">
                        ~15 seconds · don&apos;t close this screen
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {postPaymentStage === 'delivery' && paymentEnhanceFailed && (
                <div className="fixed inset-0 z-[55] flex flex-col items-center justify-center bg-canvas p-6 text-center">
                  <div className="grid size-16 place-items-center rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                    <AlertCircle className="size-8 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-semibold text-ink mb-2">{tCommon.finishFailedTitle}</h2>
                  <p className="text-sm text-ink-muted mb-1 leading-relaxed max-w-sm">
                    {tCommon.finishFailedBody}
                  </p>
                  <p className="text-xs text-ink-muted mb-6">{tCommon.finishFailedRefund}</p>
                  <button
                    type="button"
                    onClick={handleRetryEnhance}
                    disabled={isRetryingEnhance}
                    className="inline-flex items-center justify-center h-12 px-7 rounded-pill bg-rausch hover:bg-rausch-active text-white font-medium text-base shadow-ab-card transition-colors disabled:opacity-50"
                  >
                    {isRetryingEnhance ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-2" /> Retry generation</>}
                  </button>
                </div>
              )}
              {postPaymentStage === 'delivery' && paidVariants && deliveryReadyToShow && (
                <DeliveryScreen
                  originalSrc={original}
                  variants={deliveryVariants}
                  saving={isSavingDelivery}
                  onClose={() => {
                    trackEvent('delivery_close_click');
                    setPostPaymentStage(null);
                    setShowSaveToast(false);
                    setPaidVariants(null);
                    handleReset();
                  }}
                  onSaveAll={async () => {
                    if (isSavingDelivery) return;
                    trackEvent('delivery_save_all_click');
                    setIsSavingDelivery(true);
                    setShowSaveToast(false);
                    const ts = Date.now();
                    try {
                      // [no-login pivot] 有真图就直接走 /api/download/{id}
                      // 拿无水印原图；没真图（不该发生）退回 filter mock。
                      if (paidVariants && paidVariants.length > 0) {
                        // ── Mobile-friendly batch save via Web Share API ──
                        // iOS Safari / Android Chrome 只允许一个用户手势触发
                        // 一次下载，循环 a.click() 第二张起会被静默拦截。
                        // navigator.share({ files }) 能把多张图一次性丢进
                        // 系统 share sheet —— iOS 顶部默认就是"保存图像"，
                        // 一次操作把 3 张全存进相册。
                        // 桌面不支持 canShare(files) → fallback 到循环下载
                        // （桌面无单手势限制）。
                        const nav: any =
                          typeof navigator !== 'undefined' ? navigator : null;
                        const canWebShareFiles =
                          !!nav?.canShare &&
                          !!nav?.share;

                        if (canWebShareFiles) {
                          try {
                            const files = await Promise.all(
                              paidVariants.map(async (v, i) => {
                                const resp = await fetch(
                                  `/api/download/${v.enhancementId}`,
                                );
                                if (!resp.ok) {
                                  throw new Error(
                                    `download ${i} failed: ${resp.status}`,
                                  );
                                }
                                const blob = await resp.blob();
                                const ext = blob.type.includes('png')
                                  ? 'png'
                                  : 'jpg';
                                return new File(
                                  [blob],
                                  `matchfix-${i + 1}-${ts}.${ext}`,
                                  { type: blob.type || 'image/png' },
                                );
                              }),
                            );

                            // canShare 必须在拿到 files 后再判（不同浏览器对
                            // 不同 mime 支持不一样，先实际构造 File 再测）
                            if (nav.canShare({ files })) {
                              try {
                                await nav.share({
                                  files,
                                  title: 'matchfix · your 3 looks',
                                });
                                // 用户成功完成或取消都不会 throw 到这里
                                // （取消是 AbortError，下面 catch 处理）
                                setShowSaveToast(true);
                                return;
                              } catch (shareErr) {
                                // 用户取消 share sheet → 不算失败、不 fallback、不报错
                                if (
                                  (shareErr as Error).name === 'AbortError'
                                ) {
                                  return;
                                }
                                console.warn(
                                  '[delivery] navigator.share failed, falling back:',
                                  shareErr,
                                );
                                // 其他错误 → 落到下面循环 fallback
                              }
                            }
                          } catch (fetchErr) {
                            console.warn(
                              '[delivery] file prep for share failed, falling back to anchor loop:',
                              fetchErr,
                            );
                            // 落到下面循环 fallback
                          }
                        }

                        // Fallback (desktop / 不支持 web share / share 出错):
                        // 桌面浏览器允许同手势多 download，循环 a.click() 有效。
                        // 手机走到这里基本只能下成第 1 张，是已知降级路径。
                        for (let i = 0; i < paidVariants.length; i++) {
                          const v = paidVariants[i];
                          const a = document.createElement('a');
                          a.href = `/api/download/${v.enhancementId}`;
                          a.download = `matchfix-${i + 1}-${ts}.png`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          if (i < paidVariants.length - 1) {
                            await new Promise((r) => setTimeout(r, 350));
                          }
                        }
                      } else {
                        for (let i = 0; i < deliveryVariants.length; i++) {
                          const v = deliveryVariants[i];
                          await downloadFilteredImage(
                            original,
                            v.filter,
                            `matchfix-${v.id}-${ts}.jpg`,
                          );
                          if (i < deliveryVariants.length - 1) {
                            await new Promise((r) => setTimeout(r, 350));
                          }
                        }
                      }
                      setShowSaveToast(true);
                    } catch (err) {
                      console.error('[delivery] save-all failed', err);
                      toast({
                        title: tToast.saveFailedTitle,
                        description: tToast.saveFailedDesc,
                        variant: 'destructive',
                      });
                    } finally {
                      setIsSavingDelivery(false);
                    }
                  }}
                  onRegenerate={() => {
                    trackEvent('delivery_regenerate_click');
                    setPostPaymentStage(null);
                    setShowSaveToast(false);
                    setPaidVariants(null);
                    handleReset();
                  }}
                />
              )}
              {showSaveToast && (
                <SaveToast onDone={() => setShowSaveToast(false)} />
              )}
            </>
          );
        })()}

        <style>{`
          @keyframes progressIndeterminate {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
          @keyframes showcaseShimmer {
            0% { transform: translateX(-120%); }
            60% { transform: translateX(120%); }
            100% { transform: translateX(120%); }
          }
          @keyframes heroPop {
            0% { transform: scale(0.92); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          /* Paywall keyframes (no-login refactor) */
          @keyframes shimmer {
            0% { transform: translateX(-120%); }
            60% { transform: translateX(120%); }
            100% { transform: translateX(120%); }
          }
          @keyframes breathe {
            0%, 100% { transform: translateY(0); box-shadow: 0 10px 32px rgba(255,56,92,0.5); }
            50% { transform: translateY(-2px); box-shadow: 0 14px 38px rgba(255,56,92,0.6); }
          }
          @keyframes feedScroll {
            from { transform: translateY(0); }
            to { transform: translateY(-50%); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          /* Delivery flow (reveal/toast) */
          @keyframes pop {
            0% { transform: scale(0.92); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          /* AnalyzingFlow caret blink (2026-05-18) */
          @keyframes caret {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          @keyframes fadeSlide {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      {/* ═══ MODALS ═══ */}
      {activeModal === 'privacy_exit' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="w-full max-w-sm p-6 mx-4 bg-canvas border border-hairline rounded-card shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"><div className="grid size-16 place-items-center rounded-full bg-rausch/10 mb-4 border border-rausch/20"><ShieldCheck className="size-8 text-emerald-500" /></div><h2 className="text-xl font-semibold text-ink mb-2">{tCommon.privacyExitTitle}</h2><p className="text-sm text-ink-muted mb-1 leading-relaxed">{tCommon.privacyExitBody1Pre}<span className="font-semibold text-ink">{tCommon.privacyExitBody1Bold}</span>{tCommon.privacyExitBody1Post}</p><p className="text-sm text-ink-muted mb-6 leading-relaxed">{tCommon.privacyExitBody2Pre}<span className="font-semibold text-ink">{tCommon.privacyExitBody2Bold}</span>{tCommon.privacyExitBody2Post}</p><div className="flex w-full gap-3"><Button variant="outline" className="flex-1 h-11 rounded-btn border-hairline text-ink-body hover:bg-surface-soft" onClick={pendingNavigationRef.current ? handlePrivacyExitConfirm : handleTryAnotherConfirm}>{pendingNavigationRef.current ? tCommon.privacyExitLeave : tCommon.privacyExitStartOver}</Button><button className="flex-1 h-11 rounded-btn bg-rausch hover:bg-rausch-active text-white font-bold text-sm transition-all" onClick={handlePrivacyExitCancel}>{tCommon.privacyExitStay}</button></div></div></div>)}
      {activeModal === 'free_limit' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="w-full max-w-sm p-6 mx-4 bg-canvas border border-hairline rounded-card shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"><div className="grid size-16 place-items-center rounded-full bg-amber-500/10 mb-4 border border-amber-500/20"><Wand2 className="size-8 text-amber-500" /></div><h2 className="text-xl font-semibold text-ink mb-2">{tCommon.freeLimitTitle}</h2><p className="text-sm text-ink-muted mb-2 leading-relaxed">{tCommon.freeLimitBody1}</p><p className="text-xs text-ink-muted mb-6">{tCommon.freeLimitBody2Pre}<span className="font-bold text-emerald-400">{tCommon.freeLimitBody2Bold}</span>{tCommon.freeLimitBody2Post}</p><div className="flex w-full gap-3"><Button variant="outline" className="flex-1 h-11 rounded-btn border-hairline text-ink-body hover:bg-surface-soft" onClick={() => setActiveModal(null)}>{tCommon.freeLimitMaybeLater}</Button><button className="flex-1 h-11 rounded-btn bg-rausch hover:bg-rausch-active text-white font-bold text-sm transition-all" onClick={() => { setActiveModal(null); trackEvent('free_limit_signup_click'); openAuthModal('sign-up'); }}>{tCommon.freeLimitSignUp}</button></div></div></div>)}
      {/* [DISABLED 2026-05-13 — no-login refactor]
          "Credits Needed" 弹窗已停用：一次性买卖不再有 credits 概念。
          未来恢复时取消下面整行注释即可。
       */}
      {/* {activeModal === 'enhance' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"><div className="w-full max-w-sm p-6 mx-4 bg-canvas border border-hairline rounded-card shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"><div className="grid size-16 place-items-center rounded-full bg-rausch/10 mb-4 border border-rausch/20"><Coins className="size-8 text-rausch" /></div><h2 className="text-xl font-semibold text-ink mb-2">Credits Needed</h2><p className="text-sm text-ink-muted mb-2 leading-relaxed">AI photo enhancement costs <span className="font-bold text-ink">20 credits</span> for members or <span className="font-bold text-ink">25 credits</span> with a credit pack.</p><p className="text-xs text-ink-muted mb-6">Members save 5 credits per photo + get free watermark-free downloads.</p><div className="flex w-full gap-3"><Button variant="outline" className="flex-1 h-11 rounded-btn border-hairline text-ink-body hover:bg-surface-soft" onClick={() => setActiveModal(null)}>Cancel</Button><button className="flex-1 h-11 rounded-btn bg-rausch hover:bg-rausch-active text-white font-bold text-sm transition-all" onClick={() => { setActiveModal(null); trackEvent('upgrade_modal_click_refill'); router.push('/subscribe?returnPath=' + encodeURIComponent(pathname)); }}>Get Credits</button></div></div></div>)} */}

      {/* enhance_failed modal */}
      {activeModal === 'enhance_failed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 mx-4 bg-canvas border border-hairline rounded-card shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-full bg-amber-500/10 mb-4 border border-amber-500/20">
              <AlertCircle className="size-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-semibold text-ink mb-2">{tCommon.enhanceFailedTitle}</h2>
            <p className="text-sm text-ink-muted mb-2 leading-relaxed">
              {tCommon.enhanceFailedBody1Pre}<span className="font-semibold text-ink">{tCommon.enhanceFailedBody1Bold}</span>{tCommon.enhanceFailedBody1Post}
            </p>
            <p className="text-sm text-ink-muted mb-1 leading-relaxed">
              {tCommon.enhanceFailedBody2Pre}<span className="font-semibold text-emerald-400">{tCommon.enhanceFailedBody2Bold}</span>{tCommon.enhanceFailedBody2Post}
            </p>
            <p className="text-xs text-ink-muted mb-6">
              {tCommon.enhanceFailedHint}
            </p>
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-btn border-hairline text-ink-body hover:bg-surface-soft"
                onClick={() => {
                  setActiveModal(null);
                  setEnhanceError(null);
                  handleReset();
                }}
              >
                {tCommon.tryNewPhoto}
              </Button>
              <button
                className="flex-1 h-11 rounded-btn bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                onClick={() => {
                  setActiveModal(null);
                  handleEnhance();
                }}
              >
                <RefreshCw className="w-4 h-4" /> {tCommon.retryNowButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ [v9] download_unlock modal — $1.99 micro pack as primary CTA ═══ */}
      {activeModal === 'download_unlock' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-canvas border border-hairline rounded-card shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-emerald-400" />
                <span className="text-sm font-semibold text-ink">{tCommon.photoReady}</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="grid size-7 place-items-center rounded-full hover:bg-surface-soft transition-colors text-ink-muted text-xs">✕</button>
            </div>
            <p className="px-5 text-xs text-ink-muted mb-4">{tCommon.chooseHowSave}</p>

            <div className="px-4 pb-4 flex flex-col gap-2.5">
              {/* ── Option 1: $1.99 Micro Pack (Primary CTA) ── */}
              <div className="rounded-card border-2 border-rausch bg-rausch/5 overflow-hidden">
                <div className="bg-rausch/10 text-rausch text-[10px] font-bold text-center py-1 tracking-widest uppercase">{tCommon.newUserSpecial}</div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-ink font-semibold text-base">{getDownloadIds().length > 1 ? tCommon.saveAllLooks.replace('{n}', String(getDownloadIds().length)) : tCommon.saveThisPhoto}</div>
                      <div className="text-ink-muted text-xs mt-0.5">{tCommon.watermarkFree}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-ink font-bold text-xl">$1.99</div>
                      <div className="text-ink-muted text-[10px]">{tCommon.oneTime}</div>
                    </div>
                  </div>
                  <MicroPackCheckoutButton returnPath={pathname} groupIds={getDownloadIds()} />
                </div>
              </div>

              {/* ── Option 2: Pro Membership ── */}
              <button
                onClick={() => setActiveModal('membership')}
                className="w-full flex items-center gap-3 p-3.5 rounded-card border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
              >
                <div className="grid size-9 place-items-center rounded-full bg-amber-500/10 shrink-0">
                  <Crown className="size-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink text-sm">{tCommon.goPro}</div>
                  <div className="text-xs text-ink-muted">{tCommon.goProDesc}</div>
                </div>
                <span className="text-[10px] font-bold text-amber-500 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-full">{tCommon.bestValue}</span>
              </button>

              {/* ── Option 3: Credits Pack ── */}
              <button
                onClick={() => { setActiveModal(null); trackEvent('download_unlock_credits_pack_click'); router.push('/subscribe?returnPath=' + encodeURIComponent(pathname)); }}
                className="w-full flex items-center gap-3 p-3.5 rounded-card border border-hairline-soft bg-surface-soft hover:bg-surface-soft transition-colors text-left"
              >
                <div className="grid size-9 place-items-center rounded-full bg-surface-soft shrink-0">
                  <Coins className="size-4 text-ink-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink text-sm">{tCommon.buyCreditsPack}</div>
                  <div className="text-xs text-ink-muted">{tCommon.buyCreditsPackDesc}</div>
                </div>
              </button>

              {/* ── Option 4: Watermark download — DISABLED (see comment in showcase modal) ──
              <button
                onClick={handleDownloadWatermarked}
                className="w-full text-center text-xs text-ink-soft hover:text-ink-muted transition-colors py-1.5 underline underline-offset-2 decoration-hairline-strong"
              >
                or download with watermark (free)
              </button>
              */}
            </div>
          </div>
        </div>
      )}

      {/* download_choice modal (for users who already have 5+ credits) */}
      {activeModal === 'download_choice' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"><div className="w-full max-w-sm p-6 mx-4 bg-canvas border border-hairline rounded-card shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"><div className="grid size-16 place-items-center rounded-full bg-rausch/10 mb-4 border border-rausch/20"><Download className="size-8 text-emerald-500" /></div><h2 className="text-xl font-semibold text-ink mb-1">Save Your Enhanced Photo</h2><p className="text-sm text-ink-muted mb-1">Your photo looks amazing — don&apos;t lose it!</p><p className="text-xs text-destructive/70 mb-4 flex items-center gap-1 justify-center"><ShieldCheck className="size-3" /> We don&apos;t store photos. Leave this page and it&apos;s gone forever.</p><div className="flex flex-col w-full gap-2.5"><button onClick={() => setActiveModal('membership')} className="w-full flex items-center gap-3 p-4 rounded-card border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"><div className="grid size-10 place-items-center rounded-full bg-amber-500/10 shrink-0"><Crown className="size-5 text-amber-500" /></div><div className="flex-1 min-w-0"><div className="font-semibold text-ink text-sm">Become a Member</div><div className="text-xs text-ink-muted">No watermark · Free downloads forever</div></div><span className="text-[10px] font-bold text-amber-500 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-full">BEST</span></button><button onClick={handleDownloadWithCredits} className="w-full flex items-center gap-3 p-4 rounded-card border border-rausch/20 bg-rausch/5 hover:bg-rausch/10 transition-colors text-left"><div className="grid size-10 place-items-center rounded-full bg-rausch/10 shrink-0"><Coins className="size-5 text-rausch" /></div><div className="flex-1 min-w-0"><div className="font-semibold text-ink text-sm">Use 5 Credits</div><div className="text-xs text-ink-muted">No watermark · One-time purchase</div></div><span className="text-xs font-bold text-rausch shrink-0">⚡ 5</span></button>{/* watermark download — DISABLED (see comment in download_unlock modal) */}{false && <button onClick={handleDownloadWatermarked} className="w-full flex items-center gap-3 p-4 rounded-card border border-hairline bg-surface-soft hover:bg-surface-soft transition-colors text-left"><div className="grid size-10 place-items-center rounded-full bg-surface-soft shrink-0"><Download className="size-5 text-ink-muted" /></div><div className="flex-1 min-w-0"><div className="font-semibold text-ink text-sm">Download with Watermark</div><div className="text-xs text-ink-muted">Free · Includes Matchfix branding</div></div><span className="text-[10px] font-bold text-ink-muted shrink-0">FREE</span></button>}</div><button className="mt-4 w-full h-10 text-sm text-ink-muted hover:text-ink-body transition-colors" onClick={() => setActiveModal(null)}>Cancel</button></div></div>)}

      {/* membership modal — [v9] checkout button now stays open with loading */}
      {activeModal === 'membership' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="w-full max-w-sm bg-canvas border border-hairline rounded-card shadow-2xl animate-in zoom-in-95 duration-200"><div className="flex items-center justify-between px-5 pt-5 pb-3"><div className="flex items-center gap-2"><Crown className="size-4 text-amber-500" /><span className="text-sm font-semibold text-ink">Become a Member</span></div><button onClick={() => setActiveModal(null)} className="grid size-7 place-items-center rounded-full hover:bg-surface-soft transition-colors text-ink-muted text-xs">✕</button></div><div className="mx-4 mb-4 rounded-btn border border-rausch/30 bg-canvas border border-hairline overflow-hidden"><div className="bg-rausch text-white text-xs font-bold text-center py-1.5 tracking-wide">✦ MOST POPULAR ✦</div><div className="p-5"><div className="flex items-start justify-between mb-3"><div><div className="text-ink font-semibold text-lg">Pro</div><div className="text-ink-muted text-xs mt-0.5">200 credits / month</div></div><div className="text-right"><div className="text-ink font-bold text-2xl">$19.99</div><div className="text-ink-muted text-xs">/month</div></div></div><ul className="space-y-2 mb-5">{['8 photo enhancements per month (3 scenes each)', 'Unlimited watermark-free downloads', 'Save 15 credits/enhancement vs credit packs', 'AI photo analysis included free', 'Credits never expire'].map((f, i) => <li key={i} className="flex items-center gap-2 text-xs text-ink-body"><Check className="size-3.5 text-emerald-500 shrink-0" />{f}</li>)}</ul><MembershipCheckoutButton returnPath={pathname} /></div></div><div className="px-4 pb-5 text-center"><button onClick={() => { setActiveModal(null); router.push('/subscribe?returnPath=' + encodeURIComponent(pathname)); }} className="text-xs text-ink-muted hover:text-ink-body transition-colors underline underline-offset-2">View all plans →</button></div></div></div>)}

      {/* credits_shop modal — [v9] kept as fallback, checkout button now stays open with loading */}
      {activeModal === 'credits_shop' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="w-full max-w-sm bg-canvas border border-hairline rounded-card shadow-2xl animate-in zoom-in-95 duration-200"><div className="flex items-center justify-between px-5 pt-5 pb-3"><div className="flex items-center gap-2"><Coins className="size-4 text-rausch" /><span className="text-sm font-semibold text-ink">Get Credits</span></div><button onClick={() => setActiveModal(null)} className="grid size-7 place-items-center rounded-full hover:bg-surface-soft transition-colors text-ink-muted text-xs">✕</button></div><div className="mx-4 mb-4 rounded-btn border border-rausch/30 bg-canvas border border-hairline overflow-hidden"><div className="bg-rausch text-white text-xs font-bold text-center py-1.5 tracking-wide">✦ QUICKEST OPTION ✦</div><div className="p-5"><div className="flex items-start justify-between mb-3"><div><div className="text-ink font-semibold text-lg">Starter Pack</div><div className="text-ink-muted text-xs mt-0.5">Try it out — one full enhancement with 3 scene looks.</div></div><div className="text-right"><div className="text-ink font-bold text-2xl">$9.99</div><div className="text-ink-muted text-xs">one-time</div></div></div><ul className="space-y-2 mb-5">{['75 Credits', '1 photo enhancement (3 scene options)', 'Watermark-free downloads included', 'Credits never expire'].map((f, i) => <li key={i} className="flex items-center gap-2 text-xs text-ink-body"><Check className="size-3.5 text-emerald-500 shrink-0" />{f}</li>)}</ul><CreditsCheckoutButton returnPath={pathname} /></div></div><div className="px-4 pb-5 text-center"><button onClick={() => { setActiveModal(null); router.push('/subscribe?returnPath=' + encodeURIComponent(pathname)); }} className="text-xs text-ink-muted hover:text-ink-body transition-colors underline underline-offset-2">View all credit packs →</button></div></div></div>)}
      {activeModal === 'ai_busy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 mx-4 bg-canvas border border-hairline rounded-card shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-full bg-amber-500/10 mb-4 border border-amber-500/20">
              <Loader2 className="size-8 text-amber-500 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-ink mb-2">
              {tCommon.highDemandTitle}
            </h2>
            <p className="text-sm text-ink-muted mb-1 leading-relaxed">
              {tCommon.highDemandBody1}
            </p>
            <p className="text-sm text-ink-muted mb-4 leading-relaxed">
              {tCommon.highDemandBody2}
            </p>

            {retryCountdown > 0 && (
              <div className="mb-4 flex flex-col items-center gap-2">
                <div className="relative size-16">
                  <svg className="size-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" className="text-slate-800" strokeWidth="4" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" className="text-amber-500"
                      strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${(retryCountdown / 10) * 175.9} 175.9`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-ink font-bold text-lg">
                    {retryCountdown}
                  </span>
                </div>
                <span className="text-xs text-ink-muted">{tCommon.retryingAuto}</span>
              </div>
            )}

            <div className="flex w-full gap-3">
              <button
                className="flex-1 h-11 rounded-btn border border-hairline text-ink-body hover:bg-surface-soft text-sm font-medium transition-colors"
                onClick={handleRetryCancelAndReset}
              >
                {tCommon.cancelButton}
              </button>
              <button
                className="flex-1 h-11 rounded-btn bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                onClick={handleRetrySubmit}
              >
                <RefreshCw className="size-4" />
                {tCommon.retryNowButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// [v9] Checkout Buttons — loading state stays in modal until redirect
// ═══════════════════════════════════════════════════════════════

function MembershipCheckoutButton({ returnPath }: { returnPath: string }) {
  const tCommon = useT().scannerCommon;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const handleClick = async () => {
    setLoading(true); setError(false);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/sign-in'; return; }
      const res = await fetch('/api/creem/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: process.env.NEXT_PUBLIC_PRODUCT_ID_PRO!, productType: 'subscription', userId: user.id, returnPath }) });
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) { window.location.href = checkoutUrl; }
      else { setError(true); setLoading(false); }
    } catch (e) { setError(true); setLoading(false); }
  };
  return (
    <div className="flex flex-col gap-1">
      <button onClick={handleClick} disabled={loading}
        className="w-full h-11 rounded-btn bg-rausch hover:bg-rausch-active text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70">
        {loading ? <><Loader2 className="size-4 animate-spin" /> {tCommon.redirectingCheckout}</> : <><Crown className="size-4" /> {tCommon.goPro}</>}
      </button>
      {error && <p className="text-destructive text-xs text-center">{tCommon.somethingWrong}</p>}
    </div>
  );
}

function CreditsCheckoutButton({ returnPath }: { returnPath: string }) {
  const tCommon = useT().scannerCommon;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const handleClick = async () => {
    setLoading(true); setError(false);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/sign-in'; return; }
      const res = await fetch('/api/creem/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: process.env.NEXT_PUBLIC_PRODUCT_ID_PACK_STARTER!, productType: 'credits', userId: user.id, credits: 75, returnPath }) });
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) { window.location.href = checkoutUrl; }
      else { setError(true); setLoading(false); }
    } catch (e) { setError(true); setLoading(false); }
  };
  return (
    <div className="flex flex-col gap-1">
      <button onClick={handleClick} disabled={loading}
        className="w-full h-11 rounded-btn bg-rausch hover:bg-rausch-active text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70">
        {loading ? <><Loader2 className="size-4 animate-spin" /> {tCommon.redirectingCheckout}</> : <><Coins className="size-4" /> {tCommon.buyCreditsPack}</>}
      </button>
      {error && <p className="text-destructive text-xs text-center">{tCommon.somethingWrong}</p>}
    </div>
  );
}

// [v9] NEW: $1.99 Micro Pack checkout button
// `groupIds` carries the enhancementIds the user should be able to download
// after payment. For fusion mode this is all 3 variants; for retouch it's 1.
function MicroPackCheckoutButton({ returnPath, groupIds }: { returnPath: string; groupIds: string[] }) {
  const tCommon = useT().scannerCommon;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const handleClick = async () => {
    setLoading(true); setError(false);
    trackEvent('micro_pack_checkout_click', { count: groupIds.length });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/sign-in'; return; }
      // Persist the full group so the post-payment auto-download fires
      // for every variant (Plan B: 5 credits unlocks the whole group).
      if (groupIds.length > 0) {
        safeSetItem(sessionStorage, 'mf_showcase_pending_download_group', JSON.stringify(groupIds));
      }
      const res = await fetch('/api/creem/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: process.env.NEXT_PUBLIC_PRODUCT_ID_PACK_MICRO!, productType: 'credits', userId: user.id, credits: 5, returnPath }) });
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) { window.location.href = checkoutUrl; }
      else { setError(true); setLoading(false); safeRemoveItem(sessionStorage, 'mf_showcase_pending_download_group'); }
    } catch (e) { setError(true); setLoading(false); safeRemoveItem(sessionStorage, 'mf_showcase_pending_download_group'); }
  };
  const buttonLabel = groupIds.length > 1 ? tCommon.getAllLooks.replace('{n}', String(groupIds.length)) : tCommon.getThisPhoto;
  return (
    <div className="flex flex-col gap-1">
      <button onClick={handleClick} disabled={loading}
        className="w-full h-11 rounded-btn bg-rausch hover:bg-rausch-active text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70 shadow-lg ">
        {loading ? <><Loader2 className="size-4 animate-spin" /> Redirecting to checkout...</> : <><Zap className="size-4" /> {buttonLabel}</>}
      </button>
      {error && <p className="text-destructive text-xs text-center">{tCommon.somethingWrong}</p>}
    </div>
  );
}
// [v9.4] Showcase Micro Pack — stores group of enhancementIds so payment return
// auto-downloads all of them (Plan B: $1.99 unlocks the whole 3-variant group)
function ShowcaseMicroPackButton({ returnPath, enhancementId, groupIds }: { returnPath: string; enhancementId: string | null; groupIds: string[] }) {
  const tCommon = useT().scannerCommon;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const handleClick = async () => {
    setLoading(true); setError(false);
    trackEvent('showcase_micro_pack_click', { count: groupIds.length });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/sign-in'; return; }

      // Store enhancementId (legacy) AND the full group list so the post-
      // payment flow can iterate all 3 variants.
      if (enhancementId) {
        safeSetItem(sessionStorage, 'mf_showcase_pending_download', enhancementId);
      }
      if (groupIds.length > 0) {
        safeSetItem(sessionStorage, 'mf_showcase_pending_download_group', JSON.stringify(groupIds));
      }

      const res = await fetch('/api/creem/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: process.env.NEXT_PUBLIC_PRODUCT_ID_PACK_MICRO!,
          productType: 'credits',
          userId: user.id,
          credits: 5,
          returnPath,
        }),
      });
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setError(true); setLoading(false);
        safeRemoveItem(sessionStorage, 'mf_showcase_pending_download');
        safeRemoveItem(sessionStorage, 'mf_showcase_pending_download_group');
      }
    } catch {
      setError(true); setLoading(false);
      safeRemoveItem(sessionStorage, 'mf_showcase_pending_download');
      safeRemoveItem(sessionStorage, 'mf_showcase_pending_download_group');
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="showcase-download-btn w-full h-12 rounded-btn font-medium text-base flex items-center justify-center gap-2.5 text-white bg-rausch hover:bg-rausch-active shadow-ab-card transition-colors active:scale-[0.98] relative overflow-hidden disabled:opacity-80"
      >
        {!loading && (
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.22) 45%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.22) 55%, transparent 65%)',
              animation: 'showcaseShimmer 2.5s ease-in-out infinite',
            }}
          />
        )}
        {loading ? (
          <>
            <Loader2 className="size-5 animate-spin relative z-10" />
            <span className="relative z-10">{tCommon.redirectingCheckout}</span>
          </>
        ) : (
          <>
            <Download className="size-5 relative z-10" />
            <span className="relative z-10">{groupIds.length > 1 ? tCommon.getAllLooks.replace('{n}', String(groupIds.length)) : tCommon.getThisPhoto}</span>
          </>
        )}
      </button>
      {error && <p className="text-destructive text-xs text-center">{tCommon.somethingWrong}</p>}
    </div>
  );
}