'use client';

import { useMemo } from 'react';

interface Particle {
  angle: number;
  dist: number;
  size: number;
  delay: number;
  color: string;
}

interface Props {
  count?: number;
  active: boolean;
  palette?: string[];
}

const DEFAULT_PALETTE = ['#ff385c', '#FFD86B', '#ffffff'];

export default function SparkleBurst({ count = 22, active, palette }: Props) {
  const colors = palette ?? DEFAULT_PALETTE;
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
        dist: 70 + Math.random() * 70,
        size: 4 + Math.random() * 6,
        delay: Math.random() * 0.15,
        color: colors[i % colors.length],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count],
  );

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            transform: active
              ? `translate(-50%,-50%) translate(${Math.cos(p.angle) * p.dist}px, ${Math.sin(p.angle) * p.dist}px) scale(0.2)`
              : 'translate(-50%,-50%) translate(0,0) scale(1)',
            opacity: active ? 0 : 1,
            transition: `transform 1.1s cubic-bezier(0.2,0.6,0.2,1) ${p.delay}s, opacity 1.1s ease-out ${p.delay}s`,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
