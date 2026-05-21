'use client';

import { useMemo } from 'react';
import { useT } from '@/lib/i18n/provider';

const FEED_NAMES: [string, string][] = [
  ['Jenn**er', 'Mar*'], ['Em*ly', 'Da*id'], ['L*sa', 'T*m'], ['So**a', 'A*ex'],
  ['Mi**a', 'Ja*e'], ['Han**h', 'Ch*is'], ['Ol**ia', 'Br*'], ['Av*', 'No*h'],
  ['Mi*', 'Et**n'], ['Ch*e', 'Lia*'], ['Zo*', 'Lu*as'], ['Gr*ce', 'Be*'],
];

const PALETTES: [string, string][] = [
  ['#ff7a90', '#ff385c'], ['#ffaf7b', '#d76d77'], ['#a8c0ff', '#3f2b96'],
  ['#fdc830', '#f37335'], ['#43cea2', '#185a9d'], ['#ff9a9e', '#fad0c4'],
  ['#84fab0', '#8fd3f4'], ['#a18cd1', '#fbc2eb'],
];

function avatarFor(name: string) {
  const idx = (name.charCodeAt(0) * 13 + name.length) % PALETTES.length;
  const [c1, c2] = PALETTES[idx];
  return { initial: name[0], background: `linear-gradient(135deg, ${c1}, ${c2})` };
}

interface FeedStatus {
  text: string;
  emoji: string;
  color: string;
}

interface FeedItem {
  a: string;
  b: string;
  status: FeedStatus;
  time: string;
}

function FeedRow({ item }: { item: FeedItem }) {
  const avA = avatarFor(item.a);
  const avB = avatarFor(item.b);
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      <div className="flex -space-x-2 shrink-0">
        <div
          className="size-7 rounded-full grid place-items-center text-[10px] font-bold text-white"
          style={{ background: avA.background, boxShadow: '0 0 0 2px #fff' }}
        >
          {avA.initial}
        </div>
        <div
          className="size-7 rounded-full grid place-items-center text-[10px] font-bold text-white"
          style={{ background: avB.background, boxShadow: '0 0 0 2px #fff' }}
        >
          {avB.initial}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium truncate text-ink">
          <b>{item.a}</b> <span className="text-ink-muted">&amp;</span> <b>{item.b}</b>
        </div>
        <div className="text-[10.5px] text-ink-muted">{item.time}</div>
      </div>
      <div
        className="px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0"
        style={{ background: `${item.status.color}1A`, color: item.status.color }}
      >
        <span>{item.status.emoji}</span> {item.status.text}
      </div>
    </div>
  );
}

export default function LiveMatchFeed() {
  const t = useT().liveFeed;
  const FEED_STATUS = useMemo(() => [
    { text: t.matched, emoji: '💘', color: '#ec4899' },
    { text: t.chatting, emoji: '💬', color: '#3b82f6' },
    { text: t.dating, emoji: '🌹', color: '#ef4444' },
  ], [t]);
  const FEED_TIMES = useMemo(() => [
    t.time5min, t.time23min, t.time1hr, t.time3hr,
    t.yesterday, t.days2, t.days2, t.days3,
  ], [t]);
  const items = useMemo<FeedItem[]>(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const [a, b] = FEED_NAMES[i % FEED_NAMES.length];
      return {
        a,
        b,
        status: FEED_STATUS[i % FEED_STATUS.length],
        time: FEED_TIMES[i % FEED_TIMES.length],
      };
    });
  }, [FEED_STATUS, FEED_TIMES]);
  const doubled = [...items, ...items];

  return (
    <div className="rounded-[14px] border border-hairline-soft bg-canvas overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-hairline-soft">
        <span
          className="size-1.5 rounded-full"
          style={{
            background: '#22c55e',
            boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
            animation: 'pulse 1.4s ease-in-out infinite',
          }}
        />
        <div className="text-[12px] font-bold text-ink">{t.headerTitle}</div>
        <div className="ml-auto text-[10px] text-ink-muted">{t.headerWindow}</div>
      </div>
      <div
        className="relative h-[150px] overflow-hidden"
        style={{
          maskImage:
            'linear-gradient(180deg, transparent 0%, #000 10%, #000 90%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, transparent 0%, #000 10%, #000 90%, transparent 100%)',
        }}
      >
        <div
          className="absolute inset-x-0 px-3.5"
          style={{ animation: 'feedScroll 28s linear infinite' }}
        >
          {doubled.map((it, i) => (
            <div
              key={i}
              className={i < doubled.length - 1 ? 'border-b border-hairline-soft' : ''}
            >
              <FeedRow item={it} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
