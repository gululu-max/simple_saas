'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useCompletion } from 'ai/react';
import { useRouter, usePathname } from 'next/navigation';
import { Zap, Loader2, Wand2, Download, Lock, ChevronDown, ChevronUp } from "lucide-react";
import {
  Image as ImageIcon,
  Upload,
  XCircle,
  Copy,
  Check,
  Coins,
  Gift
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

const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
};

export default function BoostScanner() {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCopied, setIsCopied] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isResultExpanded, setIsResultExpanded] = useState(true);

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [enhancedMimeType, setEnhancedMimeType] = useState('image/png');

  const [visibleText, setVisibleText] = useState<string>('');
  const [analysisJSON, setAnalysisJSON] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { openAuthModal } = useAuthModal();

  useEffect(() => {
    const savedPreview = sessionStorage.getItem('mf_preview');
    const savedText = sessionStorage.getItem('mf_visibleText');
    const savedJSON = sessionStorage.getItem('mf_analysisJSON');
    if (savedPreview) setPreview(savedPreview);
    if (savedText) setVisibleText(savedText);
    if (savedJSON) setAnalysisJSON(savedJSON);
  }, []);

  const handleReset = () => {
    setPreview(null);
    setEnhancedImage(null);
    setVisibleText('');
    setAnalysisJSON(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    sessionStorage.removeItem('mf_preview');
    sessionStorage.removeItem('mf_visibleText');
    sessionStorage.removeItem('mf_analysisJSON');
    trackEvent('boost_image_reset');
  };

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
    },
    onError: (error) => {
      try {
        const errorData = JSON.parse(error.message);
        if (errorData.code === 'UNAUTHENTICATED') {
          trackEvent('boost_failed', { reason: 'unauthenticated' });
          openAuthModal('sign-up');
          return;
        }
        if (
          errorData.code === 'INSUFFICIENT_CREDITS' ||
          (errorData.error && errorData.error.includes('Insufficient credits'))
        ) {
          trackEvent('boost_failed', { reason: 'insufficient_credits' });
          setShowUpgradeModal(true);
          return;
        }
        alert('Oops: ' + (errorData.error || 'Something went wrong.'));
      } catch (e) {
        if (error.message.includes('401')) {
          openAuthModal('sign-up');
        } else if (error.message.includes('402')) {
          setShowUpgradeModal(true);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      openAuthModal('sign-up');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
    setEnhancedImage(null);
    sessionStorage.setItem('mf_preview', compressed);
    sessionStorage.removeItem('mf_visibleText');
    sessionStorage.removeItem('mf_analysisJSON');
  };

  const handleSubmit = async () => {
    if (!preview || isLoading) return;
    setShowUpgradeModal(false);
    setIsResultExpanded(true);
    setVisibleText('');
    setAnalysisJSON(null);
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

  const handleEnhance = async () => {
    if (!preview) return;
    setIsEnhancing(true);
    trackEvent('enhance_start_click');
    try {
      const res = await fetch('/api/enhance-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: preview.split(',')[1],
          mimeType: 'image/jpeg',
          analysisResult: analysisJSON ?? visibleText ?? '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'UNAUTHENTICATED') { openAuthModal('sign-up'); return; }
        if (data.code === 'INSUFFICIENT_CREDITS') { setShowUpgradeModal(true); return; }
        alert('Enhancement failed: ' + (data.error || 'Unknown error'));
        return;
      }
      setEnhancedImage(data.enhancedImage);
      setEnhancedMimeType(data.mimeType ?? 'image/png');
      router.refresh();
      trackEvent('enhance_complete', { status: 'success' });
    } catch (err) {
      alert('Something went wrong. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleDownload = () => {
    if (!enhancedImage) return;
    const ext = enhancedMimeType.split('/')[1] ?? 'png';
    const link = document.createElement('a');
    link.href = `data:${enhancedMimeType};base64,${enhancedImage}`;
    link.download = `matchfix-enhanced.${ext}`;
    link.click();
    trackEvent('enhance_download');
  };

  const showOverlay = !!(visibleText && !isLoading && !enhancedImage && !isEnhancing);

  return (
    <div className="w-full text-foreground relative">
      <div className="mx-auto flex w-full flex-col gap-6">

        <div className="flex flex-col gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10">
              <Wand2 className="size-6 text-primary" />
            </div>
            {/* ✅ 删掉了重复的副标题 */}
            <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
              The Matchfix Scanner
            </h1>
          </div>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ImageIcon className="size-5 text-muted-foreground" />
              Upload Your "Masterpiece"
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Supports JPG/PNG. Local compression enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (showOverlay || isLoading || isEnhancing) return;
                fileInputRef.current?.click();
              }}
              className="group relative grid min-h-[260px] w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 outline-none transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60"
              style={{ cursor: (showOverlay || isLoading || isEnhancing) ? 'default' : 'pointer' }}
            >
              {preview ? (
                <div className="relative h-full w-full">
                  <img
                    src={preview}
                    alt="Preview"
                    className="h-full w-full object-contain p-3 transition-all duration-300"
                    style={showOverlay ? { filter: 'blur(12px)', transform: 'scale(1.05)' } : {}}
                  />

                  {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div
                          className="absolute left-0 right-0 h-0.5 bg-primary"
                          style={{
                            boxShadow: '0 0 12px 4px rgba(220,38,38,0.8)',
                            animation: 'scanLine 2s linear infinite',
                          }}
                        />
                      </div>
                      <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
                        <div className="flex space-x-1.5">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <p className="text-white font-semibold text-sm animate-pulse">
                          AI is analyzing your photo...
                        </p>
                        <p className="text-white/60 text-xs">
                          Usually done within 7 seconds
                        </p>
                      </div>
                    </div>
                  )}

                  {isEnhancing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div
                          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                          style={{
                            boxShadow: '0 0 16px 6px rgba(52,211,153,0.7)',
                            animation: 'scanLine 1.5s linear infinite',
                          }}
                        />
                      </div>
                      <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
                        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                        <p className="text-white font-semibold text-sm animate-pulse">
                          Enhancing your photo...
                        </p>
                        <p className="text-white/60 text-xs">
                          Usually done within 10 seconds
                        </p>
                      </div>
                    </div>
                  )}

                  {showOverlay && (
                    <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-3 p-4 text-center">
                      <div className="grid size-12 sm:size-14 place-items-center rounded-full bg-primary/20 border border-primary/40">
                        <Lock className="size-6 sm:size-7 text-primary" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-base sm:text-lg">Your optimized photo is ready ✨</p>
                        <p className="text-white/70 text-xs sm:text-sm mt-1">AI has enhanced your lighting, background & composition</p>
                      </div>
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleEnhance(); }}
                        disabled={isEnhancing}
                        className="h-10 sm:h-12 px-4 sm:px-8 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm sm:text-base gap-2 w-full max-w-xs"
                      >
                        {isEnhancing ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />Enhancing...</>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            Unlock Enhanced Photo
                            <span className="inline-flex items-center rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold">
                              <Zap className="mr-1 h-3 w-3 text-amber-400 fill-amber-400" />
                              20 Credits
                            </span>
                          </>
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleReset(); }}
                        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mt-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Use a different photo
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                  <div className="grid size-14 place-items-center rounded-2xl bg-background border border-border shadow-sm">
                    <Upload className="size-6 text-muted-foreground/70" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-foreground">
                      Click to upload your dating profile pic 📸
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Or drag and drop it here
                    </div>
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

            <style>{`
              @keyframes scanLine {
                0% { top: 0%; }
                100% { top: 100%; }
              }
            `}</style>

            {(completion || isLoading || visibleText) && (
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

            {!(visibleText && !isLoading) && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  {preview ? '✅ Photo loaded. Ready to boost.' : 'No photo selected yet.'}
                </div>
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto h-11 text-muted-foreground gap-2"
                    onClick={handleReset}
                    disabled={isLoading || isEnhancing || !preview}
                  >
                    <XCircle className="w-4 h-4" /> Swap Photo
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || isEnhancing || !preview || showOverlay}
                    className="w-full sm:w-auto h-11 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-bold px-6"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Scanning...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Analyze Photo
                        <span className="inline-flex items-center rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                          <Zap className="mr-1 h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          5 Credits
                        </span>
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground/60 bg-muted/20 py-4 rounded-b-xl">
            Disclaimer: For entertainment purposes only.
          </CardFooter>
        </Card>

        {enhancedImage && preview && (
          <Card className="border-border bg-card shadow-sm overflow-hidden">
            <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/20 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-400 font-semibold text-sm">Enhancement complete! Before vs After</span>
            </div>

            <div className="flex flex-col sm:flex-row">
              <div className="flex-1 flex flex-col">
                <div className="px-3 pt-3 pb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Before</span>
                </div>
                <img src={preview} alt="Original" className="w-full object-cover" />
              </div>

              <div className="sm:w-px w-full h-px sm:h-auto bg-border" />

              <div className="flex-1 flex flex-col">
                <div className="px-3 pt-3 pb-1 flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">After</span>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    AI Enhanced ✨
                  </span>
                </div>
                <img
                  src={`data:${enhancedMimeType};base64,${enhancedImage}`}
                  alt="Enhanced"
                  className="w-full object-cover"
                />
              </div>
            </div>

            <div className="p-4">
              <Button
                onClick={handleDownload}
                className="w-full h-11 gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Download className="w-4 h-4" />
                Download Enhanced Photo
              </Button>
            </div>
          </Card>
        )}

      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 mx-4 bg-card border border-border rounded-2xl shadow-xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-full bg-primary/10 mb-4 border border-primary/20">
              <Coins className="size-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              Low Balance! 😅
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Enhancing a photo costs <span className="font-bold text-foreground">20 Credits</span>. Top up to continue.
            </p>
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={() => { setShowUpgradeModal(false); trackEvent('upgrade_modal_cancel'); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold"
                onClick={() => {
                  setShowUpgradeModal(false);
                  trackEvent('upgrade_modal_click_refill');
                  router.push(`/?from=${encodeURIComponent(pathname)}#pricing`);
                }}
              >
                Get More Credits
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}