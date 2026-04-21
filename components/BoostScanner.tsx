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
// components/BoostScanner.tsx — v9.3
//
// v9.3 changes vs v9.2:
// 1. [NEW] Result Showcase Modal — auto-pops after enhance completes
//    with before/after swipe, shimmer download CTA, urgency copy
// 2. All v9.2 logic preserved — zero changes to existing flows
// ═══════════════════════════════════════════════════════════════

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
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // [v9.2] Auto-start & credit confirm states
  const [autoStartChecking, setAutoStartChecking] = useState(false);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(25);

  // [v9.3] Result Showcase Modal state
  const [showResultShowcase, setShowResultShowcase] = useState(false);
  const [showcaseSlideIndex, setShowcaseSlideIndex] = useState(1); // default to enhanced
  const showcaseTouchStartX = useRef<number | null>(null);
  const showcaseTouchEndX = useRef<number | null>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxTouchStartX = useRef<number | null>(null);
  const lightboxTouchEndX = useRef<number | null>(null);

  // [fusion] 融合开关 — 默认开启，用户可勾掉切回纯 retouch
  const [useFusion, setUseFusion] = useState(true);
  const [sceneTags, setSceneTags] = useState<string | null>(null);

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
    const savedPreview = safeGetItem(sessionStorage, 'mf_preview') || safeGetItem(localStorage, 'mf_preview');
    const savedText = safeGetItem(sessionStorage, 'mf_visibleText') || safeGetItem(localStorage, 'mf_visibleText');
    const savedJSON = safeGetItem(sessionStorage, 'mf_analysisJSON') || safeGetItem(localStorage, 'mf_analysisJSON');
    const guestFlag = safeGetItem(localStorage, 'mf_guest_enhanced');
    if (savedPreview) setPreview(savedPreview);
    if (savedText) setVisibleText(savedText);
    if (savedJSON) setAnalysisJSON(savedJSON);
    // 批量写回 sessionStorage，避免阻塞渲染
    scheduleIdle(() => {
      if (savedPreview) safeSetItem(sessionStorage, 'mf_preview', savedPreview);
      if (savedText) safeSetItem(sessionStorage, 'mf_visibleText', savedText);
      if (savedJSON) safeSetItem(sessionStorage, 'mf_analysisJSON', savedJSON);
    });
    const savedWatermarked = safeGetItem(sessionStorage, 'mf_watermarkedImage');
    const savedEnhancementId = safeGetItem(sessionStorage, 'mf_enhancementId');
    const savedMimeType = safeGetItem(sessionStorage, 'mf_enhancedMimeType');
    const savedFreeTrial = safeGetItem(sessionStorage, 'mf_isFreeGeneration');
    const savedDownloadFree = safeGetItem(sessionStorage, 'mf_isDownloadFree');
    if (savedWatermarked && savedEnhancementId) {
      setWatermarkedImage(savedWatermarked); setEnhancementId(savedEnhancementId);
      if (savedMimeType) setEnhancedMimeType(savedMimeType);
      setIsFreeGeneration(savedFreeTrial === 'true'); setIsDownloadFree(savedDownloadFree === 'true');
      setSliderIndex(1); setSelectedPanel('enhanced');
    }
    if (guestFlag === 'true' && savedPreview) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) { setIsGuestEnhanced(true); setSliderIndex(1); setSelectedPanel('enhanced'); safeSetItem(sessionStorage, 'mf_pending_enhance', 'true'); }
      });
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      params.delete('payment');
      window.history.replaceState({}, '', params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname);
      trackEvent('payment_return_success');
      dispatchCreditsUpdate();
      // [v9 fix] 支付回来后标记，下载时跳过弹窗直接下载
      safeSetItem(sessionStorage, 'mf_payment_just_completed', 'true');

      // [v9.4] 如果是从 Showcase 发起的支付,自动触发下载,不需要用户再点
      const pendingDownloadId = safeGetItem(sessionStorage, 'mf_showcase_pending_download');
      if (pendingDownloadId) {
        safeRemoveItem(sessionStorage, 'mf_showcase_pending_download');
        safeRemoveItem(sessionStorage, 'mf_payment_just_completed');
        trackEvent('showcase_payment_auto_download');
        // 延迟一下,等 credits 状态更新到位
        setTimeout(() => {
          window.location.href = `/api/download/${pendingDownloadId}`;
          dispatchCreditsUpdate();
        }, 800);
      }
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
      if (event === 'SIGNED_IN' && session) {
        setIsGuestEnhanced(false); trackEvent('guest_signin_after_enhance');
        const hasPending = safeGetItem(sessionStorage, 'mf_pending_enhance') === 'true' || safeGetItem(localStorage, 'mf_pending_enhance') === 'true';
        safeRemoveItem(localStorage, 'mf_pending_enhance'); safeRemoveItem(localStorage, 'mf_guest_enhanced'); safeRemoveItem(localStorage, 'mf_preview'); safeRemoveItem(localStorage, 'mf_analysisJSON'); safeRemoveItem(localStorage, 'mf_visibleText');
        if (hasPending) { safeRemoveItem(sessionStorage, 'mf_pending_enhance'); handleEnhance(safeGetItem(sessionStorage, 'mf_analysisJSON') || analysisJSON, (safeGetItem(sessionStorage, 'mf_visibleText') || visibleText) ?? undefined); }
        dispatchCreditsUpdate();
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, analysisJSON, visibleText]);

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
  const handleReset = useCallback(() => {
    setPreview(null); setWatermarkedImage(null); setEnhancementId(null); setIsGuestEnhanced(false); setIsFreeGeneration(false); setIsDownloadFree(false); setEnhanceError(null); setSliderIndex(0); setVisibleText(''); setAnalysisJSON(null); setSelectedPanel('original'); setLightboxOpen(false); setLightboxIndex(0);
    // [v9.2] clear auto-start states
    setAutoStartChecking(false); setShowCreditConfirm(false);
    // [v9.3] clear showcase state
    setShowResultShowcase(false); setShowcaseSlideIndex(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
    ['mf_preview', 'mf_visibleText', 'mf_analysisJSON', 'mf_scene_tags', 'mf_pending_enhance', 'mf_watermarkedImage', 'mf_enhancementId', 'mf_enhancedMimeType', 'mf_isFreeGeneration', 'mf_isDownloadFree', 'mf_payment_just_completed', 'mf_showcase_pending_download'].forEach(k => safeRemoveItem(sessionStorage, k));
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
    const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsGuestEnhanced(true); setSliderIndex(1); setSelectedPanel('enhanced'); safeSetItem(sessionStorage, 'mf_pending_enhance', 'true'); safeSetItem(localStorage, 'mf_pending_enhance', 'true'); safeSetItem(localStorage, 'mf_guest_enhanced', 'true'); if (preview) safeSetItem(localStorage, 'mf_preview', preview); if (analysisJSON) safeSetItem(localStorage, 'mf_analysisJSON', analysisJSON); if (visibleText) safeSetItem(localStorage, 'mf_visibleText', visibleText); return; }
    setIsEnhancing(true); setEnhanceError(null); trackEvent('enhance_start_click');
    try {
      const res = await fetch('/api/enhance-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: preview.split(',')[1],
          mimeType: 'image/jpeg',
          analysisResult: jsonFromFinish ?? analysisJSON ?? textFromFinish ?? visibleText ?? '',
          useFusion,  // ← 新增
        })
      });
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
      safeSetItem(sessionStorage, 'mf_watermarkedImage', data.watermarkedImage); safeSetItem(sessionStorage, 'mf_enhancementId', data.enhancementId); safeSetItem(sessionStorage, 'mf_enhancedMimeType', data.mimeType ?? 'image/png'); safeSetItem(sessionStorage, 'mf_isFreeGeneration', String(data.isFreeTrial)); safeSetItem(sessionStorage, 'mf_isDownloadFree', String(data.downloadFree ?? false));
      setIsGuestEnhanced(false); setSliderIndex(1); setSelectedPanel('enhanced'); dispatchCreditsUpdate(); router.refresh(); trackEvent('enhance_complete', { status: 'success' });
      // [v9.3] Auto-pop Result Showcase Modal
      setShowcaseSlideIndex(1);
      setShowResultShowcase(true);
      trackEvent('result_showcase_shown');
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
    fetch: async (url, init) => {
      const res = await fetch(url, init);
      const tagsHeader = res.headers.get('x-scene-tags');
      if (tagsHeader) {
        safeSetItem(sessionStorage, 'mf_scene_tags', tagsHeader);
        setSceneTags(tagsHeader);
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
          return;
        }
      } catch { /* ignore */ }
    
      // ← 关键:传 mergedJson 不是 json
      if (isFacebookWebView()) {
        setTimeout(() => handleEnhance(mergedJson, text), 1500);
      } else {
        handleEnhance(mergedJson, text);
      }
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { alert('We only boost images. Upload a valid photo.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File too large. (Max 10MB)'); return; }
    trackEvent('boost_image_selected', { file_size: Math.round(file.size / 1024) });
    // 先用 blob URL 秒出预览
    const quickPreview = URL.createObjectURL(file);
    setPreview(quickPreview); setWatermarkedImage(null); setEnhancementId(null); setIsGuestEnhanced(false); setIsFreeGeneration(false); setIsDownloadFree(false); setEnhanceError(null); setSliderIndex(0); setSelectedPanel('original');
    // [v9.2] reset auto-start states
    setShowCreditConfirm(false); setAutoStartChecking(true);
    const hero = document.getElementById('scanner-hero');
    if (hero) hero.style.display = '';
    // 后台压缩，完成后替换预览并存 session
    const compressed = await compressImage(file, { maxSize: 800, quality: 0.75 });
    URL.revokeObjectURL(quickPreview);
    setPreview(compressed);
    scheduleIdle(() => {
      safeSetItem(sessionStorage, 'mf_preview', compressed); safeRemoveItem(sessionStorage, 'mf_visibleText'); safeRemoveItem(sessionStorage, 'mf_analysisJSON');
    });

    // [v9.2] Auto-start logic — check user eligibility after compression
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Guest: check local free limit
        const FREE_LIMIT = 3;
        const used = parseInt(safeGetItem(localStorage, 'mf_free_analyses') || '0', 10);
        if (used >= FREE_LIMIT) {
          // Path D: free limit reached → show modal
          setAutoStartChecking(false);
          trackEvent('free_limit_reached', { used });
          setActiveModal('free_limit');
          return;
        }
        // Path A: guest with free uses left → auto start
        setAutoStartChecking(false);
        // Use setTimeout to let state settle before calling handleSubmit
        setTimeout(() => handleSubmitRef.current(), 0);
        return;
      }

      // Logged in — check credits
      const cr = await fetch('/api/credits');
      if (cr.ok) {
        const cd = await cr.json();
        const isSub = cd.isSubscribed === true;
        const credits = cd.credits?.remaining_credits ?? 0;
        const needed = isSub ? 20 : 25;
        setRequiredCredits(needed);
        setIsSubscribed(isSub);

        // Check if user has free generation (first time)
        if (cd.hasFreeTrial) {
          // Path A: free trial available → auto start
          setAutoStartChecking(false);
          setTimeout(() => handleSubmitRef.current(), 0);
          return;
        }

        // Path B/C: paid user — check credits
        if (credits >= needed) {
          // Path B: has enough credits → show credit confirm bar
          setAutoStartChecking(false);
          setShowCreditConfirm(true);
          trackEvent('credit_confirm_shown', { credits, needed });
          return;
        }

        // Path C: not enough credits → show enhance modal
        setAutoStartChecking(false);
        setActiveModal('enhance');
        return;
      }

      // API call failed — fall back to showing button
      setAutoStartChecking(false);
      setShowCreditConfirm(true);
    } catch {
      // Network error — fall back to showing button
      setAutoStartChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview || isLoading) return;
    if (!isLoggedIn) { const FREE_LIMIT = 3; const used = parseInt(safeGetItem(localStorage, 'mf_free_analyses') || '0', 10); if (used >= FREE_LIMIT) { trackEvent('free_limit_reached', { used }); setActiveModal('free_limit'); return; } safeSetItem(localStorage, 'mf_free_analyses', String(used + 1)); }
    // [v9.2] clear credit confirm bar
    setShowCreditConfirm(false); setAutoStartChecking(false);
    setActiveModal(null); setVisibleText(''); setAnalysisJSON(null); setWatermarkedImage(null); setEnhancementId(null); setIsGuestEnhanced(false); setIsFreeGeneration(false); setIsDownloadFree(false); setEnhanceError(null); setSliderIndex(0); setSelectedPanel('original');
    safeRemoveItem(sessionStorage, 'mf_visibleText'); safeRemoveItem(sessionStorage, 'mf_analysisJSON'); trackEvent('boost_start_click');
    await complete('', { body: { imageBase64: preview.split(',')[1], mimeType: 'image/jpeg' } });
  };
  handleSubmitRef.current = handleSubmit;  // ← 加这一行

  // ── Download ───────────────────────────────────────────────
  const handleDownload = () => {
    if (!enhancementId) return;
    trackEvent('enhance_download_click', { isDownloadFree, isFreeGeneration });
    // [v9 fix] 刚支付完回来，直接下载，不弹窗
    const justPaid = safeGetItem(sessionStorage, 'mf_payment_just_completed') === 'true';
    if (justPaid) {
      safeRemoveItem(sessionStorage, 'mf_payment_just_completed');
      window.location.href = `/api/download/${enhancementId}`;
      dispatchCreditsUpdate();
      return;
    }
    if (isFreeGeneration && !isDownloadFree) handleDownloadWithPrecheck();
    else { window.location.href = `/api/download/${enhancementId}`; dispatchCreditsUpdate(); }
  };
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

  // [v9.3] Showcase download — close showcase then trigger normal download
  const handleShowcaseDownload = () => {
    setShowResultShowcase(false);
    trackEvent('result_showcase_download_click');
    // Small delay to let modal close, then trigger normal download flow
    setTimeout(() => handleDownload(), 100);
  };
  // [v9.4] Direct download for Pro / already-paid users — no pricing UI
  const handleShowcaseDirectDownload = () => {
    if (!enhancementId) return;
    setShowResultShowcase(false);
    trackEvent('result_showcase_direct_download');
    setTimeout(() => {
      window.location.href = `/api/download/${enhancementId}`;
      dispatchCreditsUpdate();
    }, 100);
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => { if (touchStartX.current === null || touchEndX.current === null) return; const diff = touchStartX.current - touchEndX.current; if (Math.abs(diff) > 40) { if (diff > 0 && sliderIndex < 1) { setSliderIndex(1); setSelectedPanel('enhanced'); } if (diff < 0 && sliderIndex > 0) { setSliderIndex(0); setSelectedPanel('original'); } } touchStartX.current = null; touchEndX.current = null; };
  const selectOriginal = () => { setSelectedPanel('original'); setSliderIndex(0); };
  const selectEnhanced = () => { setSelectedPanel('enhanced'); setSliderIndex(1); };

  const isOriginalSelected = selectedPanel === 'original';
  const downloadButtonText = isDownloadFree ? 'Download Enhanced Photo' : isFreeGeneration ? 'Download Photo' : 'Download Enhanced Photo';
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

  // [v9.3] Showcase touch handlers
  const handleShowcaseTouchStart = (e: React.TouchEvent) => { showcaseTouchStartX.current = e.touches[0].clientX; };
  const handleShowcaseTouchMove = (e: React.TouchEvent) => { showcaseTouchEndX.current = e.touches[0].clientX; };
  const handleShowcaseTouchEnd = () => {
    if (showcaseTouchStartX.current === null || showcaseTouchEndX.current === null) return;
    const diff = showcaseTouchStartX.current - showcaseTouchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && showcaseSlideIndex < 1) setShowcaseSlideIndex(1);
      if (diff < 0 && showcaseSlideIndex > 0) setShowcaseSlideIndex(0);
    }
    showcaseTouchStartX.current = null; showcaseTouchEndX.current = null;
  };

  // Overlays
  const ScanningOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute left-0 right-0 h-0.5 bg-rose-500" style={{ boxShadow: '0 0 20px 6px rgba(244,63,94,0.6)', animation: 'scanLine 2s linear infinite' }} /></div>
      <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
        <div className="flex space-x-1.5"><div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><div className="w-2 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div>
        <p className="text-white font-semibold text-base animate-pulse">AI is analyzing your photo...</p>
        <p className="text-white/50 text-sm">Usually done within 15 seconds</p>
      </div>
    </div>
  );
  const EnhancingOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" style={{ boxShadow: '0 0 20px 6px rgba(52,211,153,0.5)', animation: 'scanLine 1.5s linear infinite' }} /></div>
      <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center"><Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /><p className="text-white font-semibold text-base animate-pulse">Enhancing your photo...</p><p className="text-white/50 text-sm">Usually done within 12 seconds</p></div>
    </div>
  );
  const GuestLockOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center bg-black/50 backdrop-blur-[2px]">
      <div className="grid size-12 place-items-center rounded-full bg-white/10 border border-white/20 backdrop-blur-sm"><Lock className="size-5 text-white" /></div>
      <div><p className="text-white font-bold text-base">Your photo looks great</p><p className="text-white/50 text-xs mt-1">Sign in to see the full result — takes 10 seconds</p></div>
      <Button size="lg" className="bg-white text-slate-900 hover:bg-white/90 font-bold gap-2 px-8 py-3 rounded-xl shadow-lg text-base min-w-[200px]" onClick={() => openAuthModal('sign-up')}>View My Photo</Button>
    </div>
  );

  return (
    <div className="w-full text-foreground relative">
      <div className="mx-auto flex w-full flex-col gap-4">

        {/* ═══ DESKTOP: Initial upload ═══ */}
        {!preview && (
          <div className="hidden md:grid md:grid-cols-2 gap-5 items-stretch">
            <div className="flex flex-col gap-2">
              <label
                onMouseEnter={() => setIsUploadHovered(true)}
                onMouseLeave={() => setIsUploadHovered(false)}
                className="group relative rounded-2xl border-[3px] border-dashed border-rose-500/50 bg-rose-500/[0.04] hover:border-rose-500/80 hover:bg-rose-500/[0.08] cursor-pointer transition-all duration-500 overflow-hidden flex-1 min-h-[380px] flex flex-col items-center justify-center gap-6 px-8"
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(244,63,94,0.12) 0%, transparent 65%)', animation: 'uploadPulse 2.5s ease-in-out infinite' }} />
                <div className={`relative pointer-events-none grid size-24 place-items-center rounded-3xl bg-rose-500/15 border-2 border-rose-500/30 shadow-2xl shadow-rose-500/20 transition-all duration-500 ${isUploadHovered ? 'shadow-rose-500/40 scale-105 bg-rose-500/20' : ''}`}>
                  <Upload className={`size-10 transition-colors duration-300 ${isUploadHovered ? 'text-rose-300' : 'text-rose-400'}`} />
                </div>
                <div className="relative pointer-events-none text-center space-y-2">
                  <div className="text-xl font-bold text-white">Drop your main profile photo</div>
                  <div className="text-base text-slate-400 group-hover:text-slate-300 transition-colors">or click to browse</div>
                </div>
                <div className="relative pointer-events-none text-xs text-slate-500 mt-1">We enhance lighting, framing & color — your face stays 100% real</div>
                <div className="relative pointer-events-none text-sm text-slate-600">JPG / PNG · Max 10 MB</div>
              </label>

              {/* [fusion] 开关 - 像勾选法律协议那样放在上传框下面 */}
              <label className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 cursor-pointer hover:text-slate-400 transition-colors select-none">
                <input
                  type="checkbox"
                  checked={useFusion}
                  onChange={(e) => setUseFusion(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-rose-500 focus:ring-rose-500 focus:ring-offset-0 accent-rose-500"
                />
                <span>Replace background with a better-matching scene (recommended)</span>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-800/30 bg-slate-900/30 min-h-[420px] flex flex-col items-center justify-center gap-4 px-8 opacity-30">
              <div className="grid size-16 place-items-center rounded-2xl bg-slate-800/40 border border-slate-700/30">
                <Sparkles className="size-7 text-slate-600" />
              </div>
              <div className="text-center">
                <div className="text-base text-slate-500 font-medium">Your enhanced photo will appear here</div>
              </div>
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
                  <img src={preview} alt="Original" className={`w-full object-contain p-2 cursor-pointer ${isCompact ? 'max-h-[240px] md:max-h-[280px]' : 'max-h-[300px] md:max-h-[360px]'}`} onClick={() => openLightbox(preview!)} />
                  {isCompact && <div className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-black/50 text-white/60 pointer-events-none"><ZoomIn className="size-3.5" /></div>}
                  {isLoading && <ScanningOverlay />}
                </div>
                {!isLoading && !isEnhancing && !showEnhanced && (
                  <div className="flex flex-col gap-3 mt-4">

                    {autoStartChecking ? (
                      // ... 其他原样保留
                      <button type="button" disabled
                        className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 opacity-70">
                        <Loader2 className="w-5 h-5 animate-spin" /> Preparing...
                      </button>
                    ) : showCreditConfirm ? (
                      /* [v9.2] Credit confirm bar — shows cost before starting */
                      <button type="button" onClick={handleSubmit} disabled={isLoading || isEnhancing}
                        className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99]">
                        <Wand2 className="w-5 h-5" /> Enhance Photo
                        <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-semibold">⚡ {requiredCredits}</span>
                      </button>
                    ) : (
                      <button type="button" onClick={handleSubmit} disabled={isLoading || isEnhancing}
                        className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99]">
                        <Wand2 className="w-5 h-5" /> Enhance Photo
                        <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-semibold">{isLoggedIn ? (isSubscribed ? '⚡ 20' : '⚡ 25') : 'Free'}</span>
                      </button>
                    )}
                    <label className="w-full h-10 rounded-xl text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 flex items-center justify-center gap-2 cursor-pointer">
                      <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                      <RefreshCw className="w-3.5 h-3.5" /> Change photo
                    </label>
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
                      <img src={enhancedSrc || preview!} alt="Enhanced" className={`w-full object-contain p-2 ${isGuestEnhanced ? '' : 'cursor-pointer'} ${isCompact ? 'max-h-[240px] md:max-h-[280px]' : 'max-h-[300px] md:max-h-[360px]'}`} style={isGuestEnhanced ? { filter: 'blur(6px)', transform: 'scale(1.02)' } : {}} onClick={() => enhancedSrc && openLightbox(enhancedSrc)} />
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

        {/* ═══ MOBILE ═══ */}
        <div className="md:hidden">
          {!preview ? (
            <div className="flex flex-col gap-2">
              <label className="group relative rounded-2xl border-[3px] border-dashed border-rose-500/50 bg-rose-500/[0.04] active:bg-rose-500/[0.08] cursor-pointer min-h-[340px] flex flex-col items-center justify-center gap-5 px-6 overflow-hidden">
                <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" style={{ WebkitTapHighlightColor: 'transparent', fontSize: '0', border: 'none', outline: 'none' }} />
                <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(244,63,94,0.12) 0%, transparent 65%)', animation: 'uploadPulse 2.5s ease-in-out infinite' }} />
                <div className="relative pointer-events-none grid size-20 place-items-center rounded-3xl bg-rose-500/15 border-2 border-rose-500/30 shadow-xl shadow-rose-500/20">
                  <Upload className="size-8 text-rose-400" />
                </div>
                <div className="relative pointer-events-none text-center space-y-1.5">
                  <div className="text-lg font-bold text-white">Tap to upload your profile photo</div>
                  <div className="text-xs text-slate-500">Your face stays 100% real — we just fix the lighting</div>
                  <div className="text-sm text-slate-600 mt-2">JPG / PNG · Max 10 MB</div>
                </div>
              </label>

              {/* [fusion] 开关 - mobile */}
              <label className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useFusion}
                  onChange={(e) => setUseFusion(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-rose-500 focus:ring-rose-500 focus:ring-offset-0 accent-rose-500"
                />
                <span>Replace background with a better-matching scene (recommended)</span>
              </label>
            </div>
          ) : (
            // 下面原样
            <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-b from-slate-900/80 to-slate-950/90 overflow-hidden">
              {showEnhanced && (
                <div className="grid grid-cols-2 border-b border-slate-800/40">
                  <button onClick={selectOriginal} className={`py-2.5 text-sm font-bold tracking-wide transition-colors ${isOriginalSelected ? 'text-rose-400 bg-rose-500/10 border-b-2 border-rose-500' : 'text-slate-600'}`}>ORIGINAL</button>
                  <button onClick={selectEnhanced} className={`py-2.5 text-sm font-bold tracking-wide transition-colors ${!isOriginalSelected ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-500' : 'text-slate-600'}`}>AI ENHANCED</button>
                </div>
              )}
              <div className="px-4 pb-4 pt-3">
                {/* [v9.2] Mobile preview: max-h-[280px] before analysis to keep buttons visible */}
                <div className={`relative w-full overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/60 transition-all duration-500 ${isCompact ? 'max-h-[220px]' : 'max-h-[280px]'}`}
                  onTouchStart={showEnhanced ? handleTouchStart : undefined} onTouchMove={showEnhanced ? handleTouchMove : undefined} onTouchEnd={showEnhanced ? handleTouchEnd : undefined}>
                  <div style={{ display: sliderIndex === 0 ? 'block' : 'none' }} className="relative h-full w-full">
                    <img src={preview} alt="Original" className={`w-full object-contain p-2 ${isCompact ? 'max-h-[220px]' : 'max-h-[280px]'}`} onClick={() => openLightbox(preview!)} />
                    {showEnhanced && <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-white/10">Original</div>}
                    <div className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-black/50 text-white/60 pointer-events-none"><ZoomIn className="size-3.5" /></div>
                  </div>
                  {showEnhanced && (
                    <div style={{ display: sliderIndex === 1 ? 'block' : 'none' }}>
                      <div className="relative h-full w-full">
                        <img src={enhancedSrc || preview!} alt="Enhanced" className={`w-full object-contain p-2 ${isCompact ? 'max-h-[220px]' : 'max-h-[280px]'}`} style={isGuestEnhanced ? { filter: 'blur(6px)', transform: 'scale(1.02)' } : {}} onClick={() => enhancedSrc && !isGuestEnhanced && openLightbox(enhancedSrc)} />
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
                    {/* [v9.2] Mobile: same auto-start logic as desktop */}
                    {autoStartChecking ? (
                      <button type="button" disabled
                        className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 opacity-70">
                        <Loader2 className="w-5 h-5 animate-spin" /> Preparing...
                      </button>
                    ) : showCreditConfirm ? (
                      <button type="button" onClick={handleSubmit} disabled={isLoading || isEnhancing}
                        className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 disabled:opacity-40">
                        <Wand2 className="w-5 h-5" /> Enhance Photo <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-semibold">⚡ {requiredCredits}</span>
                      </button>
                    ) : (
                      <button type="button" onClick={handleSubmit} disabled={isLoading || isEnhancing}
                        className="w-full h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 disabled:opacity-40">
                        <Wand2 className="w-5 h-5" /> Enhance Photo <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-semibold">{isLoggedIn ? (isSubscribed ? '⚡ 20' : '⚡ 25') : 'Free'}</span>
                      </button>
                    )}
                    <label className="w-full h-9 rounded-xl text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer">
                      <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                      <RefreshCw className="w-3 h-3" /> Change photo
                    </label>
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

        {/* ═══ [v9.4] RESULT SHOWCASE MODAL — watermarked preview + inline $1.99 CTA ═══ */}
        {showResultShowcase && watermarkedImage && preview && !isGuestEnhanced && (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in duration-300">
            {/* Close button */}
            <button
              className="absolute top-4 right-4 z-20 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/10"
              onClick={() => setShowResultShowcase(false)}
            >
              <X className="size-5" />
            </button>

            {/* Top badge */}
            <div className="flex justify-center pt-4 pb-2">
              <span className={`text-sm font-bold px-4 py-1.5 rounded-full backdrop-blur-sm transition-all duration-300 ${showcaseSlideIndex === 0
                ? 'text-slate-400 bg-white/5 border border-white/10'
                : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                }`}>
                {showcaseSlideIndex === 0 ? 'Original' : '✨ AI Enhanced'}
              </span>
            </div>

            {/* Image area — watermarked preview (unless user already paid/subscribed) */}
            <div
              className="flex-1 flex items-center justify-center px-4 min-h-0 relative"
              onTouchStart={handleShowcaseTouchStart}
              onTouchMove={handleShowcaseTouchMove}
              onTouchEnd={handleShowcaseTouchEnd}
            >
              <img
                src={showcaseSlideIndex === 0 ? preview : `data:${enhancedMimeType};base64,${watermarkedImage}`}
                alt={showcaseSlideIndex === 0 ? 'Original' : 'AI Enhanced'}
                className="max-w-full max-h-full object-contain rounded-xl transition-opacity duration-300"
                style={{ touchAction: 'pinch-zoom' }}
              />
              {/* Left/Right arrows */}
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-20 border border-white/10 transition-all"
                onClick={() => setShowcaseSlideIndex(0)}
                disabled={showcaseSlideIndex === 0}
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-20 border border-white/10 transition-all"
                onClick={() => setShowcaseSlideIndex(1)}
                disabled={showcaseSlideIndex === 1}
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            {/* Bottom CTA area */}
            <div className="shrink-0 px-5 pb-6 pt-3 flex flex-col items-center gap-3">
              {/* Dots */}
              <div className="flex gap-2 mb-1">
                {[0, 1].map(i => (
                  <button
                    key={i}
                    onClick={() => setShowcaseSlideIndex(i)}
                    className={`rounded-full transition-all duration-200 ${showcaseSlideIndex === i ? 'w-6 h-2 bg-emerald-400' : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                      }`}
                  />
                ))}
              </div>

              {/* Privacy note */}
              <p className="text-xs text-slate-500 text-center flex items-center gap-1.5">
                <ShieldCheck className="size-3 text-slate-600 shrink-0" />
                We don&apos;t store photos — save it now or lose it forever
              </p>

              {/* ─── Main CTA: branches on isDownloadFree ─── */}
              {isDownloadFree ? (
                /* Already paid / subscribed — direct download */
                <button
                  onClick={handleShowcaseDirectDownload}
                  className="showcase-download-btn w-full max-w-sm h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 text-white shadow-xl transition-all active:scale-[0.98] relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #0d9488 100%)',
                    boxShadow: '0 8px 32px rgba(16,185,129,0.35), 0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 55%, transparent 65%)',
                      animation: 'showcaseShimmer 2.5s ease-in-out infinite',
                    }}
                  />
                  <Download className="size-5 relative z-10" />
                  <span className="relative z-10">Download Now</span>
                </button>
              ) : (
                /* Needs to pay — inline $1.99 CTA */
                <ShowcaseMicroPackButton
                  returnPath={pathname}
                  enhancementId={enhancementId}
                />
              )}

              {/* Trust row — only show when payment is needed */}
              {!isDownloadFree && (
                <div className="flex items-center justify-center gap-3 text-[10px] text-slate-600 flex-wrap max-w-sm">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3" /> 30-day money-back
                  </span>
                  <span className="text-slate-700">•</span>
                  <span className="flex items-center gap-1">
                    <Lock className="size-3" /> Secured by Creem
                  </span>
                  <span className="text-slate-700">•</span>
                  <span>Instant download</span>
                </div>
              )}

              {/* Secondary: watermark download (free) — only show when payment is needed */}
              {!isDownloadFree && (
                <button
                  onClick={handleDownloadWatermarked}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors underline underline-offset-2 decoration-slate-700 py-1"
                >
                  or download with watermark (free)
                </button>
              )}

              {/* Tertiary: try another */}
              <button
                onClick={() => { setShowResultShowcase(false); handleTryAnother(); }}
                className="text-xs text-slate-600 hover:text-slate-500 transition-colors py-0.5"
              >
                Try another photo
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes scanLine { 0% { top: 0%; } 100% { top: 100%; } }
          @keyframes uploadPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          @keyframes showcaseShimmer {
            0% { transform: translateX(-120%); }
            60% { transform: translateX(120%); }
            100% { transform: translateX(120%); }
          }
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
      {activeModal === 'ai_busy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 mx-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-full bg-amber-500/10 mb-4 border border-amber-500/20">
              <Loader2 className="size-8 text-amber-500 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              High Demand Right Now
            </h2>
            <p className="text-sm text-slate-400 mb-1 leading-relaxed">
              Lots of people are enhancing photos at the moment!
              This usually resolves within seconds.
            </p>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              We&apos;ll automatically retry for you — no need to refresh.
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
                  <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                    {retryCountdown}
                  </span>
                </div>
                <span className="text-xs text-slate-500">Retrying automatically...</span>
              </div>
            )}

            <div className="flex w-full gap-3">
              <button
                className="flex-1 h-11 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
                onClick={handleRetryCancelAndReset}
              >
                Cancel
              </button>
              <button
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                onClick={handleRetrySubmit}
              >
                <RefreshCw className="size-4" />
                Retry Now
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
// [v9.4] Showcase Micro Pack — stores enhancementId so payment return auto-downloads
function ShowcaseMicroPackButton({ returnPath, enhancementId }: { returnPath: string; enhancementId: string | null }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const handleClick = async () => {
    setLoading(true); setError(false);
    trackEvent('showcase_micro_pack_click');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/sign-in'; return; }

      // Store enhancementId so payment return auto-triggers download
      if (enhancementId) {
        safeSetItem(sessionStorage, 'mf_showcase_pending_download', enhancementId);
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
      }
    } catch {
      setError(true); setLoading(false);
      safeRemoveItem(sessionStorage, 'mf_showcase_pending_download');
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="showcase-download-btn w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 text-white shadow-xl transition-all active:scale-[0.98] relative overflow-hidden disabled:opacity-80"
        style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #0d9488 100%)',
          boxShadow: '0 8px 32px rgba(16,185,129,0.35), 0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {!loading && (
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.25) 55%, transparent 65%)',
              animation: 'showcaseShimmer 2.5s ease-in-out infinite',
            }}
          />
        )}
        {loading ? (
          <>
            <Loader2 className="size-5 animate-spin relative z-10" />
            <span className="relative z-10">Redirecting to checkout...</span>
          </>
        ) : (
          <>
            <Download className="size-5 relative z-10" />
            <span className="relative z-10">Get This Photo — $1.99</span>
          </>
        )}
      </button>
      {error && <p className="text-red-400 text-xs text-center">Something went wrong. Please try again.</p>}
    </div>
  );
}