'use client';

import { useEffect, useRef, useState } from 'react';

// Resets every page load. 10-min countdown. Visual-only — no real
// price change is gated on this. See PaywallView for $4.99 → $12.99
// switch behavior when remaining hits 0.

const TOTAL_MS = 10 * 60 * 1000;

export interface CountdownState {
  remaining: number;
  expired: boolean;
}

export function useFakeCountdown(): CountdownState {
  const endRef = useRef<number | null>(null);
  if (endRef.current === null) endRef.current = Date.now() + TOTAL_MS;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const remaining = Math.max(0, (endRef.current ?? 0) - now);
  return { remaining, expired: remaining === 0 };
}

interface Props {
  remaining: number;
}

export default function CountdownDigits({ remaining }: Props) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const cs = Math.floor((remaining % 1000) / 10);

  const Seg = ({ v, label }: { v: string; label: string }) => (
    <div className="flex flex-col items-center">
      <div
        className="font-bold tabular-nums text-[20px] px-2 py-1 rounded-md leading-none text-white"
        style={{
          background: 'rgba(0,0,0,0.45)',
          minWidth: 36,
          textAlign: 'center',
          boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.25)',
        }}
      >
        {v}
      </div>
      <div className="text-[8.5px] mt-0.5 font-medium text-white/75">{label}</div>
    </div>
  );

  const colon = (
    <span className="font-bold text-[18px] pt-0 self-start text-white/70">:</span>
  );

  return (
    <div className="flex items-start justify-center gap-1">
      <Seg v={pad(h)} label="hr" />
      {colon}
      <Seg v={pad(m)} label="min" />
      {colon}
      <Seg v={pad(s)} label="sec" />
      {colon}
      <Seg v={pad(cs)} label="ms" />
    </div>
  );
}
