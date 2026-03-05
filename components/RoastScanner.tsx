'use client';

import React, { useRef, useState } from 'react';
import { useCompletion } from 'ai/react';
import { Image as ImageIcon, Sparkles, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// ================= 图片压缩工具 =================
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

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { complete, completion, isLoading } = useCompletion({
    api: '/api/chat',
  });

  // ================= 选择图片 =================
  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('图片太大了，先冷静一下 😅');
      return;
    }

    const compressed = await compressImage(file, {
      maxSize: 1024,
      quality: 0.75,
    });

    setPreview(compressed);
  };

  // ================= 提交 =================
  const handleSubmit = async () => {
    if (!preview || isLoading) return;

    await complete('', {
      body: {
        imageBase64: preview.split(',')[1],
        mimeType: 'image/jpeg',
      },
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-neutral-800 bg-neutral-900/60">
              <Sparkles className="size-5 text-rose-400" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                Tinder 毒舌鉴渣师
              </h1>
              <p className="text-sm text-neutral-400">
                上传照片 → 走大模型 → 输出一份“专业且刻薄”的分析报告
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="border border-neutral-800 bg-neutral-900/60 text-neutral-200"
            >
              Deep dark UI
            </Badge>
            <Badge
              variant="secondary"
              className="border border-neutral-800 bg-neutral-900/60 text-neutral-200"
            >
              Image → /api/chat
            </Badge>
          </div>
        </div>

        <Card className="border-neutral-800 bg-neutral-950/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="size-5 text-neutral-300" />
              照片上传
            </CardTitle>
            <CardDescription className="text-neutral-400">
              支持 JPG/PNG 等常见格式。图片会在浏览器本地压缩后再发送。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              className="group relative grid min-h-[260px] w-full place-items-center overflow-hidden rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 outline-none transition hover:border-neutral-700 hover:bg-neutral-900/30 focus-visible:ring-2 focus-visible:ring-rose-400/60"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="h-full w-full object-contain p-3"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <div className="grid size-12 place-items-center rounded-2xl border border-neutral-800 bg-neutral-900/60">
                    <Upload className="size-5 text-neutral-300" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-neutral-200">
                      点击上传你的“照骗” 📸
                    </div>
                    <div className="text-xs text-neutral-500">
                      或者把文件拖到这里（可选）
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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-neutral-500">
                {preview ? '已选择图片，准备开始分析。' : '还没有选择图片。'}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="border border-neutral-800 bg-neutral-900/60 text-neutral-100 hover:bg-neutral-900"
                  onClick={() => {
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={isLoading || !preview}
                >
                  重新选择
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !preview}
                  className="bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-60"
                >
                  {isLoading ? '正在酝酿毒液...' : '开始喷我 🔥'}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-neutral-500">
            备注：仅用于演示/娱乐用途，请勿用于真实人身攻击。
          </CardFooter>
        </Card>

        {(completion || isLoading) && (
          <Card className="border-neutral-800 bg-neutral-950/40">
            <CardHeader>
              <CardTitle className="text-rose-400">☠️ 毒舌诊断报告：</CardTitle>
              <CardDescription className="text-neutral-400">
                输出为纯文本，保留换行格式。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm leading-relaxed text-neutral-100">
                {completion}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
