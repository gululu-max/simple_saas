'use client';

import { useState } from 'react';
import { Check, Download } from 'lucide-react';
import BeforeAfterSlider from './BeforeAfterSlider';

export interface DeliveryVariant {
  id: string;
  label: string;
  tag: string;
  // Either a real URL (post-payment, server-rendered) OR a filter to apply
  // to the original photo for the mock preview.
  afterSrc?: string;
  filter?: string;
}

interface Props {
  originalSrc: string;
  variants: DeliveryVariant[];
  onSaveAll: () => void;
  onRegenerate: () => void;
  onClose: () => void;
  saving?: boolean;
}

export default function DeliveryScreen({
  originalSrc,
  variants,
  onSaveAll,
  onRegenerate,
  onClose,
  saving = false,
}: Props) {
  const [idx, setIdx] = useState(0);
  const current = variants[idx];
  const afterSrc = current.afterSrc ?? originalSrc;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-canvas">
      <div className="flex items-center justify-between px-4 h-14 border-b border-hairline-soft bg-canvas shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to home"
          className="font-bold text-[20px] text-rausch -ml-1 px-1 py-1 rounded hover:opacity-80 transition-opacity"
          style={{ letterSpacing: '-0.5px' }}
        >
          matchfix
        </button>
        <div
          className="px-2.5 py-1 rounded-pill text-[10.5px] font-bold flex items-center gap-1"
          style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
        >
          <Check className="size-3" strokeWidth={3} /> Unlocked
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 140 }}>
        <div className="px-5 pt-4">
          <h1
            className="font-bold text-[22px] leading-[1.1] text-ink"
            style={{ letterSpacing: '-0.4px' }}
          >
            Your 3 looks
          </h1>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Drag the slider to compare before & after.
          </p>
        </div>

        <div
          className="px-5 mt-3"
          style={{ animation: 'fadeSlide 0.45s ease-out' }}
        >
          <BeforeAfterSlider
            beforeSrc={originalSrc}
            afterSrc={afterSrc}
            afterFilter={current.filter}
            defaultPos={55}
            className="rounded-card"
            style={{
              aspectRatio: '4 / 5',
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            }}
          />
        </div>

        <div className="px-5 mt-3">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-[15px] text-ink">
              Look {idx + 1} · {current.label}
            </span>
            <span className="text-[12px] text-ink-muted">· {current.tag}</span>
          </div>
        </div>

        <div className="px-5 mt-3">
          <div className="grid grid-cols-3 gap-2">
            {variants.map((v, i) => {
              const thumbSrc = v.afterSrc ?? originalSrc;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  className="relative overflow-hidden rounded-[12px]"
                  style={{
                    aspectRatio: '4 / 5',
                    boxShadow:
                      i === idx
                        ? '0 0 0 3px #ff385c, 0 8px 22px rgba(255,56,92,0.22)'
                        : '0 0 0 1px #ebebeb',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  <img
                    src={thumbSrc}
                    alt=""
                    className="w-full h-full object-cover"
                    style={v.filter ? { filter: v.filter } : undefined}
                    draggable={false}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)',
                    }}
                  />
                  <div
                    className="absolute inset-x-1.5 bottom-1 text-center text-[10.5px] font-bold tracking-wide text-white"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                  >
                    {v.label}
                  </div>
                  {i === idx && (
                    <div
                      className="absolute top-1.5 right-1.5 size-5 rounded-full grid place-items-center bg-rausch"
                      style={{ boxShadow: '0 2px 8px rgba(255,56,92,0.4)' }}
                    >
                      <Check className="size-2.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 mt-7 text-center">
          <button
            type="button"
            onClick={onRegenerate}
            className="text-[11.5px] underline underline-offset-2 text-ink-soft"
          >
            Generate new looks (costs another unlock)
          </button>
        </div>
      </div>

      <div
        className="absolute left-0 right-0 bottom-0 px-4 pt-3 pb-5 bg-canvas"
        style={{ boxShadow: '0 -8px 24px rgba(0,0,0,0.08)' }}
      >
        <button
          type="button"
          onClick={onSaveAll}
          disabled={saving}
          className="relative w-full h-14 rounded-[14px] overflow-hidden flex items-center justify-center gap-2 font-bold text-[17px] text-white bg-rausch disabled:opacity-70 disabled:cursor-wait"
          style={{ boxShadow: '0 8px 24px rgba(255,56,92,0.4)' }}
        >
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.3) 50%, transparent 65%)',
              animation: 'shimmer 2.6s ease-in-out infinite',
            }}
          />
          <Download className="size-5 relative z-10" />
          <span className="relative z-10">
            {saving ? 'Saving…' : 'Save all 3 to Photos'}
          </span>
        </button>
        <div className="text-[11px] text-center mt-2 text-ink-soft">
          Saves directly to your camera roll
        </div>
      </div>
    </div>
  );
}
