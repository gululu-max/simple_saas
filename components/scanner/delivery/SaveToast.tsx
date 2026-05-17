'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import SparkleBurst from './SparkleBurst';

interface Props {
  onDone: () => void;
  durationMs?: number;
}

const TOAST_PALETTE = ['#16a34a', '#86efac', '#FFD86B'];

export default function SaveToast({ onDone, durationMs = 2400 }: Props) {
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setBurst(true), 80);
    const t2 = setTimeout(() => onDone(), durationMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone, durationMs]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      style={{
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(2px)',
        animation: 'fadeSlide 0.25s ease-out',
      }}
    >
      <div
        className="relative w-full max-w-[300px] rounded-[22px] py-7 px-6 flex flex-col items-center bg-canvas"
        style={{
          boxShadow:
            '0 28px 72px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.04)',
          animation: 'pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div
          className="relative grid place-items-center mb-4"
          style={{ width: 120, height: 120 }}
        >
          <SparkleBurst count={18} active={burst} palette={TOAST_PALETTE} />
          <div
            className="size-[72px] rounded-full grid place-items-center"
            style={{
              background: '#16a34a',
              boxShadow: '0 12px 28px rgba(22,163,74,0.45)',
              animation: 'pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s both',
            }}
          >
            <Check className="size-10 text-white" strokeWidth={3} />
          </div>
        </div>
        <div
          className="font-bold text-[24px] text-ink"
          style={{ letterSpacing: '-0.4px' }}
        >
          Saved!
        </div>
        <div className="text-[14px] mt-1.5 text-center leading-[1.4] text-ink-muted">
          3 photos added to your album
        </div>
        <div
          className="mt-3 px-2.5 py-1 rounded-pill text-[10.5px] font-bold flex items-center gap-1.5"
          style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
        >
          <span className="size-1.5 rounded-full" style={{ background: '#16a34a' }} />
          Look 1 · Look 2 · Look 3
        </div>
      </div>
    </div>
  );
}
