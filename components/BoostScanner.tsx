'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useCompletion } from 'ai/react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Loader2, Wand2, Download, Lock, ChevronLeft, ChevronRight,
  Image as ImageIcon, Upload, Copy, Check, Coins, Crown,
  ShieldCheck, RefreshCw, Sparkles, XCircle, X, ZoomIn,
  AlertCircle, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseAnalysisStream } from '@/utils/parseAnalysisStream';
import { createClient } from '@/utils/supabase/client';
import { useAuthModal } from '@/components/auth/auth-modal-context';
import AnalysisResultCard from '@/components/AnalysisResultCard';
import UsageGuideCard from '@/components/UsageGuideCard';

// ═══════════════════════════════════════════════════════════════
// components/BoostScanner.tsx — v9
//
// v9 changes vs v8:
// 1. [NEW] download_unlock modal — $1.99 micro pack as primary CTA
// 2. [NEW] MicroPackCheckoutButton component
// 3. [FIX] all checkout buttons: loading state stays in modal until redirect
// 4. [FIX] credits insufficient → download_unlock instead of credits_shop
// 5. All original v8 logic preserved
// ═══════════════════════════════════════════════════════════════

async function compressImage(file: File, options?: { maxSize?: number; quality?: number }): Promise<string> {
  const { maxSize = 1024, quality = 0.75 } = options || {};
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
  return canvas.toDataURL('image/jpeg', quality);
}

const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) window.gtag('event', eventName, params);
};
const dispatchCreditsUpdate = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'));
};

// [v9] added 'download_unlock' modal type
type ModalType = 'enhance' | 'download_choice' | 'download_unlock' | 'membership' | 'credits_shop' | 'privacy_exit' | 'free_limit' | 'enhance_failed';
type SelectedPanel = 'original' | 'enhanced';

