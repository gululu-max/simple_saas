'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCompletion } from 'ai/react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, Wand2, Download, Lock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Image as ImageIcon,
  Upload,
  XCircle,
  Copy,
  Check,
  Coins,
  Crown,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { parseAnalysisStream } from '@/utils/parseAnalysisStream';
import { createClient } from '@/utils/supabase/client';
import { useAuthModal } from '@/components/auth/auth-modal-context';

// ─── Image Compression ───────────────────────────────────────
async function compressImage(
  file: File,
  options?: { maxSize?: number; quality?: number }
): Promise<string> {
  const { maxSize = 1024, quality = 0.75 } = options || {};
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  let { width, height } = img;
  if (width > height && width > maxSize) {
    height = Math.round((height * maxSize) / width);
    width = maxSize;
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height);
    height = maxSize;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL('image/jpeg', quality);
}

// ─── Analytics ───────────────────────────────────────────────
const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
};

// ─── Modal Types ─────────────────────────────────────────────
type ModalType = 'enhance' | 'download_choice' | 'membership' | 'credits_shop' | 'privacy_exit';

export default function BoostScanner() {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCopied, setIsCopied] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [isResultExpanded, setIsResultExpanded] = useState(true);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [watermarkedImage, setWatermarkedImage] = useState<string | null>(null);
  const [enhancementId, setEnhancementId] = useState<string | null>(null);
  const [enhancedMimeType, setEnhancedMimeType] = useState('image/png');

  const [isGuestEnhanced, setIsGuestEnhanced] = useState(false);
  const [isFreeGeneration, setIsFreeGeneration] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [sliderIndex, setSliderIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const [visibleText, setVisibleText] = useState<string>('');
  const [analysisJSON, setAnalysisJSON] = useState<string | null>(null);

  // Track whether there's an active result that would be lost on exit
  const hasActiveResult = !!(preview && (visibleText || watermarkedImage || isGuestEnhanced));

  // Pending navigation target when privacy modal intercepts route change
  const pendingNavigationRef = useRef<string | null>(null);
  // Whether to skip the privacy modal (after user confirms)
  const skipExitWarningRef = useRef(false);

  const router = useRouter();
  const pathname = usePathname();
  const { openAuthModal } = useAuthModal();

  // ─── Session Restore ─────────────────────────────────────
  useEffect(() => {
    const savedPreview = sessionStorage.getItem('mf_preview') || localStorage.getItem('mf_preview');
    const savedText    = sessionStorage.getItem('mf_visibleText') || localStorage.getItem('mf_visibleText');
    const savedJSON    = sessionStorage.getItem('mf_analysisJSON') || localStorage.getItem('mf_analysisJSON');
    const guestFlag    = localStorage.getItem('mf_guest_enhanced');

    if (savedPreview) { setPreview(savedPreview);   sessionStorage.setItem('mf_preview', savedPreview); }
    if (savedText)    { setVisibleText(savedText);  sessionStorage.setItem('mf_visibleText', savedText); }
    if (savedJSON)    { setAnalysisJSON(savedJSON); sessionStorage.setItem('mf_analysisJSON', savedJSON); }

    if (guestFlag === 'true' && savedPreview) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setIsGuestEnhanced(true);
          setSliderIndex(1);
          sessionStorage.setItem('mf_pending_enhance', 'true');
        }
      });
    }
  }, []);

  // ─── Auth State ──────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);

      if (event === 'SIGNED_IN' && session) {
        setIsGuestEnhanced(false);
        trackEvent('guest_signin_after_enhance');

        const hasPending =
          sessionStorage.getItem('mf_pending_enhance') === 'true' ||
          localStorage.getItem('mf_pending_enhance') === 'true';

        localStorage.removeItem('mf_pending_enhance');
        localStorage.removeItem('mf_guest_enhanced');
        localStorage.removeItem('mf_preview');
        localStorage.removeItem('mf_analysisJSON');
        localStorage.removeItem('mf_visibleText');

        if (hasPending) {
          sessionStorage.removeItem('mf_pending_enhance');
          const savedJSON = sessionStorage.getItem('mf_analysisJSON') || analysisJSON;
          const savedText = sessionStorage.getItem('mf_visibleText') || visibleText;
          handleEnhance(savedJSON, savedText ?? undefined);
        }
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, analysisJSON, visibleText]);

  // ─── Browser beforeunload warning ────────────────────────
  useEffect(() => {
    if (!hasActiveResult) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (skipExitWarningRef.current) return;
      e.preventDefault();
      // Modern browsers show a generic message; setting returnValue is required
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasActiveResult]);

  // ─── Intercept browser back / popstate ───────────────────
  useEffect(() => {
    if (!hasActiveResult) return;

    // Push a dummy history entry so pressing "back" triggers popstate
    // instead of immediately leaving
    window.history.pushState({ matchfixGuard: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      if (skipExitWarningRef.current) return;

      // Re-push so the user stays on this page while modal is open
      window.history.pushState({ matchfixGuard: true }, '');
      pendingNavigationRef.current = '__back__';
      setActiveModal('privacy_exit');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasActiveResult]);

  // ─── Intercept Next.js link clicks (anchor interception) ─
  useEffect(() => {
    if (!hasActiveResult) return;

    const handleClick = (e: MouseEvent) => {
      if (skipExitWarningRef.current) return;

      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Only intercept internal navigation (same origin, not the current page)
      const isSameOrigin =
        anchor.origin === window.location.origin ||
        href.startsWith('/') ||
        href.startsWith('#');

      if (!isSameOrigin) return;
      if (href === pathname || href === '#') return;

      e.preventDefault();
      e.stopPropagation();
      pendingNavigationRef.current = href;
      setActiveModal('privacy_exit');
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasActiveResult, pathname]);

  // ─── Reset ───────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setPreview(null);
    setWatermarkedImage(null);
    setEnhancementId(null);
    setIsGuestEnhanced(false);
    setIsFreeGeneration(false);
    setEnhanceError(null);
    setSliderIndex(0);
    setVisibleText('');
    setAnalysisJSON(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    sessionStorage.removeItem('mf_preview');
    sessionStorage.removeItem('mf_visibleText');
    sessionStorage.removeItem('mf_analysisJSON');
    sessionStorage.removeItem('mf_pending_enhance');
    localStorage.removeItem('mf_pending_enhance');
    localStorage.removeItem('mf_guest_enhanced');
    localStorage.removeItem('mf_preview');
    localStorage.removeItem('mf_analysisJSON');
    localStorage.removeItem('mf_visibleText');
    trackEvent('boost_image_reset');
  }, []);

  // ─── Privacy exit modal handlers ─────────────────────────
  const handlePrivacyExitConfirm = useCallback(() => {
    const target = pendingNavigationRef.current;
    skipExitWarningRef.current = true;
    setActiveModal(null);
    handleReset();

    // Navigate after clearing
    if (target === '__back__') {
      window.history.back();
    } else if (target) {
      router.push(target);
    }

    // Reset the skip flag after a tick
    setTimeout(() => {
      skipExitWarningRef.current = false;
      pendingNavigationRef.current = null;
    }, 200);
  }, [handleReset, router]);

  const handlePrivacyExitCancel = useCallback(() => {
    setActiveModal(null);
    pendingNavigationRef.current = null;
  }, []);

  // ─── "Try Another Photo" button handler ──────────────────
  const handleTryAnother = useCallback(() => {
    pendingNavigationRef.current = null;
    setActiveModal('privacy_exit');
  }, []);

  const handleTryAnotherConfirm = useCallback(() => {
    setActiveModal(null);
    handleReset();
    skipExitWarningRef.current = false;
    pendingNavigationRef.current = null;
  }, [handleReset]);

  // ─── Enhance ─────────────────────────────────────────────
  const handleEnhance = async (jsonFromFinish?: string | null, textFromFinish?: string) => {
    if (!preview) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setIsGuestEnhanced(true);
      setSliderIndex(1);
      sessionStorage.setItem('mf_pending_enhance', 'true');
      localStorage.setItem('mf_pending_enhance', 'true');
      localStorage.setItem('mf_guest_enhanced', 'true');
      if (preview)      localStorage.setItem('mf_preview', preview);
      if (analysisJSON) localStorage.setItem('mf_analysisJSON', analysisJSON);
      if (visibleText)  localStorage.setItem('mf_visibleText', visibleText);
      return;
    }

    setIsEnhancing(true);
    setEnhanceError(null);
    trackEvent('enhance_start_click');

    try {
      const res = await fetch('/api/enhance-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: preview.split(',')[1],
          mimeType: 'image/jpeg',
          analysisResult: jsonFromFinish ?? analysisJSON ?? textFromFinish ?? visibleText ?? '',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS') {
          setActiveModal('enhance');
          return;
        }
        const msg = data.error || 'Unknown error';
        setEnhanceError(msg);
        trackEvent('enhance_failed', { reason: msg });
        return;
      }

      setWatermarkedImage(data.watermarkedImage);
      setEnhancementId(data.enhancementId);
      setEnhancedMimeType(data.mimeType ?? 'image/png');
      setIsFreeGeneration(data.isFreeTrial);

      setIsGuestEnhanced(false);
      setSliderIndex(1);
      router.refresh();
      trackEvent('enhance_complete', { status: 'success' });
    } catch (err) {
      const msg = 'Network error. Please try again.';
      setEnhanceError(msg);
      trackEvent('enhance_failed', { reason: 'network_error' });
    } finally {
      setIsEnhancing(false);
    }
  };

  // ─── Scanner Stream ──────────────────────────────────────
  const { complete, completion, isLoading } = useCompletion({
    api: '/api/scanner',
    onFinish: (_prompt, fullCompletion) => {
      const { visibleText: text, analysisJSON: json } = parseAnalysisStream(fullCompletion);
      setVisibleText(text);
      setAnalysisJSON(json);
      sessionStorage.setItem('mf_visibleText', text);
      if (json) sessionStorage.setItem('mf_analysisJSON', json);
      trackEvent('boost_complete', { status: 'success' });
      fetch('/api/meta-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: `lead_${Date.now()}` }),
      }).catch(err => console.error('[Meta CAPI] Lead event failed:', err));
      router.refresh();
      handleEnhance(json, text);
    },
    onError: (error) => {
      try {
        const errorData = JSON.parse(error.message);
        if (
          errorData.code === 'INSUFFICIENT_CREDITS' ||
          (errorData.error && errorData.error.includes('Insufficient credits'))
        ) {
          trackEvent('boost_failed', { reason: 'insufficient_credits' });
          setActiveModal('enhance');
          return;
        }
        alert('Oops: ' + (errorData.error || 'Something went wrong.'));
      } catch (e) {
        if (error.message.includes('402')) {
          setActiveModal('enhance');
        } else {
          alert('Oops, something went wrong: ' + error.message);
        }
      }
    }
  });

  const displayText = isLoading
    ? parseAnalysisStream(completion).visibleText
    : visibleText;

  const handleCopy = () => {
    if (!visibleText) return;
    navigator.clipboard.writeText(visibleText);
    setIsCopied(true);
    trackEvent('boost_copy_result');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // ─── File Select ─────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('We only boost images. Upload a valid photo.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. (Max 10MB)');
      return;
    }
    trackEvent('boost_image_selected', { file_size: Math.round(file.size / 1024) });
    const compressed = await compressImage(file, { maxSize: 1024, quality: 0.75 });
    setPreview(compressed);
    setWatermarkedImage(null);
    setEnhancementId(null);
    setIsGuestEnhanced(false);
    setIsFreeGeneration(false);
    setEnhanceError(null);
    setSliderIndex(0);
    sessionStorage.setItem('mf_preview', compressed);
    sessionStorage.removeItem('mf_visibleText');
    sessionStorage.removeItem('mf_analysisJSON');
  };

  const handleSubmit = async () => {
    if (!preview || isLoading) return;
    setActiveModal(null);
    setIsResultExpanded(true);
    setVisibleText('');
    setAnalysisJSON(null);
    setWatermarkedImage(null);
    setEnhancementId(null);
    setIsGuestEnhanced(false);
    setIsFreeGeneration(false);
    setEnhanceError(null);
    setSliderIndex(0);
    sessionStorage.removeItem('mf_visibleText');
    sessionStorage.removeItem('mf_analysisJSON');
    trackEvent('boost_start_click');
    await complete('', {
      body: {
        imageBase64: preview.split(',')[1],
        mimeType: 'image/jpeg',
      },
    });
  };

  // ─── Download ────────────────────────────────────────────
  const handleDownload = async () => {
    if (!enhancementId) return;

    if (isFreeGeneration) {
      setActiveModal('download_choice');
      return;
    }

    setIsDownloading(true);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enhancementId }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.code === 'EXPIRED') {
          alert('This enhancement has expired. Please re-enhance your photo.');
          handleReset();
        } else {
          alert('Error: ' + (data.error || 'Download failed'));
        }
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'matchfix-enhanced.png';
      link.click();
      URL.revokeObjectURL(url);
      trackEvent('enhance_download_success');
      router.refresh();
    } catch (err) {
      alert('Network error during download.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadWatermarked = () => {
    if (!watermarkedImage) return;
    const link = document.createElement('a');
    link.href = `data:${enhancedMimeType};base64,${watermarkedImage}`;
    link.download = 'matchfix-enhanced-watermark.png';
    link.click();
    setActiveModal(null);
    trackEvent('enhance_download_watermark_free');
  };

  const handleDownloadWithCredits = async () => {
    if (!enhancementId) return;
    setActiveModal(null);
    setIsDownloading(true);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enhancementId }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.code === 'INSUFFICIENT_CREDITS') {
          setActiveModal('credits_shop');
        } else if (data.code === 'EXPIRED') {
          alert('This enhancement has expired. Please re-enhance your photo.');
          handleReset();
        } else {
          alert('Error: ' + (data.error || 'Download failed'));
        }
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'matchfix-enhanced.png';
      link.click();
      URL.revokeObjectURL(url);
      trackEvent('enhance_download_credits_success');
      router.refresh();
    } catch (err) {
      alert('Network error during download.');
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Touch Slider ────────────────────────────────────────
  const showSlider = !!(preview && (watermarkedImage || isGuestEnhanced));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && sliderIndex < 1) setSliderIndex(1);
      if (diff < 0 && sliderIndex > 0) setSliderIndex(0);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="w-full text-foreground relative">
      <div className="mx-auto flex w-full flex-col gap-6">
        <div className="flex flex-col gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10">
              <Wand2 className="size-6 text-primary" />
            </div>
            <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
              The Matchfix Scanner
            </h1>
          </div>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ImageIcon className="size-5 text-muted-foreground" />
              Upload Your &quot;Masterpiece&quot;
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Supports JPG/PNG. Local compression enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-2">
              {/* ── Image Preview Area ── */}
              <div
                className="relative min-h-[260px] w-full overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 transition-all"
                onTouchStart={showSlider ? handleTouchStart : undefined}
                onTouchMove={showSlider ? handleTouchMove : undefined}
                onTouchEnd={showSlider ? handleTouchEnd : undefined}
              >
                {preview ? (
                  <div className="relative h-full w-full">
                    {/* Original */}
                    <div style={{ display: sliderIndex === 0 ? 'block' : 'none' }}>
                      <img
                        src={preview}
                        alt="Original"
                        className="h-full w-full object-contain p-3"
                      />
                      {showSlider && (
                        <div className="absolute top-3 left-3 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded">
                          Original
                        </div>
                      )}
                    </div>

                    {/* Enhanced / Guest Blur */}
                    {showSlider && (
                      <div style={{ display: sliderIndex === 1 ? 'block' : 'none' }}>
                        <div className="relative">
                          <img
                            src={
                              watermarkedImage
                                ? `data:${enhancedMimeType};base64,${watermarkedImage}`
                                : preview!
                            }
                            alt="Enhanced"
                            className="h-full w-full object-contain p-3"
                            style={isGuestEnhanced ? { filter: 'blur(14px)', transform: 'scale(1.04)' } : {}}
                          />
                          <div className="absolute top-3 left-3 bg-emerald-500/80 text-white text-xs font-bold px-2 py-1 rounded">
                            AI Enhanced ✨
                          </div>

                          {isGuestEnhanced && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center bg-black/40">
                              <div className="grid size-11 place-items-center rounded-full bg-white/10 border border-white/20">
                                <Lock className="size-5 text-white" />
                              </div>
                              <div>
                                <p className="text-white font-bold text-sm sm:text-base">Sign in to view full preview</p>
                                <p className="text-white/60 text-xs mt-1">Your enhanced photo is ready</p>
                              </div>
                              <Button
                                size="sm"
                                className="bg-white text-slate-900 hover:bg-white/90 font-bold gap-2 px-5"
                                onClick={() => openAuthModal('sign-up')}
                              >
                                Sign in
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Scanning overlay */}
                    {isLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                          <div
                            className="absolute left-0 right-0 h-0.5 bg-primary"
                            style={{ boxShadow: '0 0 12px 4px rgba(220,38,38,0.8)', animation: 'scanLine 2s linear infinite' }}
                          />
                        </div>
                        <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
                          <div className="flex space-x-1.5">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <p className="text-white font-semibold text-sm animate-pulse">AI is analyzing your photo...</p>
                          <p className="text-white/60 text-xs">Usually done within 7 seconds</p>
                        </div>
                      </div>
                    )}

                    {/* Enhancing overlay */}
                    {isEnhancing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                          <div
                            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                            style={{ boxShadow: '0 0 16px 6px rgba(52,211,153,0.7)', animation: 'scanLine 1.5s linear infinite' }}
                          />
                        </div>
                        <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
                          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                          <p className="text-white font-semibold text-sm animate-pulse">Verifying user status...</p>
                          <p className="text-white/60 text-xs">Preparing your enhanced photo</p>
                        </div>
                      </div>
                    )}

                    {/* Slider arrows */}
                    {showSlider && !isLoading && !isEnhancing && (
                      <>
                        <button
                          className="absolute left-2 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-all disabled:opacity-20"
                          onClick={() => setSliderIndex(0)}
                          disabled={sliderIndex === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-all disabled:opacity-20"
                          onClick={() => setSliderIndex(1)}
                          disabled={sliderIndex === 1}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-4 px-6 py-10 text-center cursor-pointer min-h-[260px] justify-center"
                  >
                    <div className="grid size-14 place-items-center rounded-2xl bg-background border border-border shadow-sm">
                      <Upload className="size-6 text-muted-foreground/70" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base font-semibold text-foreground">
                        Click to upload your dating profile pic 📸
                      </div>
                      <div className="text-sm text-muted-foreground">Or drag and drop it here</div>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Slider dots */}
              {showSlider && (
                <div className="flex items-center justify-center gap-2 py-1">
                  {[0, 1].map((i) => (
                    <button
                      key={i}
                      onClick={() => setSliderIndex(i)}
                      className={`rounded-full transition-all duration-200 ${sliderIndex === i
                        ? 'w-4 h-2 bg-primary'
                        : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                        }`}
                    />
                  ))}
                </div>
              )}

              {/* Error */}
              {enhanceError && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm">
                  <span className="text-red-400">⚠️ Enhancement failed: {enhanceError}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => handleEnhance()}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>

            <style>{`
              @keyframes scanLine {
                0% { top: 0%; }
                100% { top: 100%; }
              }
            `}</style>

            {/* Analysis Result */}
            {(isLoading || visibleText) && (
              <div className="border border-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsResultExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors text-left sticky top-0 z-10"
                >
                  <span className="text-primary font-semibold text-sm flex items-center gap-2">
                    🎯 Your Profile Breakdown:
                  </span>
                  {isResultExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                </button>

                {isResultExpanded && (
                  <div className="p-4 bg-card">
                    <div className="relative whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-5 text-sm md:text-base leading-relaxed text-foreground min-h-[80px]">
                      {visibleText && !isLoading && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={handleCopy}
                        >
                          {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      )}
                      {!displayText && isLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      ) : (
                        <div className="pr-8">{displayText}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit / Reset row */}
            {!(visibleText && !isLoading) && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  {preview ? '✅ Photo loaded. Ready to boost.' : 'No photo selected yet.'}
                </div>
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || isEnhancing || !preview}
                    className="w-full sm:w-auto h-11 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-bold px-6"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Scanning...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Enhance Photo
                        <span className="inline-flex items-center rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                          {isLoggedIn ? '⚡ 20' : 'Free'}
                        </span>
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ── "Try Another Photo" button (shown after results) ── */}
            {preview && visibleText && !isLoading && isLoggedIn && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end mt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto h-11 text-muted-foreground gap-2"
                  onClick={handleTryAnother}
                  disabled={isEnhancing}
                >
                  <RefreshCw className="w-4 h-4" /> Try Another Photo
                </Button>
              </div>
            )}

            {/* Download Button */}
            {enhancementId && !isGuestEnhanced && sliderIndex === 1 && (
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full h-11 gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isFreeGeneration
                  ? 'Download Photo'
                  : 'Download Enhanced Photo'}
              </Button>
            )}

          </CardContent>
          <CardFooter className="text-xs text-muted-foreground/60 bg-muted/20 py-4 rounded-b-xl">
            Disclaimer: For entertainment purposes only.
          </CardFooter>
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════
          MODAL: Privacy Exit Warning
      ════════════════════════════════════════════════════════ */}
      {activeModal === 'privacy_exit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 mx-4 bg-card border border-border rounded-2xl shadow-xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-full bg-emerald-500/10 mb-4 border border-emerald-500/20">
              <ShieldCheck className="size-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Your Privacy Matters 🔒</h2>
            <p className="text-sm text-muted-foreground mb-1 leading-relaxed">
              To protect your privacy, <span className="font-semibold text-foreground">we never store any photos</span> on our servers.
            </p>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Once you leave this page, your current photo and results will be <span className="font-semibold text-foreground">permanently deleted</span> and cannot be recovered.
            </p>
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={pendingNavigationRef.current ? handlePrivacyExitConfirm : handleTryAnotherConfirm}
              >
                {pendingNavigationRef.current ? 'Leave Anyway' : 'Start Over'}
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold"
                onClick={handlePrivacyExitCancel}
              >
                Stay on Page
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: Insufficient Credits (enhance)
      ════════════════════════════════════════════════════════ */}
      {activeModal === 'enhance' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 mx-4 bg-card border border-border rounded-2xl shadow-xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-full bg-primary/10 mb-4 border border-primary/20">
              <Coins className="size-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Not Enough Credits 😅</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              You need <span className="font-bold text-foreground">20 Credits</span> to enhance a photo. Top up to continue.
            </p>
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold"
                onClick={() => {
                  setActiveModal(null);
                  trackEvent('upgrade_modal_click_refill');
                  router.push('/pricing');
                }}
              >
                Get Credits
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: Download Choice (free trial user)
      ════════════════════════════════════════════════════════ */}
      {activeModal === 'download_choice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 mx-4 bg-card border border-border rounded-2xl shadow-xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-full bg-emerald-500/10 mb-4 border border-emerald-500/20">
              <Download className="size-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">Download Your Photo</h2>
            <p className="text-sm text-muted-foreground mb-6">Choose how you&apos;d like to download</p>

            <div className="flex flex-col w-full gap-3">
              <button
                onClick={() => setActiveModal('membership')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
              >
                <div className="grid size-10 place-items-center rounded-full bg-amber-500/10 shrink-0">
                  <Crown className="size-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-sm">Member Download</div>
                  <div className="text-xs text-muted-foreground">No watermark · Free for members</div>
                </div>
                <span className="text-xs font-bold text-amber-500 shrink-0">FREE</span>
              </button>

              <button
                onClick={handleDownloadWithCredits}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
              >
                <div className="grid size-10 place-items-center rounded-full bg-primary/10 shrink-0">
                  <Coins className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-sm">Use Credits</div>
                  <div className="text-xs text-muted-foreground">No watermark · 5 credits</div>
                </div>
                <span className="text-xs font-bold text-primary shrink-0">⚡ 5</span>
              </button>

              <button
                onClick={handleDownloadWatermarked}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="grid size-10 place-items-center rounded-full bg-muted shrink-0">
                  <Download className="size-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-sm">Download with Watermark</div>
                  <div className="text-xs text-muted-foreground">Free · Includes MatchFix watermark</div>
                </div>
                <span className="text-xs font-bold text-muted-foreground shrink-0">FREE</span>
              </button>
            </div>

            <Button
              variant="ghost"
              className="mt-4 w-full h-10 text-muted-foreground"
              onClick={() => setActiveModal(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: Membership (Pro recommendation)
      ════════════════════════════════════════════════════════ */}
      {activeModal === 'membership' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-amber-500" />
                <span className="text-sm font-bold text-white">Become a Member</span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="grid size-7 place-items-center rounded-full hover:bg-slate-800 transition-colors text-slate-400 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="mx-4 mb-4 rounded-xl border border-rose-500/40 bg-slate-900 overflow-hidden">
              <div className="bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-bold text-center py-1.5 tracking-wide">
                ✦ RECOMMENDED FOR YOU ✦
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-white font-bold text-lg">Pro</div>
                    <div className="text-slate-400 text-xs mt-0.5">200 credits / month</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-extrabold text-2xl">9.99</div>
                    <div className="text-slate-500 text-xs">/month</div>
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {[
                    'Unlimited watermark-free downloads',
                    '200 Credits per month',
                    'Analyze up to 40 photos with AI',
                    'Credits NEVER expire',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <MembershipCheckoutButton
                  onStart={() => setActiveModal(null)}
                />
              </div>
            </div>

            <div className="px-4 pb-5 text-center">
              <button
                onClick={() => { setActiveModal(null); router.push('/pricing'); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                View all membership plans →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: Credits Shop (Basic Pack recommendation)
      ════════════════════════════════════════════════════════ */}
      {activeModal === 'credits_shop' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="size-4 text-primary" />
                <span className="text-sm font-bold text-white">Buy Credits</span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="grid size-7 place-items-center rounded-full hover:bg-slate-800 transition-colors text-slate-400 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="mx-4 mb-4 rounded-xl border border-primary/40 bg-slate-900 overflow-hidden">
              <div className="bg-primary text-primary-foreground text-xs font-bold text-center py-1.5 tracking-wide">
                ✦ RECOMMENDED FOR YOU ✦
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-white font-bold text-lg">Basic Pack</div>
                    <div className="text-slate-400 text-xs mt-0.5">25 credits · one-time</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-extrabold text-2xl"></div>
                    <div className="text-slate-500 text-xs">one-time</div>
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {[
                    'Download this photo without watermark',
                    '25 Credits total',
                    'Score up to 5 photos',
                    'Credits never expire',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <CreditsCheckoutButton
                  onStart={() => setActiveModal(null)}
                />
              </div>
            </div>

            <div className="px-4 pb-5 text-center">
              <button
                onClick={() => { setActiveModal(null); router.push('/pricing'); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                View all credit packs →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Checkout Button: Pro Membership ─────────────────────────
function MembershipCheckoutButton({ onStart }: { onStart: () => void }) {
  const [loading, setLoading] = React.useState(false);

  const handleClick = async () => {
    setLoading(true);
    onStart();
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/sign-in'; return; }

      const res = await fetch('/api/creem/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'prod_1OW6mmHO9dwQv7tcLvoWqE',
          productType: 'subscription',
          userId: user.id,
        }),
      });
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) window.location.href = checkoutUrl;
    } catch (e) {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Crown className="size-4" />}
      {loading ? 'Redirecting...' : 'Get Pro — 9.99/mo'}
    </button>
  );
}

// ─── Checkout Button: Basic Credits Pack ─────────────────────
function CreditsCheckoutButton({ onStart }: { onStart: () => void }) {
  const [loading, setLoading] = React.useState(false);

  const handleClick = async () => {
    setLoading(true);
    onStart();
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/sign-in'; return; }

      const res = await fetch('/api/creem/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'prod_45VZKvDlwmOeCaZmtpVVht',
          productType: 'credits',
          userId: user.id,
          credits: 25,
        }),
      });
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) window.location.href = checkoutUrl;
    } catch (e) {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
      {loading ? 'Redirecting...' : 'Buy 25 Credits — $5'}
    </button>
  );
}