'use client';

import { Lock, Sparkles } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';

// Three CSS-only "AI looks" generated from the user's photo.
// No real enhance call happens before payment — this is the placeholder.

export interface FakeLook {
  id: 'natural' | 'outdoor' | 'studio';
  label: string;
  tag: string;
  filter: string;
}

// Filters are visual only; labels/tags resolved at render time via useT()
// to follow the current locale. Keep this exported because BoostScanner
// references the id/filter values for the post-payment delivery mocks.
export const FAKE_LOOKS: FakeLook[] = [
  {
    id: 'natural',
    label: 'Natural',
    tag: 'Classic dating-app look',
    filter: 'blur(2.5px) brightness(1.06) saturate(1.12) contrast(1.02)',
  },
  {
    id: 'outdoor',
    label: 'Outdoor',
    tag: 'Cafe & golden-hour vibe',
    filter: 'blur(2.5px) sepia(0.22) hue-rotate(-10deg) saturate(1.18) brightness(1.04)',
  },
  {
    id: 'studio',
    label: 'Studio',
    tag: 'Clean professional crop',
    filter: 'blur(2.5px) grayscale(0.12) contrast(1.12) brightness(0.96)',
  },
];

interface Props {
  src: string;
  onTap?: (idx: number) => void;
}

export default function FakeThumbnails({ src, onTap }: Props) {
  const t = useT().fakeThumbs;
  const interactive = !!onTap;
  const labelFor: Record<FakeLook['id'], string> = {
    natural: t.naturalLabel,
    outdoor: t.outdoorLabel,
    studio: t.studioLabel,
  };
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {FAKE_LOOKS.map((look, i) => {
          const content = (
            <>
              <img
                src={src}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: look.filter }}
                draggable={false}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
                }}
              />
              <div className="absolute inset-0 grid place-items-center pointer-events-none overflow-hidden">
                <div
                  className="text-[10px] font-bold tracking-widest whitespace-nowrap text-white/55"
                  style={{
                    transform: 'rotate(-28deg)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  matchfix · matchfix
                </div>
              </div>
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rausch text-white">
                Look {i + 1}
              </div>
              <div
                className="absolute top-1.5 right-1.5 size-5 rounded-full grid place-items-center"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
              >
                <Lock className="size-2.5 text-white" />
              </div>
              <div
                className="absolute inset-x-1.5 bottom-1 text-center text-[10.5px] font-bold tracking-wide text-white"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.65)' }}
              >
                {labelFor[look.id]}
              </div>
            </>
          );

          const className = 'relative overflow-hidden rounded-[12px] bg-surface-soft';
          const style = { aspectRatio: '4 / 5' as const };

          return interactive ? (
            <button
              key={look.id}
              type="button"
              onClick={() => onTap?.(i)}
              className={className}
              style={style}
            >
              {content}
            </button>
          ) : (
            <div key={look.id} className={className} style={style}>
              {content}
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-center mt-1.5 flex items-center justify-center gap-1 text-ink-muted">
        <Sparkles className="size-3 text-rausch" />
        {t.threeReady}
      </div>
    </>
  );
}