export default function BoostScanner() {
  const [preview, setPreview] = useState<string | null>(null);
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
  const [isUploadHovered, setIsUploadHovered] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxTouchStartX = useRef<number | null>(null);
  const lightboxTouchEndX = useRef<number | null>(null);

  const hasActiveResult = !!(preview && (visibleText || watermarkedImage || isGuestEnhanced));
  const showEnhanced = !!(watermarkedImage || isGuestEnhanced);
  const isCompact = !!(visibleText && preview);
  const isEnhancementComplete = !!(enhancementId && !isGuestEnhanced);

  const pendingNavigationRef = useRef<string | null>(null);
  const skipExitWarningRef = useRef(false);
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
    const savedPreview = sessionStorage.getItem('mf_preview') || localStorage.getItem('mf_preview');
    const savedText = sessionStorage.getItem('mf_visibleText') || localStorage.getItem('mf_visibleText');
    const savedJSON = sessionStorage.getItem('mf_analysisJSON') || localStorage.getItem('mf_analysisJSON');
    const guestFlag = localStorage.getItem('mf_guest_enhanced');
    if (savedPreview) { setPreview(savedPreview); sessionStorage.setItem('mf_preview', savedPreview); }
    if (savedText) { setVisibleText(savedText); sessionStorage.setItem('mf_visibleText', savedText); }
    if (savedJSON) { setAnalysisJSON(savedJSON); sessionStorage.setItem('mf_analysisJSON', savedJSON); }
    const savedWatermarked = sessionStorage.getItem('mf_watermarkedImage');
    const savedEnhancementId = sessionStorage.getItem('mf_enhancementId');
    const savedMimeType = sessionStorage.getItem('mf_enhancedMimeType');
    const savedFreeTrial = sessionStorage.getItem('mf_isFreeGeneration');
    const savedDownloadFree = sessionStorage.getItem('mf_isDownloadFree');
    if (savedWatermarked && savedEnhancementId) {
      setWatermarkedImage(savedWatermarked); setEnhancementId(savedEnhancementId);
      if (savedMimeType) setEnhancedMimeType(savedMimeType);
      setIsFreeGeneration(savedFreeTrial === 'true'); setIsDownloadFree(savedDownloadFree === 'true');
      setSliderIndex(1); setSelectedPanel('enhanced');
    }
    if (guestFlag === 'true' && savedPreview) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) { setIsGuestEnhanced(true); setSliderIndex(1); setSelectedPanel('enhanced'); sessionStorage.setItem('mf_pending_enhance', 'true'); }
      });
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') { params.delete('payment'); window.history.replaceState({}, '', params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname); trackEvent('payment_return_success'); dispatchCreditsUpdate(); }
    if (params.get('download_error') === 'insufficient_credits') { params.delete('download_error'); window.history.replaceState({}, '', params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname); setActiveModal('download_unlock'); }
  }, []);

  // ── Auth State ─────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session) fetch('/api/credits').then(r => r.json()).then(data => { if (typeof data.isSubscribed === 'boolean') setIsSubscribed(data.isSubscribed); }).catch(() => { });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
      if (event === 'SIGNED_IN' && session) {
        setIsGuestEnhanced(false); trackEvent('guest_signin_after_enhance');
        const hasPending = sessionStorage.getItem('mf_pending_enhance') === 'true' || localStorage.getItem('mf_pending_enhance') === 'true';
        localStorage.removeItem('mf_pending_enhance'); localStorage.removeItem('mf_guest_enhanced'); localStorage.removeItem('mf_preview'); localStorage.removeItem('mf_analysisJSON'); localStorage.removeItem('mf_visibleText');
        if (hasPending) { sessionStorage.removeItem('mf_pending_enhance'); handleEnhance(sessionStorage.getItem('mf_analysisJSON') || analysisJSON, (sessionStorage.getItem('mf_visibleText') || visibleText) ?? undefined); }
        dispatchCreditsUpdate();
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, analysisJSON, visibleText]);

  // ── 三重拦截 ───────────────────────────────────────────────
  useEffect(() => { if (!hasActiveResult) return; const h = (e: BeforeUnloadEvent) => { if (!skipExitWarningRef.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [hasActiveResult]);
  useEffect(() => { if (!hasActiveResult) return; window.history.pushState({ matchfixGuard: true }, ''); const h = () => { if (!skipExitWarningRef.current) { window.history.pushState({ matchfixGuard: true }, ''); pendingNavigationRef.current = '__back__'; setActiveModal('privacy_exit'); } }; window.addEventListener('popstate', h); return () => window.removeEventListener('popstate', h); }, [hasActiveResult]);
  useEffect(() => { if (!hasActiveResult) return; const h = (e: MouseEvent) => { if (skipExitWarningRef.current) return; const a = (e.target as HTMLElement).closest('a'); if (!a) return; const href = a.getAttribute('href'); if (!href) return; if (!(a.origin === window.location.origin || href.startsWith('/') || href.startsWith('#'))) return; if (href === pathname || href === '#') return; e.preventDefault(); e.stopPropagation(); pendingNavigationRef.current = href; setActiveModal('privacy_exit'); }; document.addEventListener('click', h, true); return () => document.removeEventListener('click', h, true); }, [hasActiveResult, pathname]);

  useEffect(() => {
    if (isCompact) {
      const hero = document.getElementById('scanner-hero');
      if (hero) hero.style.display = 'none';
    }
  }, [isCompact]);

  // ── Reset ──────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setPreview(null); setWatermarkedImage(null); setEnhancementId(null); setIsGuestEnhanced(false); setIsFreeGeneration(false); setIsDownloadFree(false); setEnhanceError(null); setSliderIndex(0); setVisibleText(''); setAnalysisJSON(null); setSelectedPanel('original'); setLightboxOpen(false); setLightboxIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    ['mf_preview', 'mf_visibleText', 'mf_analysisJSON', 'mf_pending_enhance', 'mf_watermarkedImage', 'mf_enhancementId', 'mf_enhancedMimeType', 'mf_isFreeGeneration', 'mf_isDownloadFree'].forEach(k => sessionStorage.removeItem(k));
    ['mf_pending_enhance', 'mf_guest_enhanced', 'mf_preview', 'mf_analysisJSON', 'mf_visibleText'].forEach(k => localStorage.removeItem(k));
    trackEvent('boost_image_reset');
    const hero = document.getElementById('scanner-hero');
    if (hero) hero.style.display = '';
  }, []);

  const handlePrivacyExitConfirm = useCallback(() => { const t = pendingNavigationRef.current; skipExitWarningRef.current = true; setActiveModal(null); handleReset(); if (t === '__back__') window.history.back(); else if (t) router.push(t); setTimeout(() => { skipExitWarningRef.current = false; pendingNavigationRef.current = null; }, 200); }, [handleReset, router]);
  const handlePrivacyExitCancel = useCallback(() => { setActiveModal(null); pendingNavigationRef.current = null; }, []);
  const handleTryAnother = useCallback(() => { pendingNavigationRef.current = null; setActiveModal('privacy_exit'); }, []);
  const handleTryAnotherConfirm = useCallback(() => { setActiveModal(null); handleReset(); skipExitWarningRef.current = false; pendingNavigationRef.current = null; }, [handleReset]);

  // ── Enhance ────────────────────────────────────────────────
  const handleEnhance = async (jsonFromFinish?: string | null, textFromFinish?: string) => {
    if (!preview) return;
    const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsGuestEnhanced(true); setSliderIndex(1); setSelectedPanel('enhanced'); sessionStorage.setItem('mf_pending_enhance', 'true'); localStorage.setItem('mf_pending_enhance', 'true'); localStorage.setItem('mf_guest_enhanced', 'true'); if (preview) localStorage.setItem('mf_preview', preview); if (analysisJSON) localStorage.setItem('mf_analysisJSON', analysisJSON); if (visibleText) localStorage.setItem('mf_visibleText', visibleText); return; }
    setIsEnhancing(true); setEnhanceError(null); trackEvent('enhance_start_click');
    try {
      const res = await fetch('/api/enhance-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: preview.split(',')[1], mimeType: 'image/jpeg', analysisResult: jsonFromFinish ?? analysisJSON ?? textFromFinish ?? visibleText ?? '' }) });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS') { setActiveModal('enhance'); return; }
        const msg = data.error || 'Unknown error';
        setEnhanceError(msg);
        setSliderIndex(0);
        setSelectedPanel('original');
        setIsGuestEnhanced(false);
        setActiveModal('enhance_failed');
        trackEvent('enhance_failed', { reason: msg });
        return;
      }
      setWatermarkedImage(data.watermarkedImage); setEnhancementId(data.enhancementId); setEnhancedMimeType(data.mimeType ?? 'image/png'); setIsFreeGeneration(data.isFreeTrial); setIsDownloadFree(data.downloadFree ?? false);
      sessionStorage.setItem('mf_watermarkedImage', data.watermarkedImage); sessionStorage.setItem('mf_enhancementId', data.enhancementId); sessionStorage.setItem('mf_enhancedMimeType', data.mimeType ?? 'image/png'); sessionStorage.setItem('mf_isFreeGeneration', String(data.isFreeTrial)); sessionStorage.setItem('mf_isDownloadFree', String(data.downloadFree ?? false));
      setIsGuestEnhanced(false); setSliderIndex(1); setSelectedPanel('enhanced'); dispatchCreditsUpdate(); router.refresh(); trackEvent('enhance_complete', { status: 'success' });
    } catch {
      setEnhanceError('Network error. Please try again.');
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
    onFinish: (_prompt, fullCompletion) => {
      const { visibleText: text, analysisJSON: json } = parseAnalysisStream(fullCompletion);
      setVisibleText(text); setAnalysisJSON(json); sessionStorage.setItem('mf_visibleText', text); if (json) sessionStorage.setItem('mf_analysisJSON', json);
      trackEvent('boost_complete', { status: 'success' });
      fetch('/api/meta-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: `lead_${Date.now()}` }) }).catch(err => console.error('[Meta CAPI] Lead event failed:', err));
      dispatchCreditsUpdate(); router.refresh(); handleEnhance(json, text);
    },
    onError: (error) => { try { const d = JSON.parse(error.message); if (d.code === 'INSUFFICIENT_CREDITS' || (d.error && d.error.includes('Insufficient credits'))) { trackEvent('boost_failed', { reason: 'insufficient_credits' }); setActiveModal('enhance'); return; } alert('Oops: ' + (d.error || 'Something went wrong.')); } catch (e) { if (error.message.includes('402')) setActiveModal('enhance'); else alert('Oops, something went wrong: ' + error.message); } }
  });
  const displayText = isLoading ? parseAnalysisStream(completion).visibleText : visibleText;
  const handleCopy = () => { if (!visibleText) return; navigator.clipboard.writeText(visibleText); setIsCopied(true); trackEvent('boost_copy_result'); setTimeout(() => setIsCopied(false), 2000); };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert('We only boost images. Upload a valid photo.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File too large. (Max 10MB)'); return; }
    trackEvent('boost_image_selected', { file_size: Math.round(file.size / 1024) });
    const compressed = await compressImage(file, { maxSize: 1024, quality: 0.75 });
    setPreview(compressed); setWatermarkedImage(null); setEnhancementId(null); setIsGuestEnhanced(false); setIsFreeGeneration(false); setIsDownloadFree(false); setEnhanceError(null); setSliderIndex(0); setSelectedPanel('original');
    sessionStorage.setItem('mf_preview', compressed); sessionStorage.removeItem('mf_visibleText'); sessionStorage.removeItem('mf_analysisJSON');
    const hero = document.getElementById('scanner-hero');
    if (hero) hero.style.display = '';
  };

  const handleSubmit = async () => {
    if (!preview || isLoading) return;
    if (!isLoggedIn) { const FREE_LIMIT = 3; const used = parseInt(localStorage.getItem('mf_free_analyses') || '0', 10); if (used >= FREE_LIMIT) { trackEvent('free_limit_reached', { used }); setActiveModal('free_limit'); return; } localStorage.setItem('mf_free_analyses', String(used + 1)); }
    setActiveModal(null); setVisibleText(''); setAnalysisJSON(null); setWatermarkedImage(null); setEnhancementId(null); setIsGuestEnhanced(false); setIsFreeGeneration(false); setIsDownloadFree(false); setEnhanceError(null); setSliderIndex(0); setSelectedPanel('original');
    sessionStorage.removeItem('mf_visibleText'); sessionStorage.removeItem('mf_analysisJSON'); trackEvent('boost_start_click');
    await complete('', { body: { imageBase64: preview.split(',')[1], mimeType: 'image/jpeg' } });
  };

  // ── Download ───────────────────────────────────────────────
  const handleDownload = () => { if (!enhancementId) return; trackEvent('enhance_download_click', { isDownloadFree, isFreeGeneration }); if (isFreeGeneration && !isDownloadFree) handleDownloadWithPrecheck(); else { window.location.href = `/api/download/${enhancementId}`; dispatchCreditsUpdate(); } };
  // [v9] insufficient credits → download_unlock instead of credits_shop
  const handleDownloadWithPrecheck = async () => {
    if (!enhancementId) return;
    setIsDownloading(true);
    try {
      const cr = await fetch('/api/credits');
      if (cr.ok) {
        const cd = await cr.json();
        const s = createClient();
        const { data: { user } } = await s.auth.getUser();
        if (user && cd.isSubscribed) {
          window.location.href = `/api/download/${enhancementId}`;
          trackEvent('enhance_download_precheck_ok');
          dispatchCreditsUpdate(); router.refresh();
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
  const handleDownloadWatermarked = () => { if (!watermarkedImage) return; if (enhancementId) window.location.href = `/api/download/${enhancementId}?watermarked=1`; else { const l = document.createElement('a'); l.href = `data:${enhancedMimeType};base64,${watermarkedImage}`; l.download = 'matchfix-enhanced-watermark.png'; l.click(); } setActiveModal(null); trackEvent('enhance_download_watermark_free'); };
  const handleDownloadWithCredits = async () => {
    if (!enhancementId) return;
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
      window.location.href = `/api/download/${enhancementId}`;
      trackEvent('enhance_download_credits_success');
      dispatchCreditsUpdate();
      router.refresh();
    } catch {
      setActiveModal('download_unlock');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => { if (touchStartX.current === null || touchEndX.current === null) return; const diff = touchStartX.current - touchEndX.current; if (Math.abs(diff) > 40) { if (diff > 0 && sliderIndex < 1) { setSliderIndex(1); setSelectedPanel('enhanced'); } if (diff < 0 && sliderIndex > 0) { setSliderIndex(0); setSelectedPanel('original'); } } touchStartX.current = null; touchEndX.current = null; };
  const selectOriginal = () => { setSelectedPanel('original'); setSliderIndex(0); };
  const selectEnhanced = () => { setSelectedPanel('enhanced'); setSliderIndex(1); };

  const isOriginalSelected = selectedPanel === 'original';
  const downloadButtonText = isDownloadFree ? 'Download Enhanced Photo' : isFreeGeneration ? 'Download Photo' : 'Download Enhanced Photo';
  const imgHeightClass = isCompact ? 'max-h-[240px] md:max-h-[280px]' : 'min-h-[300px] md:min-h-[360px]';

  // ── Lightbox ───────────────────────────────────────────────
  const openLightbox = (src: string) => {
    if (isGuestEnhanced) return;
    const idx = lightboxImages.findIndex(img => img.src === src);
    setLightboxIndex(idx >= 0 ? idx : 0);
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

  // Overlays
  const ScanningOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute left-0 right-0 h-0.5 bg-rose-500" style={{ boxShadow: '0 0 20px 6px rgba(244,63,94,0.6)', animation: 'scanLine 2s linear infinite' }} /></div>
      <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
        <div className="flex space-x-1.5"><div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div>
        <p className="text-white font-semibold text-base animate-pulse">AI is analyzing your photo...</p>
        <p className="text-white/50 text-sm">Usually done within 10 seconds</p>
      </div>
    </div>
  );
  const EnhancingOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" style={{ boxShadow: '0 0 20px 6px rgba(52,211,153,0.5)', animation: 'scanLine 1.5s linear infinite' }} /></div>
      <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center"><Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /><p className="text-white font-semibold text-base animate-pulse">Enhancing your photo...</p><p className="text-white/50 text-sm">Ready in under 10 seconds</p></div>
    </div>
  );
  const GuestLockOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center bg-black/50 backdrop-blur-[2px]">
      <div className="grid size-12 place-items-center rounded-full bg-white/10 border border-white/20 backdrop-blur-sm"><Lock className="size-5 text-white" /></div>
      <div><p className="text-white font-bold text-base">Sign in to view full preview</p><p className="text-white/50 text-xs mt-1">Your enhanced photo is ready</p></div>
      <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90 font-bold gap-2 px-6 rounded-xl shadow-lg" onClick={() => openAuthModal('sign-up')}>Sign in</Button>
    </div>
  );

  return (
    <div className="w-full text-foreground relative">
      <div className="mx-auto flex w-full flex-col gap-4">

        {/* ═══ DESKTOP: Initial upload ═══ */}
        {!preview && (
          <div className="hidden md:grid md:grid-cols-2 gap-5 items-stretch">
            <div role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()} onMouseEnter={() => setIsUploadHovered(true)} onMouseLeave={() => setIsUploadHovered(false)}
              className="group relative rounded-2xl border-[3px] border-dashed border-rose-500/50 bg-rose-500/[0.04] hover:border-rose-500/80 hover:bg-rose-500/[0.08] cursor-pointer transition-all duration-500 overflow-hidden min-h-[420px] flex flex-col items-center justify-center gap-6 px-8">
              <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(ellipse at center, rgba(244,63,94,0.12) 0%, transparent 65%)', animation: 'uploadPulse 2.5s ease-in-out infinite' }} />
              <div className={`relative grid size-24 place-items-center rounded-3xl bg-rose-500/15 border-2 border-rose-500/30 shadow-2xl shadow-rose-500/20 transition-all duration-500 ${isUploadHovered ? 'shadow-rose-500/40 scale-105 bg-rose-500/20' : ''}`}><Upload className={`size-10 transition-colors duration-300 ${isUploadHovered ? 'text-rose-300' : 'text-rose-400'}`} /></div>
              <div className="relative text-center space-y-2"><div className="text-xl font-bold text-white">Drop your main profile photo</div><div className="text-base text-slate-400 group-hover:text-slate-300 transition-colors">or click to browse</div></div>
              <div className="relative text-xs text-slate-500 mt-1">We enhance lighting, framing & color — your face stays 100% real</div>
              <div className="relative text-sm text-slate-600">JPG / PNG · Max 10 MB</div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>
            <div className="rounded-2xl border border-slate-800/30 bg-slate-900/30 min-h-[420px] flex flex-col items-center justify-center gap-4 px-8 opacity-30">
              <div className="grid size-16 place-items-center rounded-2xl bg-slate-800/40 border border-slate-700/30"><Sparkles className="size-7 text-slate-600" /></div>
              <div className="text-center"><div className="text-base text-slate-500 font-medium">Your enhanced photo will appear here</div></div>
            </div>
          </div>
        )}

        {/* ═══ DESKTOP: After upload ═══ */}
        {preview && (
          <div className="hidden md:grid md:grid-cols-2 gap-5">
            <div onClick={showEnhanced ? selectOriginal : undefined}
              className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${showEnhanced ? 'cursor-pointer' : ''} ${showEnhanced ? isOriginalSelected ? 'border-rose-500/60 shadow-lg shadow-rose-500/10' : 'border-slate-800/40 opacity-60 hover:opacity-90' : 'border-slate-800/40'} bg-gradient-to-b from-slate-900/80 to-slate-950/90`}>
              {showEnhanced && <div className={`text-center py-2 text-sm font-bold tracking-wide transition-colors ${isOriginalSelected ? 'text-rose-400 bg-rose-500/10' : 'text-slate-600'}`}>ORIGINAL</div>}
              <div className="px-4 pb-4">
                <div className={`relative w-full overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/60 flex items-center justify-center transition-all duration-500 ${imgHeightClass}`}>
                  <img src={preview} alt="Original" className={`w-full object-contain p-2 cursor-pointer ${isCompact ? 'max-h-[240px] md:max-h-[280px]' : 'h-full'}`} onClick={() => openLightbox(preview!)} />
                  {isCompact && <div className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-black/50 text-white/60 pointer-events-none"><ZoomIn className="size-3.5" /></div>}
                  {isLoading && <ScanningOverlay />}
                </div>
                {!isLoading && !isEnhancing && !showEnhanced && (
                  <div className="flex flex-col gap-3 mt-4">
                    <button type="button" onClick={handleSubmit} disabled={isLoading || isEnhancing}
                      className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99]">
                      <Wand2 className="w-5 h-5" /> Enhance Photo
                      <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-semibold">{isLoggedIn ? (isSubscribed ? '⚡ 20' : '⚡ 25') : 'Free'}</span>
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-10 rounded-xl text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 flex items-center justify-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Change photo</button>
                  </div>
                )}
              </div>
            </div>
            <div onClick={showEnhanced ? selectEnhanced : undefined}
              className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${showEnhanced ? !isOriginalSelected ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10 cursor-pointer' : 'border-slate-800/40 opacity-60 hover:opacity-90 cursor-pointer' : 'border-slate-800/20'} bg-gradient-to-b from-slate-900/80 to-slate-950/90`}>
              {showEnhanced && <div className={`text-center py-2 text-sm font-bold tracking-wide transition-colors ${!isOriginalSelected ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-600'}`}>AI ENHANCED</div>}
              <div className="px-4 pb-4">
                <div className={`relative w-full overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/40 flex items-center justify-center transition-all duration-500 ${imgHeightClass}`}>
                  {showEnhanced ? (
                    <div className="relative h-full w-full">
                      <img src={enhancedSrc || preview!} alt="Enhanced" className={`w-full object-contain p-2 ${isGuestEnhanced ? '' : 'cursor-pointer'} ${isCompact ? 'max-h-[240px] md:max-h-[280px]' : 'h-full'}`} style={isGuestEnhanced ? { filter: 'blur(14px)', transform: 'scale(1.04)' } : {}} onClick={() => enhancedSrc && openLightbox(enhancedSrc)} />
                      <div className="absolute top-3 left-3 bg-emerald-500/80 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-400/20 flex items-center gap-1"><Sparkles className="size-3" /> AI Enhanced</div>
                      {isCompact && !isGuestEnhanced && <div className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-black/50 text-white/60 pointer-events-none"><ZoomIn className="size-3.5" /></div>}
                      {isGuestEnhanced && <GuestLockOverlay />}
                    </div>
                  ) : isEnhancing ? (
                    <div className="relative w-full h-full min-h-[200px]"><EnhancingOverlay /></div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-center px-6 opacity-30"><div className="grid size-16 place-items-center rounded-2xl bg-slate-800/40 border border-slate-700/30"><Sparkles className="size-7 text-slate-600" /></div><div className="text-base text-slate-500">Your enhanced photo will appear here</div></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

        {/* ═══ MOBILE ═══ */}
        <div className="md:hidden">
          {!preview ? (
            <div role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()}
              className="group relative rounded-2xl border-[3px] border-dashed border-rose-500/50 bg-rose-500/[0.04] active:bg-rose-500/[0.08] cursor-pointer min-h-[340px] flex flex-col items-center justify-center gap-5 px-6 overflow-hidden">
              <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(ellipse at center, rgba(244,63,94,0.12) 0%, transparent 65%)', animation: 'uploadPulse 2.5s ease-in-out infinite' }} />
              <div className="relative grid size-20 place-items-center rounded-3xl bg-rose-500/15 border-2 border-rose-500/30 shadow-xl shadow-rose-500/20"><Upload className="size-8 text-rose-400" /></div>
              <div className="relative text-center space-y-1.5"><div className="text-lg font-bold text-white">Tap to upload your profile photo</div><div className="text-xs text-slate-500">Your face stays 100% real — we just fix the lighting</div><div className="text-sm text-slate-600 mt-2">JPG / PNG · Max 10 MB</div></div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-b from-slate-900/80 to-slate-950/90 overflow-hidden">
              {showEnhanced && (
                <div className="grid grid-cols-2 border-b border-slate-800/40">
                  <button onClick={selectOriginal} className={`py-2.5 text-sm font-bold tracking-wide transition-colors ${isOriginalSelected ? 'text-rose-400 bg-rose-500/10 border-b-2 border-rose-500' : 'text-slate-600'}`}>ORIGINAL</button>
                  <button onClick={selectEnhanced} className={`py-2.5 text-sm font-bold tracking-wide transition-colors ${!isOriginalSelected ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-500' : 'text-slate-600'}`}>AI ENHANCED</button>
                </div>
              )}
              <div className="px-4 pb-4 pt-3">
                <div className={`relative w-full overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/60 transition-all duration-500 ${isCompact ? 'max-h-[220px]' : 'min-h-[300px]'}`}
                  onTouchStart={showEnhanced ? handleTouchStart : undefined} onTouchMove={showEnhanced ? handleTouchMove : undefined} onTouchEnd={showEnhanced ? handleTouchEnd : undefined}>
                  <div style={{ display: sliderIndex === 0 ? 'block' : 'none' }} className="relative h-full w-full">
                    <img src={preview} alt="Original" className={`w-full object-contain p-2 ${isCompact ? 'max-h-[220px]' : ''}`} onClick={() => openLightbox(preview!)} />
                    {showEnhanced && <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-white/10">Original</div>}
                    <div className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-black/50 text-white/60 pointer-events-none"><ZoomIn className="size-3.5" /></div>
                  </div>
                  {showEnhanced && (
                    <div style={{ display: sliderIndex === 1 ? 'block' : 'none' }}>
                      <div className="relative h-full w-full">
                        <img src={enhancedSrc || preview!} alt="Enhanced" className={`w-full object-contain p-2 ${isCompact ? 'max-h-[220px]' : ''}`} style={isGuestEnhanced ? { filter: 'blur(14px)', transform: 'scale(1.04)' } : {}} onClick={() => enhancedSrc && !isGuestEnhanced && openLightbox(enhancedSrc)} />
                        <div className="absolute top-3 left-3 bg-emerald-500/80 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-400/20 flex items-center gap-1"><Sparkles className="size-3" /> AI Enhanced</div>
                        {!isGuestEnhanced && <div className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-black/50 text-white/60 pointer-events-none"><ZoomIn className="size-3.5" /></div>}
                        {isGuestEnhanced && <GuestLockOverlay />}
                      </div>
                    </div>
                  )}
                  {isLoading && <ScanningOverlay />}
                  {isEnhancing && <EnhancingOverlay />}
                  {showEnhanced && !isLoading && !isEnhancing && (
                    <><button className="absolute left-2 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 disabled:opacity-20 border border-white/10" onClick={selectOriginal} disabled={sliderIndex === 0}><ChevronLeft className="w-4 h-4" /></button><button className="absolute right-2 top-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 disabled:opacity-20 border border-white/10" onClick={selectEnhanced} disabled={sliderIndex === 1}><ChevronRight className="w-4 h-4" /></button></>
                  )}
                </div>
                {showEnhanced && (
                  <div className="flex items-center justify-center gap-2 py-2">{[0, 1].map(i => <button key={i} onClick={() => { setSliderIndex(i); setSelectedPanel(i === 0 ? 'original' : 'enhanced'); }} className={`rounded-full transition-all duration-200 ${sliderIndex === i ? 'w-5 h-2 bg-rose-500' : 'w-2 h-2 bg-slate-600 hover:bg-slate-500'}`} />)}</div>
                )}
                {!visibleText && !isLoading && !showEnhanced && (
                  <div className="flex flex-col gap-2 mt-3">
                    <button type="button" onClick={handleSubmit} disabled={isLoading || isEnhancing}
                      className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 disabled:opacity-40"><Wand2 className="w-5 h-5" /> Enhance Photo <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-semibold">{isLoggedIn ? (isSubscribed ? '⚡ 20' : '⚡ 25') : 'Free'}</span></button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-9 rounded-xl text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5"><RefreshCw className="w-3 h-3" /> Change photo</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ ACTION BUTTONS ═══ */}
        {(showEnhanced || enhanceError) && (
          <div className="flex flex-col gap-3">
            {isEnhancementComplete && (
              <button onClick={handleDownload} disabled={isDownloading}
                className="w-full h-14 rounded-xl gap-2 font-bold text-base bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center hover:scale-[1.01] active:scale-[0.99]">
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} {downloadButtonText}
              </button>
            )}
            {preview && visibleText && !isLoading && !isEnhancing && (
              <Button type="button" variant="outline" className="w-full h-12 text-slate-400 gap-2 border-slate-700 hover:bg-slate-800/50 rounded-xl text-sm" onClick={handleTryAnother}><RefreshCw className="w-4 h-4" /> Try Another Photo</Button>
            )}
            {isEnhancementComplete && (
              <UsageGuideCard analysisJSON={analysisJSON} />
            )}
            {enhanceError && !activeModal && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5"><span className="text-red-400 text-sm">⚠️ Enhancement failed: {enhanceError}</span><Button size="sm" variant="outline" className="shrink-0 border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-lg text-xs" onClick={() => handleEnhance()}>Retry</Button></div>
            )}
          </div>
        )}

        {/* ═══ CONTENT PANEL ═══ */}
        {isLoading && displayText && (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-2"><span className="text-rose-400 font-semibold text-sm flex items-center gap-2"><span className="grid size-5 place-items-center rounded bg-rose-500/10">🎯</span> Analyzing...</span></div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{displayText}</div>
          </div>
        )}
        {isLoading && !displayText && (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4"><div className="flex items-center gap-2 py-2"><div className="flex space-x-1"><div className="w-1.5 h-1.5 bg-rose-500/60 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-rose-500/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><div className="w-1.5 h-1.5 bg-rose-500/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div></div></div>
        )}
        {visibleText && !isLoading && (
          <AnalysisResultCard analysisJSON={analysisJSON} visibleText={visibleText} onCopy={handleCopy} isCopied={isCopied} />
        )}

        {/* ═══ LIGHTBOX ═══ */}
        {lightboxOpen && lightboxImages.length > 0 && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center" onClick={closeLightbox}>
            <button className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10" onClick={closeLightbox}><X className="size-5" /></button>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <span className={`text-sm font-bold px-3 py-1 rounded-full backdrop-blur-sm ${lightboxIndex === 0 ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'}`}>
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
        )}

        <style>{`
          @keyframes scanLine { 0% { top: 0%; } 100% { top: 100%; } }
          @keyframes uploadPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        `}</style>
      </div>

      {/* ═══ MODALS ═══ */}
      {activeModal === 'privacy_exit' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="w-full max-w-sm p-6 mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"><div className="grid size-16 place-items-center rounded-full bg-emerald-500/10 mb-4 border border-emerald-500/20"><ShieldCheck className="size-8 text-emerald-500" /></div><h2 className="text-xl font-bold text-white mb-2">Your Privacy Matters</h2><p className="text-sm text-slate-400 mb-1 leading-relaxed">To protect your privacy, <span className="font-semibold text-slate-200">we never store any photos</span> on our servers.</p><p className="text-sm text-slate-400 mb-6 leading-relaxed">Once you leave this page, your current photo and results will be <span className="font-semibold text-slate-200">permanently deleted</span> and cannot be recovered.</p><div className="flex w-full gap-3"><Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800" onClick={pendingNavigationRef.current ? handlePrivacyExitConfirm : handleTryAnotherConfirm}>{pendingNavigationRef.current ? 'Leave Anyway' : 'Start Over'}</Button><button className="flex-1 h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm transition-all" onClick={handlePrivacyExitCancel}>Stay on Page</button></div></div></div>)}
      {activeModal === 'free_limit' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="w-full max-w-sm p-6 mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"><div className="grid size-16 place-items-center rounded-full bg-amber-500/10 mb-4 border border-amber-500/20"><Wand2 className="size-8 text-amber-500" /></div><h2 className="text-xl font-bold text-white mb-2">All 3 Free Analyses Used</h2><p className="text-sm text-slate-400 mb-2 leading-relaxed">Looks like you&apos;re enjoying Matchfix! Create a free account to keep going — it only takes 10 seconds.</p><p className="text-xs text-slate-500 mb-6">Plus, your first AI-enhanced photo is <span className="font-bold text-emerald-400">completely free</span> after sign-up.</p><div className="flex w-full gap-3"><Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setActiveModal(null)}>Maybe Later</Button><button className="flex-1 h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm transition-all" onClick={() => { setActiveModal(null); trackEvent('free_limit_signup_click'); openAuthModal('sign-up'); }}>Sign Up Free</button></div></div></div>)}
      {activeModal === 'enhance' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"><div className="w-full max-w-sm p-6 mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"><div className="grid size-16 place-items-center rounded-full bg-rose-500/10 mb-4 border border-rose-500/20"><Coins className="size-8 text-rose-500" /></div><h2 className="text-xl font-bold text-white mb-2">Credits Needed</h2><p className="text-sm text-slate-400 mb-2 leading-relaxed">AI photo enhancement costs <span className="font-bold text-slate-200">20 credits</span> for members or <span className="font-bold text-slate-200">25 credits</span> with a credit pack.</p><p className="text-xs text-slate-500 mb-6">Members save 5 credits per photo + get free watermark-free downloads.</p><div className="flex w-full gap-3"><Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setActiveModal(null)}>Cancel</Button><button className="flex-1 h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm transition-all" onClick={() => { setActiveModal(null); trackEvent('upgrade_modal_click_refill'); router.push('/subscribe?returnPath=' + encodeURIComponent(pathname)); }}>Get Credits</button></div></div></div>)}

      {/* enhance_failed modal */}
      {activeModal === 'enhance_failed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-full bg-amber-500/10 mb-4 border border-amber-500/20">
              <AlertCircle className="size-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Enhancement Couldn&apos;t Complete</h2>
            <p className="text-sm text-slate-400 mb-2 leading-relaxed">
              Our AI works best with <span className="font-semibold text-slate-200">clear portrait photos</span> — face visible, decent lighting, minimal obstruction.
            </p>
            <p className="text-sm text-slate-400 mb-1 leading-relaxed">
              Don&apos;t worry — if credits were used, they&apos;ve been <span className="font-semibold text-emerald-400">automatically refunded</span>.
            </p>
            <p className="text-xs text-slate-500 mb-6">
              Try uploading a different photo with your face clearly visible.
            </p>
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => { setActiveModal(null); setEnhanceError(null); }}
              >
                Dismiss
              </Button>
              <button
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm transition-all"
                onClick={() => {
                  setActiveModal(null);
                  setEnhanceError(null);
                  handleReset();
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
              >
                Upload New Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ [v9] download_unlock modal — $1.99 micro pack as primary CTA ═══ */}
      {activeModal === 'download_unlock' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">Your photo is ready</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="grid size-7 place-items-center rounded-full hover:bg-slate-800 transition-colors text-slate-400 text-xs">✕</button>
            </div>
            <p className="px-5 text-xs text-slate-500 mb-4">Choose how to save your enhanced photo:</p>

            <div className="px-4 pb-4 flex flex-col gap-2.5">
              {/* ── Option 1: $1.99 Micro Pack (Primary CTA) ── */}
              <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/[0.04] overflow-hidden">
                <div className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold text-center py-1 tracking-widest uppercase">New User Special · One-Time Only</div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-white font-bold text-base">Save This Photo</div>
                      <div className="text-slate-400 text-xs mt-0.5">Watermark-free · Instant download</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-extrabold text-xl">$1.99</div>
                      <div className="text-slate-500 text-[10px]">one-time</div>
                    </div>
                  </div>
                  <MicroPackCheckoutButton returnPath={pathname} />
                </div>
              </div>

              {/* ── Option 2: Pro Membership ── */}
              <button
                onClick={() => setActiveModal('membership')}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
              >
                <div className="grid size-9 place-items-center rounded-full bg-amber-500/10 shrink-0">
                  <Crown className="size-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-200 text-sm">Go Pro — $19.99/mo</div>
                  <div className="text-xs text-slate-500">All downloads free · 200 credits/mo</div>
                </div>
                <span className="text-[10px] font-bold text-amber-500 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-full">BEST VALUE</span>
              </button>

              {/* ── Option 3: Credits Pack ── */}
              <button
                onClick={() => { setActiveModal(null); trackEvent('download_unlock_credits_pack_click'); router.push('/subscribe?returnPath=' + encodeURIComponent(pathname)); }}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-700/40 bg-slate-800/20 hover:bg-slate-800/40 transition-colors text-left"
              >
                <div className="grid size-9 place-items-center rounded-full bg-slate-800 shrink-0">
                  <Coins className="size-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-200 text-sm">Buy Credits Pack</div>
                  <div className="text-xs text-slate-500">From $9.99 · Good for 3+ photos</div>
                </div>
              </button>

              {/* ── Option 4: Watermark download (text link, ultra-subtle) ── */}
              <button
                onClick={handleDownloadWatermarked}
                className="w-full text-center text-xs text-slate-600 hover:text-slate-400 transition-colors py-1.5 underline underline-offset-2 decoration-slate-700"
              >
                or download with watermark (free)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* download_choice modal (for users who already have 5+ credits) */}
      {activeModal === 'download_choice' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"><div className="w-full max-w-sm p-6 mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"><div className="grid size-16 place-items-center rounded-full bg-emerald-500/10 mb-4 border border-emerald-500/20"><Download className="size-8 text-emerald-500" /></div><h2 className="text-xl font-bold text-white mb-1">Save Your Enhanced Photo</h2><p className="text-sm text-slate-400 mb-1">Your photo looks amazing — don&apos;t lose it!</p><p className="text-xs text-red-400/70 mb-4 flex items-center gap-1 justify-center"><ShieldCheck className="size-3" /> We don&apos;t store photos. Leave this page and it&apos;s gone forever.</p><div className="flex flex-col w-full gap-2.5"><button onClick={() => setActiveModal('membership')} className="w-full flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"><div className="grid size-10 place-items-center rounded-full bg-amber-500/10 shrink-0"><Crown className="size-5 text-amber-500" /></div><div className="flex-1 min-w-0"><div className="font-semibold text-slate-200 text-sm">Become a Member</div><div className="text-xs text-slate-500">No watermark · Free downloads forever</div></div><span className="text-[10px] font-bold text-amber-500 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-full">BEST</span></button><button onClick={handleDownloadWithCredits} className="w-full flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-colors text-left"><div className="grid size-10 place-items-center rounded-full bg-rose-500/10 shrink-0"><Coins className="size-5 text-rose-500" /></div><div className="flex-1 min-w-0"><div className="font-semibold text-slate-200 text-sm">Use 5 Credits</div><div className="text-xs text-slate-500">No watermark · One-time purchase</div></div><span className="text-xs font-bold text-rose-400 shrink-0">⚡ 5</span></button><button onClick={handleDownloadWatermarked} className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 transition-colors text-left"><div className="grid size-10 place-items-center rounded-full bg-slate-800 shrink-0"><Download className="size-5 text-slate-400" /></div><div className="flex-1 min-w-0"><div className="font-semibold text-slate-200 text-sm">Download with Watermark</div><div className="text-xs text-slate-500">Free · Includes Matchfix branding</div></div><span className="text-[10px] font-bold text-slate-500 shrink-0">FREE</span></button></div><button className="mt-4 w-full h-10 text-sm text-slate-500 hover:text-slate-300 transition-colors" onClick={() => setActiveModal(null)}>Cancel</button></div></div>)}

      {/* membership modal — [v9] checkout button now stays open with loading */}
      {activeModal === 'membership' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"><div className="flex items-center justify-between px-5 pt-5 pb-3"><div className="flex items-center gap-2"><Crown className="size-4 text-amber-500" /><span className="text-sm font-bold text-white">Become a Member</span></div><button onClick={() => setActiveModal(null)} className="grid size-7 place-items-center rounded-full hover:bg-slate-800 transition-colors text-slate-400 text-xs">✕</button></div><div className="mx-4 mb-4 rounded-xl border border-rose-500/30 bg-slate-900 overflow-hidden"><div className="bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-bold text-center py-1.5 tracking-wide">✦ MOST POPULAR ✦</div><div className="p-5"><div className="flex items-start justify-between mb-3"><div><div className="text-white font-bold text-lg">Pro</div><div className="text-slate-400 text-xs mt-0.5">200 credits / month</div></div><div className="text-right"><div className="text-white font-extrabold text-2xl">$19.99</div><div className="text-slate-500 text-xs">/month</div></div></div><ul className="space-y-2 mb-5">{['Enhance up to 10 photos per month', 'Unlimited watermark-free downloads', 'Save 5 credits/photo vs credit packs', 'AI photo analysis included free', 'Credits never expire'].map((f, i) => <li key={i} className="flex items-center gap-2 text-xs text-slate-300"><Check className="size-3.5 text-emerald-500 shrink-0" />{f}</li>)}</ul><MembershipCheckoutButton returnPath={pathname} /></div></div><div className="px-4 pb-5 text-center"><button onClick={() => { setActiveModal(null); router.push('/subscribe?returnPath=' + encodeURIComponent(pathname)); }} className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2">View all plans →</button></div></div></div>)}

      {/* credits_shop modal — [v9] kept as fallback, checkout button now stays open with loading */}
      {activeModal === 'credits_shop' && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"><div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"><div className="flex items-center justify-between px-5 pt-5 pb-3"><div className="flex items-center gap-2"><Coins className="size-4 text-rose-500" /><span className="text-sm font-bold text-white">Get Credits</span></div><button onClick={() => setActiveModal(null)} className="grid size-7 place-items-center rounded-full hover:bg-slate-800 transition-colors text-slate-400 text-xs">✕</button></div><div className="mx-4 mb-4 rounded-xl border border-rose-500/30 bg-slate-900 overflow-hidden"><div className="bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-bold text-center py-1.5 tracking-wide">✦ QUICKEST OPTION ✦</div><div className="p-5"><div className="flex items-start justify-between mb-3"><div><div className="text-white font-bold text-lg">Starter Pack</div><div className="text-slate-400 text-xs mt-0.5">Try it out — enough for 3 full photo enhancements.</div></div><div className="text-right"><div className="text-white font-extrabold text-2xl">$9.99</div><div className="text-slate-500 text-xs">one-time</div></div></div><ul className="space-y-2 mb-5">{['75 Credits', 'Enhance up to 3 photos', 'Watermark-free downloads included', 'Credits never expire'].map((f, i) => <li key={i} className="flex items-center gap-2 text-xs text-slate-300"><Check className="size-3.5 text-emerald-500 shrink-0" />{f}</li>)}</ul><CreditsCheckoutButton returnPath={pathname} /></div></div><div className="px-4 pb-5 text-center"><button onClick={() => { setActiveModal(null); router.push('/subscribe?returnPath=' + encodeURIComponent(pathname)); }} className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2">View all credit packs →</button></div></div></div>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// [v9] Checkout Buttons — loading state stays in modal until redirect
// ═══════════════════════════════════════════════════════════════

function MembershipCheckoutButton({ returnPath }: { returnPath: string }) {
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
        className="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70">
        {loading ? <><Loader2 className="size-4 animate-spin" /> Redirecting to checkout...</> : <><Crown className="size-4" /> Get Pro — $19.99/mo</>}
      </button>
      {error && <p className="text-red-400 text-xs text-center">Something went wrong. Please try again.</p>}
    </div>
  );
}

function CreditsCheckoutButton({ returnPath }: { returnPath: string }) {
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
        className="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70">
        {loading ? <><Loader2 className="size-4 animate-spin" /> Redirecting to checkout...</> : <><Coins className="size-4" /> Buy 75 Credits — $9.99</>}
      </button>
      {error && <p className="text-red-400 text-xs text-center">Something went wrong. Please try again.</p>}
    </div>
  );
}

// [v9] NEW: $1.99 Micro Pack checkout button
function MicroPackCheckoutButton({ returnPath }: { returnPath: string }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const handleClick = async () => {
    setLoading(true); setError(false);
    trackEvent('micro_pack_checkout_click');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/sign-in'; return; }
      const res = await fetch('/api/creem/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: process.env.NEXT_PUBLIC_PRODUCT_ID_PACK_MICRO!, productType: 'credits', userId: user.id, credits: 5, returnPath }) });
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) { window.location.href = checkoutUrl; }
      else { setError(true); setLoading(false); }
    } catch (e) { setError(true); setLoading(false); }
  };
  return (
    <div className="flex flex-col gap-1">
      <button onClick={handleClick} disabled={loading}
        className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70 shadow-lg shadow-emerald-500/20">
        {loading ? <><Loader2 className="size-4 animate-spin" /> Redirecting to checkout...</> : <><Zap className="size-4" /> Get This Photo — $1.99</>}
      </button>
      {error && <p className="text-red-400 text-xs text-center">Something went wrong. Please try again.</p>}
    </div>
  );
}