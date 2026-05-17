'use client';

// ═══════════════════════════════════════════════════════════════
// GenerationProgress — 6 假步骤 / 15s 总时长（参考 design 稿）
//
// 付费后等待真图期间显示。进度条节奏：
//   - !ready (真图还没到)：用 13.5s 走到 90%，然后卡死在 90% / 步骤 5 「🎉 Almost ready」
//   - ready (paidVariants 落地)：用 0.4s 平滑从当前进度收尾到 100%，所有 6 步打勾
//
// 这样可以避免"假进度跑完了 100% 但真图还在跑"的尴尬感。
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

const GEN_STEPS: Array<{ icon: string; label: string; duration: number }> = [
  { icon: '🔍', label: 'Analyzing your face & lighting', duration: 2500 },
  { icon: '🎨', label: 'Picking dating-app color palette', duration: 2500 },
  { icon: '🌅', label: 'Matching 3 background scenes', duration: 3000 },
  { icon: '✨', label: 'Applying skin & smile retouch', duration: 3000 },
  { icon: '📸', label: 'Composing your 3 final looks', duration: 2500 },
  { icon: '🎉', label: 'Almost ready', duration: 1500 },
];
const GEN_TOTAL = GEN_STEPS.reduce((a, s) => a + s.duration, 0); // 15000

// 真图未到时进度上限（90%）。13.5s 走到这里然后卡住。
const CAP_BEFORE_READY = 90;
// !ready 增速：13500ms 走到 90% → 90 / 13500 = 0.00667 %/ms
const RATE_BEFORE_READY = CAP_BEFORE_READY / 13500;
// ready 后的收尾速度：~400ms 走完剩余（如果已到 90 → 还差 10%，400ms 内拉满）
const RATE_AFTER_READY = 100 / 400;

interface Props {
  /** 真图就绪 → 允许进度跑完到 100% 并把 6 步全部打勾 */
  ready: boolean;
}

export default function GenerationProgress({ ready }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const target = ready ? 100 : CAP_BEFORE_READY;
        if (p >= target) return target;
        const rate = ready ? RATE_AFTER_READY : RATE_BEFORE_READY;
        return Math.min(target, p + rate * dt);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  // 把 progress (%) 映射回 elapsed (ms) 决定当前是哪一步
  const elapsed = (progress / 100) * GEN_TOTAL;
  let cum = 0;
  let activeIdx = GEN_STEPS.length; // 默认全部完成
  for (let i = 0; i < GEN_STEPS.length; i++) {
    if (elapsed < cum + GEN_STEPS[i].duration) {
      activeIdx = i;
      break;
    }
    cum += GEN_STEPS[i].duration;
  }

  return (
    <div className="rounded-card overflow-hidden border border-hairline-soft bg-canvas">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
        <span
          className="size-1.5 rounded-full bg-rausch"
          style={{ animation: 'pulse 1.1s ease-in-out infinite' }}
        />
        <div className="text-[11px] font-bold uppercase tracking-wider text-rausch">
          Generating your photos
        </div>
        <div className="ml-auto text-[11px] tabular-nums font-semibold text-ink-muted">
          {Math.round(progress)}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] mx-3.5 rounded-full overflow-hidden bg-surface-strong">
        <div
          className="h-full rounded-full bg-rausch"
          style={{
            width: `${progress}%`,
            boxShadow: '0 0 10px #ff385c',
            transition: 'width 0.3s linear',
          }}
        />
      </div>

      {/* Steps */}
      <div className="px-3.5 pt-2.5 pb-3 space-y-1.5">
        {GEN_STEPS.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          const pending = i > activeIdx;
          return (
            <div
              key={i}
              className="flex items-center gap-2.5"
              style={{
                opacity: pending ? 0.32 : 1,
                transition: 'opacity 0.3s',
              }}
            >
              {/* Status icon */}
              <div className="size-5 grid place-items-center shrink-0">
                {done && (
                  <div
                    className="size-5 rounded-full grid place-items-center bg-rausch"
                    style={{ animation: 'pop 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
                  >
                    <Check className="size-3 text-white" strokeWidth={3} />
                  </div>
                )}
                {active && (
                  <div
                    className="size-3.5 rounded-full border-2 border-rausch"
                    style={{
                      borderTopColor: 'transparent',
                      animation: 'spin 0.9s linear infinite',
                    }}
                  />
                )}
                {pending && (
                  <div className="size-1.5 rounded-full bg-hairline" />
                )}
              </div>

              {/* Step emoji */}
              <span className="text-[13px] leading-none">{s.icon}</span>

              {/* Label */}
              <div
                className="text-[12.5px] flex-1 min-w-0 truncate"
                style={{
                  color: active ? '#222' : done ? '#3f3f3f' : '#6a6a6a',
                  fontWeight: active ? 600 : 500,
                  fontFamily: '"SF Mono", ui-monospace, monospace',
                }}
              >
                {s.label}
                {active && (
                  <span
                    className="inline-block w-1.5 h-3 ml-1 align-middle bg-rausch"
                    style={{ animation: 'caret 0.8s steps(2) infinite' }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
