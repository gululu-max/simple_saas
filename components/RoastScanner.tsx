'use client';

import React, { useRef, useState } from 'react';
import { useCompletion } from 'ai/react';
import Link from 'next/link';
// 🚀 引入 usePathname 获取当前路由
import { useRouter, usePathname } from 'next/navigation';
import { Zap, Flame, Loader2 } from "lucide-react";
import {
  Image as ImageIcon,
  Wand2,
  Upload,
  XCircle,
  Copy,
  Check,
  Target,
  AlertCircle,
  Coins
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

// 🚀 [GA接入] 引入 Google Analytics 事件发送函数
import { sendGAEvent } from '@next/third-parties/google';

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

export default function RoastScanner() {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCopied, setIsCopied] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // 🚀 初始化路由工具
  const router = useRouter();
  const pathname = usePathname();

  const { complete, completion, isLoading } = useCompletion({
    api: '/api/scanner',
    // 🚀 【关键修复】：在成功完成流输出后触发刷新
    onFinish: () => {
      // 🚀 [GA接入] 埋点：成功生成 Roast 结果
      sendGAEvent({ event: 'roast_complete', status: 'success' });
      // 这里的 refresh 会在后台静默重新获取 Server Component 的数据（比如 layout.tsx 里的 credits）
      // 且不会打断或重置当前 Client Component（RoastScanner）的任何状态
      router.refresh();
    },
    onError: (error) => {
      // 🔴 错误拦截：安全解析后端返回的 JSON 报错
      try {
        const errorData = JSON.parse(error.message);

        // 匹配积分不足的多种判断条件
        if (
          errorData.code === 'INSUFFICIENT_CREDITS' ||
          (errorData.error && errorData.error.includes('Insufficient credits')) ||
          (errorData.error && errorData.error.includes('积分不足'))
        ) {
          // 🚀 [GA接入] 埋点：因积分不足被拦截
          sendGAEvent({ event: 'roast_failed', reason: 'insufficient_credits' });
          setShowUpgradeModal(true);
          return;
        }

        alert('Oops: ' + (errorData.error || 'Something went wrong.'));

      } catch (e) {
        // 如果解析失败，则尝试正则匹配纯文本错误
        if (error.message.includes('402') || error.message.includes('积分不足')) {
          // 🚀 [GA接入] 埋点：因积分不足被拦截
          sendGAEvent({ event: 'roast_failed', reason: 'insufficient_credits' });
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
    // 🚀 [GA接入] 埋点：用户复制了生成的文案
    sendGAEvent({ event: 'roast_copy_result' });
    setTimeout(() => setIsCopied(false), 2000);
  };

  // ================= 文件选择与本地处理 =================
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
      alert('File too large. (Max 10MB)');
      return;
    }

    // 🚀 [GA接入] 埋点：用户成功选择了符合要求的图片
    sendGAEvent({ event: 'roast_image_selected', file_size: Math.round(file.size / 1024) });

    const compressed = await compressImage(file, {
      maxSize: 1024,
      quality: 0.75,
    });

    setPreview(compressed);
  };

  // ================= 提交分析 =================
  const handleSubmit = async () => {
    if (!preview || isLoading) return;

    setShowUpgradeModal(false);

    // 🚀 [GA接入] 埋点：用户点击了分析按钮
    sendGAEvent({ event: 'roast_start_click' });

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

        {/* 头部标题区 */}
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

        {/* 上传卡片 */}
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
              onClick={() => fileInputRef.current?.click()}
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
                {preview ? '✅ Photo loaded. Ready to roast.' : 'No photo selected yet.'}
              </div>
              {/* 🚀 1. 改父容器：手机端纵向反转排列，sm 以上横向排列 */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">

                <Button
                  type="button"
                  variant="outline"
                  /* 🚀 2. 改 Swap 按钮宽度：手机端全宽，sm 以上自适应内容宽度 */
                  className="w-full sm:w-auto h-11 text-muted-foreground gap-2"
                  onClick={() => {
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    // 🚀 [GA接入] 埋点：用户清除了预览图
                    sendGAEvent({ event: 'roast_image_reset' });
                  }}
                  disabled={isLoading || !preview}
                >
                  <XCircle className="w-4 h-4" /> Swap Photo
                </Button>

                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !preview}
                  /* 🚀 3. 改 Roast 按钮宽度：逻辑同上 */
                  className="w-full sm:w-auto h-11 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-bold px-6"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Brewing toxicity...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Roast Me
                      <span className="inline-flex items-center rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                        <Zap className="mr-1 h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        5 Credits
                      </span>
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground/60 bg-muted/20 py-4 rounded-b-xl">
            Disclaimer: For entertainment purposes only.
          </CardFooter>
        </Card>

        {/* 结果展示卡片 */}
        {(completion || isLoading) && (
          <Card className="border-border bg-card shadow-sm overflow-hidden mt-6">
            <CardHeader className="bg-primary/5 border-b border-border">
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
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={handleCopy}
                  >
                    {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}

                {!completion && isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full py-6 space-y-4">
                    <div className="flex space-x-1.5 items-center">
                      <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <p className="text-muted-foreground italic text-sm font-medium animate-pulse">
                      Scanning for red flags...
                    </p>
                  </div>
                ) : (
                  <div className="pr-8">{completion}</div>
                )}
              </div>

              {completion && !isLoading && (
                <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-6 border-t border-border/40">
                  <Button
                    asChild
                    className="w-full h-12 gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                    // 🚀 [GA接入] 埋点：点击下方的交叉销售按钮
                    onClick={() => sendGAEvent({ event: 'roast_upsell_click', target: 'photo_scorer' })}
                  >
                    <Link href="/dashboard/photo-scorer">
                      <Target className="w-5 h-5" />
                      AI Photo Scorer
                      <span className="ml-1 inline-flex items-center rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                        <Zap className="mr-1 h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                        10 Credits
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 mx-4 bg-card border border-border rounded-2xl shadow-xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">

            <div className="grid size-16 place-items-center rounded-full bg-primary/10 mb-4 border border-primary/20">
              <Coins className="size-8 text-primary" />
            </div>

            <h2 className="text-xl font-bold text-foreground mb-2">
              Low Balance! 😅
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Each roast costs <span className="font-bold text-foreground">5 Credits</span>. Reload your account to continue.
            </p>

            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={() => {
                  setShowUpgradeModal(false);
                  // 🚀 [GA接入] 埋点：关闭充值弹窗
                  sendGAEvent({ event: 'upgrade_modal_cancel' });
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold"
                onClick={() => {
                  setShowUpgradeModal(false);
                  // 🚀 [GA接入] 埋点：点击充值跳转
                  sendGAEvent({ event: 'upgrade_modal_click_refill' });
                  // 🚀 修改：把查询参数（?from=...）放在锚点（#pricing）前面
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
  );
}