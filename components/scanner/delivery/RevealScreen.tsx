'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import SparkleBurst from './SparkleBurst';

interface Props {
  thumbs: string[];
  onContinue: () => void;
}

export default function RevealScreen({ thumbs, onContinue }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80);
    const t2 = setTimeout(() => setPhase(2), 520);
    const t3 = setTimeout(() => setPhase(3), 900);
    const t4 = setTimeout(() => onContinue(), 2100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onContinue]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 bg-canvas">
      <div className="relative grid place-items-center" style={{ width: 220, height: 220 }}>
        <SparkleBurst count={22} active={phase >= 1} />
        <div
          className="size-24 rounded-full grid place-items-center bg-rausch"
          style={{
            transform: phase >= 1 ? 'scale(1)' : 'scale(0)',
            transition: 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 14px 36px rgba(255,56,92,0.45)',
          }}
        >
          <Check className="size-12 text-white" strokeWidth={3} />
        </div>
      </div>

      <div
        className="mt-2 text-center"
        style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}
      >
        <div
          className="font-bold text-[28px] text-ink"
          style={{ letterSpacing: '-0.6px' }}
        >
          Photos unlocked!
        </div>
        <div className="text-[14px] mt-1.5 text-ink-muted">
          All 3 looks are yours · watermark-free
        </div>
      </div>

      <div
        className="mt-6 grid grid-cols-3 gap-2.5 w-full"
        style={{
          maxWidth: 300,
          opacity: phase >= 3 ? 1 : 0,
          transform: phase >= 3 ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.55s ease, transform 0.55s ease',
        }}
      >
        {thumbs.slice(0, 3).map((src, i) => (
          <div
            key={i}
            className="rounded-[10px] overflow-hidden"
            style={{
              aspectRatio: '4 / 5',
              boxShadow: '0 8px 22px rgba(0,0,0,0.16)',
              transform: phase >= 3 ? 'translateY(0)' : 'translateY(10px)',
              transition: `transform 0.5s cubic-bezier(0.2,0.8,0.2,1) ${0.05 * i}s`,
            }}
          >
            <img src={src} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      <div
        className="mt-5 text-[11px] flex items-center gap-1.5 text-ink-soft"
        style={{
          opacity: phase >= 3 ? 1 : 0,
          transition: 'opacity 0.4s ease 0.2s',
        }}
      >
        <span
          className="size-1 rounded-full bg-rausch"
          style={{ animation: 'pulse 1.2s ease-in-out infinite' }}
        />
        Loading your gallery…
      </div>
    </div>
  );
}
