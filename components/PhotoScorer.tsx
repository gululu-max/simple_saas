'use client';

import React, { useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Image as ImageIcon,
  Target,
  Upload,
  XCircle,
  Trophy,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Zap,
  Loader2,
  FileImage,
  Download,
  Coins
} from 'lucide-react';
import { toPng } from 'html-to-image';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/utils/supabase/client';
import { useAuthModal } from '@/components/auth/auth-modal-context';

// ================= 图像压缩逻辑 =================
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

interface PhotoPreview {
  id: string;
  file: File;
  preview: string;
}

export default function PhotoScorer() {
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { openAuthModal } = useAuthModal(); // ← 新增

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const trackEvent = (eventName: string, params?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, params);
    }
  };

  // ================= 文件选择与处理 =================
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // ✅ 先判断登录状态，未登录直接弹窗
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      openAuthModal('sign-up');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      alert('Only image files can be uploaded');
      return;
    }

    const oversizedFiles = imageFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert('Some files are too large, please compress before uploading (Max 10MB)');
      return;
    }

    const newPhotos: PhotoPreview[] = [];
    for (const file of imageFiles) {
      const compressed = await compressImage(file, {
        maxSize: 1024,
        quality: 0.75,
      });
      newPhotos.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview: compressed,
      });
    }

    const totalPhotos = photos.length + newPhotos.length;
    if (totalPhotos > 9) {
      alert('You can only upload up to 9 photos');
      const remaining = 9 - photos.length;
      setPhotos([...photos, ...newPhotos.slice(0, remaining)]);
      trackEvent('photo_scorer_images_selected', { count: remaining });
    } else {
      setPhotos([...photos, ...newPhotos]);
      trackEvent('photo_scorer_images_selected', { count: newPhotos.length });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id));
  };

  // ================= 提交分析 =================
  const handleSubmit = async () => {
    if (photos.length < 3 || isLoading) return;

    // ✅ 提交前再次检查登录状态
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      openAuthModal('sign-up');
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);

    trackEvent('photo_scorer_start_click', { photo_count: photos.length });

    try {
      const images = photos.map(p => ({
        base64: p.preview.split(',')[1],
        mimeType: 'image/jpeg',
      }));

      const response = await fetch('/api/photo-scorer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401 || errorData.code === 'UNAUTHENTICATED') {
          trackEvent('photo_scorer_failed', { reason: 'unauthenticated' });
          openAuthModal('sign-up');
          setIsLoading(false);
          return;
        }

        if (response.status === 403 || errorData.code === 'INSUFFICIENT_CREDITS') {
          trackEvent('photo_scorer_failed', { reason: 'insufficient_credits' });
          setShowCreditModal(true);
          setIsLoading(false);
          return;
        }

        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalysisResult(data);

      trackEvent('photo_scorer_complete', { status: 'success' });
      fetch('/api/meta-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: `lead_photo_scorer_${Date.now()}` }),
      }).catch(err => console.error('[Meta CAPI] PhotoScorer Lead event failed:', err));

      router.refresh();

    } catch (error: any) {
      console.error("Submission failed:", error);
      trackEvent('photo_scorer_failed', { reason: 'error' });
      alert(`Oops: ${error.message || 'The server wandered off, please try again!'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ================= 导出报告图片 =================
  const handleExportImage = async () => {
    if (reportRef.current === null) return;
    setIsExporting(true);

    trackEvent('photo_scorer_export_image');

    try {
      const dataUrl = await toPng(reportRef.current, { cacheBust: true, pixelRatio: 2 });

      const link = document.createElement('a');
      link.download = `Matchfix-Dating-Analysis-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

    } catch (err) {
      console.error('Export failed:', err);
      alert('Image generation failed, please try again later!');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full text-foreground relative">
      <div className="mx-auto flex w-full flex-col gap-6 p-4 md:p-6">

        {/* 上传区域卡片 */}
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ImageIcon className="size-5 text-muted-foreground" />
              Upload your photos (3-9 photos)
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Supports JPG/PNG. AI will score and rank each photo, and design the best Profile display order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border-2 border-border bg-muted/30"
                  >
                    <img
                      src={photo.preview}
                      alt={`Photo ${photo.id}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive/80 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={isLoading}
                    >
                      <XCircle className="size-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <div className="text-xs text-white font-medium">
                        Photo {index + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {photos.length < 9 && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                className="group relative grid min-h-[200px] w-full cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 outline-none transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
                  <div className="grid size-14 place-items-center rounded-2xl bg-background border border-border shadow-sm">
                    <Upload className="size-6 text-muted-foreground/70" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-foreground">
                      {photos.length === 0
                        ? 'Click to upload photos (at least 3, up to 9) 📸'
                        : `Uploaded ${photos.length}/9 photos, continue adding...`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Supports multiple selection, or drag and drop files here
                    </div>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-border">
              <div className="text-sm text-muted-foreground flex-1 px-4 sm:px-0 whitespace-normal">
                {photos.length >= 3
                  ? `✅ Uploaded ${photos.length} photos, ready to score`
                  : photos.length > 0
                    ? `⚠️ Need to upload ${3 - photos.length} more photos (at least 3)`
                    : 'No photos uploaded yet'}
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto h-11 text-muted-foreground gap-2 justify-center"
                  onClick={() => {
                    setPhotos([]);
                    setAnalysisResult(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    trackEvent('photo_scorer_clear_all');
                  }}
                  disabled={isLoading}
                >
                  <XCircle className="w-4 h-4" /> Clear all
                </Button>

                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || photos.length < 3}
                  className="w-full sm:w-auto h-auto sm:h-11 py-3 sm:py-0 whitespace-normal sm:whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-bold px-3 sm:px-6 flex justify-center"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                      <span>Analyzing...</span>
                    </span>
                  ) : (
                    <span className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 sm:gap-2">
                      <BarChart3 className="w-4 h-4 shrink-0" />
                      <span className="text-[13px] sm:text-base leading-tight">
                        Start Scoring & Ranking
                      </span>
                      <span className="inline-flex shrink-0 items-center rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                        <Zap className="mr-1 h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500" />
                        10 Credits
                      </span>
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ================= 结果展示卡片 ================= */}
        {(analysisResult || isLoading) && (
          <Card className="border-border bg-card shadow-sm overflow-hidden mt-2 animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="bg-primary/5 border-b border-border flex flex-row items-center justify-between py-4">
              <CardTitle className="text-primary flex items-center gap-2 text-lg">
                <Trophy className="size-5 text-amber-500" />
                AI Scoring & Strategy Report
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="flex space-x-1.5 items-center">
                    <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <p className="text-muted-foreground italic text-sm font-medium animate-pulse text-center">
                    AI is transforming into a top dating coach, analyzing your profile...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-10">
                  <div ref={reportRef} className="bg-card flex flex-col gap-10 p-2 rounded-xl">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Best Profile Order (The Perfect Lineup)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {analysisResult.profileSequence?.map((item: any, index: number) => {
                          const photoData = photos[item.imageIndex];
                          if (!photoData) return null;
                          return (
                            <div key={index} className="flex flex-col bg-muted/30 rounded-xl border border-border overflow-hidden">
                              <div className="relative aspect-square">
                                <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded-md font-black text-sm z-10 shadow-md">
                                  #{index + 1}
                                </div>
                                <img src={photoData.preview} className="w-full h-full object-cover" alt={`Rank ${index + 1}`} />
                              </div>
                              <div className="p-4 flex flex-col gap-1">
                                <Badge className="w-fit mb-1" variant="secondary">{item.role}</Badge>
                                <span className="text-sm text-foreground leading-relaxed">{item.reason}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-primary" />
                        Brutally Honest Analysis of Each Photo
                      </h3>
                      <div className="flex flex-col gap-6">
                        {analysisResult.photoDetails?.map((detail: any, index: number) => {
                          const photoData = photos[detail.imageIndex];
                          if (!photoData) return null;
                          return (
                            <Card key={index} className="overflow-hidden bg-[#121214] border-zinc-800 shadow-2xl mb-8">
                              <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] lg:grid-cols-[380px_1fr] min-h-[450px]">
                                <div className="relative bg-zinc-900 border-b sm:border-b-0 sm:border-r border-zinc-800 flex items-center justify-center p-4">
                                  <img
                                    src={photoData.preview}
                                    className="max-w-full max-h-[400px] object-contain shadow-2xl"
                                    alt="Target"
                                  />
                                  <div className="absolute top-4 left-4">
                                    <Badge className="bg-primary/20 text-primary border-primary/30 font-black">
                                      PHOTO {detail.imageIndex + 1}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="p-6 lg:p-10 flex flex-col justify-between bg-[#1a1a1c]">
                                  <div className="w-full">
                                    <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
                                      <h4 className="text-2xl font-black text-white tracking-tighter uppercase">Visual Audit</h4>
                                      <div className="flex flex-col items-end">
                                        <span className="text-4xl font-black text-primary italic leading-none">{detail.score}</span>
                                        <span className="text-[10px] text-zinc-500 font-bold tracking-widest mt-1">MATCH SCORE</span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                          <CheckCircle className="w-4 h-4" /> THE STRENGTHS
                                        </div>
                                        <p className="text-zinc-300 text-sm leading-relaxed">{detail.pros}</p>
                                      </div>
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                                          <AlertTriangle className="w-4 h-4" /> THE FLAWS
                                        </div>
                                        <p className="text-zinc-300 text-sm leading-relaxed">{detail.cons}</p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                    <div className="flex items-center gap-2 mb-2 text-primary font-bold text-xs">
                                      <Zap className="w-4 h-4 fill-primary" />
                                      RESCUE PLAN
                                    </div>
                                    <p className="text-white text-sm font-semibold leading-relaxed">{detail.action}</p>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-6 mt-6 border-t border-border text-xs text-muted-foreground/60">
                      <span>Generated by Matchfix - Your Brutally Honest Dating Profile Coach</span>
                      <span>matchfix.site</span>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-6 mt-6 border-t border-border">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAnalysisResult(null);
                        trackEvent('photo_scorer_retest_click');
                      }}
                      className="w-full sm:w-auto h-12 flex-none px-6 text-muted-foreground"
                    >
                      Retest
                    </Button>

                    <Button
                      onClick={handleExportImage}
                      disabled={isExporting}
                      className="w-full sm:flex-1 h-12 bg-primary text-primary-foreground font-bold text-base gap-2 justify-center"
                    >
                      {isExporting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" /> Generating image...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <FileImage className="w-5 h-5" /> Export Analysis Report Image
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 积分不足弹窗 */}
        {showCreditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm p-6 mx-4 bg-card border border-border rounded-2xl shadow-xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              <div className="grid size-16 place-items-center rounded-full bg-primary/10 mb-4 border border-primary/20">
                <Coins className="size-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                😅 Low Balance!
              </h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                This AI analysis requires <span className="font-bold text-foreground">10 Credits</span>.<br />
                Get more credits now to continue building your perfect profile!
              </p>
              <div className="flex w-full gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl"
                  onClick={() => {
                    setShowCreditModal(false);
                    trackEvent('upgrade_modal_cancel');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold"
                  onClick={() => {
                    setShowCreditModal(false);
                    trackEvent('upgrade_modal_click_refill');
                    router.push(`/?from=${encodeURIComponent(pathname)}#pricing`);
                  }}
                >
                  Get More
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}