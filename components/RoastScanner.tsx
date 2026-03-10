'use client';

import React, { useRef, useState } from 'react';
import { useCompletion } from 'ai/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, Wand2, Upload, XCircle, Copy, Check, Target, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// ================= Image Compression =================
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

export default function RoastScanner() {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isCopied, setIsCopied] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false); 
  const router = useRouter(); 

  const { complete, completion, isLoading } = useCompletion({
    api: '/api/scanner', // 确保这个路径和你后端的 API 文件路径一致
    onError: (error) => {
      // 🔴 核心拦截强化：安全解析后端的 JSON 报错
      try {
        const errorData = JSON.parse(error.message);
        
        // 匹配中文“积分不足”、英文“Insufficient credits”或特定 code
        if (
          errorData.code === 'INSUFFICIENT_CREDITS' ||
          (errorData.error && errorData.error.includes('Insufficient credits')) ||
          (errorData.error && errorData.error.includes('积分不足'))
        ) {
          setShowUpgradeModal(true);
          return;
        }
        
        // 如果是其他的 JSON 报错，只提取 error 字段，不弹原始 JSON 字符串
        alert('Oops: ' + (errorData.error || 'Something went wrong.'));
        
      } catch (e) {
        // 如果解析 JSON 失败（说明后端返回的纯文本格式），退回正则判断
        if (error.message.includes('402') || error.message.includes('积分不足')) {
          setShowUpgradeModal(true);
        } else {
          alert('Oops, something went wrong: ' + error.message);
        }
      }
    }
  });

  const handleCopy = () => {
    if (!completion) return;
    navigator.clipboard.writeText(completion);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // ================= File Selection =================
  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('We only roast images. Upload a valid photo.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Shrink your ego and your image size 😅');
      return;
    }

    const compressed = await compressImage(file, {
      maxSize: 1024,
      quality: 0.75,
    });

    setPreview(compressed);
  };

  // ================= Submit =================
  const handleSubmit = async () => {
    if (!preview || isLoading) return;

    // 每次请求前确保弹窗是关闭的
    setShowUpgradeModal(false);

    await complete('', {
      body: {
        imageBase64: preview.split(',')[1],
        mimeType: 'image/jpeg',
      },
    });
  };

  return (
    <div className="w-full text-foreground relative">
      <div className="mx-auto flex w-full flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex flex-col gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10">
              <Wand2 className="size-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                The Matchfix Scanner
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Upload Photo → AI Deep Scan → Brutally Honest Roast
              </p>
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ImageIcon className="size-5 text-muted-foreground" />
              Upload Your "Masterpiece"
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Supports JPG/PNG. Images are compressed locally before being judged by our AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="group relative grid min-h-[260px] w-full cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 outline-none transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="h-full w-full object-contain p-3"
                />
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

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-border">
              <div className="text-sm text-muted-foreground">
                {preview ? '✅ Photo loaded. Prepare for the execution.' : 'No photo selected yet.'}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-none h-11 text-muted-foreground gap-2"
                  onClick={() => {
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={isLoading || !preview}
                >
                  <XCircle className="w-4 h-4" /> Swap Photo
                </Button>
                
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !preview}
                  className="flex-1 sm:flex-none h-11 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-bold px-6"
                >
                  {isLoading ? (
                    'Brewing toxicity...'
                  ) : (
                    <span className="flex items-center gap-2">
                      Roast Me 🔥
                      <span className="inline-flex items-center rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                        🪙 5 Credits
                      </span>
                    </span>
                  )}
                </Button>

              </div>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground/60 bg-muted/20 py-4 rounded-b-xl">
            Disclaimer: For entertainment purposes only. Do not use this tool for actual cyberbullying. We are not responsible for bruised egos.
          </CardFooter>
        </Card>

        {/* Result Card */}
        {(completion || isLoading) && (
          <Card className="border-border bg-card shadow-sm overflow-hidden mt-6">
            <CardHeader className="bg-primary/5 border-b border-border flex flex-row items-center justify-between py-4">
              <CardTitle className="text-primary flex items-center gap-2 text-lg">
                ☠️ The Matchfix Verdict:
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="relative whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-5 text-sm md:text-base leading-relaxed text-foreground min-h-[120px]">
                
                {completion && !isLoading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    onClick={handleCopy}
                    title="Copy Roast"
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {!completion && isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full py-6 space-y-4">
                    <div className="flex space-x-1.5 items-center">
                      <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <p className="text-muted-foreground italic text-sm font-medium animate-pulse text-center">
                      Scanning for red flags and tragic life choices...
                    </p>
                  </div>
                ) : (
                  <div className="pr-8">
                    {completion}
                  </div>
                )}
              </div>

              {/* 底部附加功能按钮区 */}
              {completion && !isLoading && (
                <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-6 border-t border-border/40">
                  <Button 
                    asChild
                    className="w-full h-12 gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all text-base"
                  >
                    <Link href="/dashboard/photo-scorer">
                      <Target className="w-5 h-5" />
                      AI Photo Scorer
                      <span className="ml-1 inline-flex items-center rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                        🪙 5 Credits
                      </span>
                    </Link>
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>
        )}

      </div>

      {/* 🔴 余额不足弹窗 */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-100">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl mx-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="grid size-10 place-items-center rounded-full bg-destructive/10">
                <AlertCircle className="size-5 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Out of Credits 😅
              </h2>
            </div>
            
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Looks like you're out of ammo! Each brutally honest roast costs <strong>5 Credits</strong>. Reload your account to keep exposing those dating profile red flags.
            </p>
            
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowUpgradeModal(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setShowUpgradeModal(false);
                  router.push('/dashboard/pricing'); 
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