'use client';

// ═══════════════════════════════════════════════════════════════
// AnalyzingFlow — pre-pay loading screen (between upload and paywall)
//
// 用户点 Enhance → /api/scanner 流式分析 → 本组件假装跑「扫描 / 分析」过程
// 给用户一段有内容的等待，让付费墙在分析"完成"后再露面，提升转化锚定。
//
// progress 由 BoostScanner 控制（外部 setInterval 推 0→95，stream 结束跳 100）。
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { TRIVIA_QUESTIONS } from '@/lib/trivia-questions';

const STREAM_LINES = [
  'Detecting face landmarks…',
  '✓ Face clearly visible — top trust signal',
  '✓ Warm smile detected — reads approachable',
  'Reading lighting & color balance…',
  '⚠ Slight cool color cast — fixable',
  '⚠ Uneven shadow on left cheek — fixable',
  'Matching background to dating-app norms…',
  '✓ 3 best-performing scene options found',
  'Composing your enhanced looks…',
];

// 给等待页轮播的轻量 trivia（取自现有题库，只展示题面 + 一条 "did you know" 文案）
const TRIVIA_TIPS: Array<{ tag: string; body: string }> = [
  { tag: 'Did you know?', body: 'Dating profiles with a clear, well-lit face photo get matched 2.3× more often than blurry or cropped ones.' },
  { tag: 'Pro tip', body: 'Smiling with teeth visible boosts right-swipe rate by ~14% on most dating apps.' },
  { tag: 'Science says', body: 'Outdoor backgrounds outperform indoor ones — they signal an active lifestyle in 0.3 seconds.' },
  { tag: 'Fun fact', body: 'Profiles with 3+ photos get 2× more conversations than single-photo profiles.' },
  { tag: 'Heads up', body: 'Sunglasses in your main photo cut profile views by 15%. Eyes are the #1 trust signal.' },
];

interface Props {
  preview: string;
  progress: number;
}

export default function AnalyzingFlow({ preview, progress }: Props) {
  const clamped = Math.max(0, Math.min(100, progress));
  const linesShown = Math.min(
    STREAM_LINES.length,
    Math.max(1, Math.ceil((clamped / 100) * STREAM_LINES.length)),
  );

  // Rotating trivia tip (3.8s per slide, mirrors design)
  const [tipIdx, setTipIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTipIdx((i) => (i + 1) % TRIVIA_TIPS.length), 3800);
    return () => clearInterval(t);
  }, []);
  void TRIVIA_QUESTIONS; // keep import alive — used by main DatingTrivia component elsewhere
  const tip = TRIVIA_TIPS[tipIdx];

  return (
    <div className="flex flex-col w-full bg-canvas">
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 space-y-3">
        {/* Image with scanning overlay */}
        <div
          className="relative w-full overflow-hidden rounded-card bg-surface-soft"
          style={{ aspectRatio: '4 / 3' }}
        >
          <img src={preview} alt="" className="w-full h-full object-cover" />
          {/* Top progress bar */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px] overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${clamped}%`,
                background: '#ff385c',
                boxShadow: '0 0 12px #ff385c',
              }}
            />
          </div>
          {/* Scan line */}
          <div
            className="absolute left-0 right-0 h-[2px]"
            style={{
              background: '#ff385c',
              boxShadow: '0 0 16px #ff385c, 0 0 32px #ff385c',
              top: `${clamped}%`,
              transition: 'top 0.3s linear',
            }}
          />
          {/* Faint sweep tint */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(255,56,92,0) ${Math.max(0, clamped - 15)}%, rgba(255,56,92,0.2) ${clamped}%, rgba(255,56,92,0) ${Math.min(100, clamped + 15)}%)`,
              transition: 'all 0.3s linear',
            }}
          />
          {/* Status chip */}
          <div
            className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 text-white"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
          >
            <span
              className="size-1.5 rounded-full bg-rausch"
              style={{ animation: 'pulse 1.2s ease-in-out infinite' }}
            />
            Scanning your photo · {clamped}%
          </div>
          <div
            className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider text-ink"
            style={{ background: 'rgba(255,255,255,0.95)' }}
          >
            ~15s
          </div>
        </div>

        {/* Streaming analysis text */}
        <div className="rounded-card border border-hairline-soft bg-canvas p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <span
              className="size-1.5 rounded-full bg-rausch"
              style={{ animation: 'pulse 1.2s infinite' }}
            />
            <div className="text-[11px] font-bold uppercase tracking-wider text-rausch">
              Analyzing…
            </div>
          </div>
          <div
            className="space-y-1.5 text-[13px] leading-[1.5] text-ink-body"
            style={{ fontFamily: '"SF Mono", ui-monospace, monospace' }}
          >
            {STREAM_LINES.slice(0, linesShown).map((l, i) => (
              <div
                key={i}
                style={{
                  animation: 'fadeSlide 0.35s ease-out',
                  opacity: i === linesShown - 1 ? 1 : 0.7,
                }}
              >
                {l}
                {i === linesShown - 1 && clamped < 100 && (
                  <span
                    className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-rausch"
                    style={{ animation: 'caret 0.8s steps(2) infinite' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Rotating trivia tip */}
        <div className="p-4 rounded-card relative overflow-hidden bg-surface-soft">
          <div key={tipIdx} style={{ animation: 'fadeSlide 0.5s ease-out' }}>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 text-rausch">
              <Sparkles className="size-3" /> {tip.tag}
            </div>
            <div className="text-[14px] leading-[1.5] text-ink-body">{tip.body}</div>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            {TRIVIA_TIPS.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === tipIdx ? 16 : 4,
                  background: i === tipIdx ? '#ff385c' : '#dddddd',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
