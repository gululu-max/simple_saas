'use client';

import { Flame, Check, Sparkles, Lock, ShieldCheck, Download } from 'lucide-react';
import CountdownDigits, { useFakeCountdown } from './CountdownDigits';
import LiveMatchFeed from './LiveMatchFeed';
import FakeThumbnails from './FakeThumbnails';
import { useT } from '@/lib/i18n/provider';

interface Props {
  mainPhoto: string;
  // [no-login pivot] expired 由 useFakeCountdown 决定（10 分钟促销价倒计时）。
  // BoostScanner 据此选择 promo / regular productId 调 Creem。
  onUnlock: (expired: boolean) => void;
  onReset: () => void;
  unlocking?: boolean; // 跳转 Creem 期间禁用按钮 + 显示 spinner
}

const hideScroll: React.CSSProperties = {
  scrollbarWidth: 'none',
  WebkitOverflowScrolling: 'touch',
};

// ─── Pricing ─────────────────────────────────────────────────────
// Promo prices apply while the countdown is alive; regular prices kick in
// after the 10-min timer expires. All visual only — final Creem product IDs
// will be wired in batch 2 (TODO[no-login]).
const BUNDLE_PROMO = '4.99';
const BUNDLE_REGULAR = '12.99';

export default function PaywallView({ mainPhoto, onUnlock, onReset, unlocking = false }: Props) {
  const t = useT().paywall;
  const SAVINGS_PILLS: Array<{ label: string; bg: string; color: string; icon?: boolean }> = [
    { label: t.savingPill1, bg: '#ff385c', color: '#fff', icon: true },
    { label: `${t.savingPill2Prefix}${BUNDLE_REGULAR}${t.savingPill2Suffix}`, bg: '#FFEDD5', color: '#9A3412' },
    { label: t.savingPill3, bg: '#DCFCE7', color: '#166534' },
    { label: t.savingPill4, bg: '#EDE9FE', color: '#5B21B6' },
    { label: t.savingPill5, bg: '#E0F2FE', color: '#075985' },
  ];

  const PROMISES = [
    t.promiseNoLogin,
    t.promiseAutoDeleted,
    t.promiseFreeRetry,
    t.promiseRefund,
  ];

  const PROOF_PILLS: Array<{ label: string; bg: string; color: string }> = [
    { label: t.proof1, bg: '#FFF7E6', color: '#B45309' },
    { label: t.proof2, bg: '#FCE7F3', color: '#9D174D' },
    { label: t.proof3, bg: '#FEE2E2', color: '#B91C1C' },
    { label: t.proof4, bg: '#DCFCE7', color: '#166534' },
    { label: t.proof5, bg: '#DBEAFE', color: '#1E40AF' },
    { label: t.proof6, bg: '#F3F4F6', color: '#374151' },
  ];

  const { remaining, expired } = useFakeCountdown();
  const bundlePrice = expired ? BUNDLE_REGULAR : BUNDLE_PROMO;
  const showStrikethrough = !expired;

  return (
    <div
      className="relative flex flex-col w-full bg-canvas"
      style={{ minHeight: 'calc(100vh - 64px)' }}
    >
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 140 }}
      >
        {/* 3 fake thumbnails — clearly visible, soft-locked, not clickable
            (per user feedback 2026-05-15: blurred previews shouldn't expand). */}
        <div className="px-4 pt-3">
          <FakeThumbnails src={mainPhoto} />
        </div>

        {/* Row 1: Savings / value pills (horizontal scroll) */}
        <div className="mt-2.5 overflow-x-auto" style={hideScroll}>
          <div className="inline-flex items-center gap-1.5 px-4 whitespace-nowrap">
            {SAVINGS_PILLS.map((p, i) => (
              <span
                key={i}
                className="text-[10.5px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1"
                style={{ background: p.bg, color: p.color }}
              >
                {p.icon ? <Flame className="size-2.5" /> : null}
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* Row 2: Promises (horizontal scroll) */}
        <div className="mt-2 overflow-x-auto" style={hideScroll}>
          <div className="inline-flex items-center gap-1.5 px-4 whitespace-nowrap">
            {PROMISES.map((label, i) => (
              <span
                key={i}
                className="text-[10.5px] font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 border border-hairline-soft bg-canvas text-ink-body"
              >
                <Check className="size-2.5 text-rausch" /> {label}
              </span>
            ))}
          </div>
        </div>

        {/* Row 3: Social proof (horizontal scroll) */}
        <div className="mt-2 overflow-x-auto" style={hideScroll}>
          <div className="inline-flex items-center gap-1.5 px-4 whitespace-nowrap">
            {PROOF_PILLS.map((p, i) => (
              <span
                key={i}
                className="text-[10.5px] px-2 py-1 rounded-full font-semibold inline-flex items-center gap-1"
                style={{ background: p.bg, color: p.color }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* Live match feed */}
        <div className="px-4 mt-3">
          <LiveMatchFeed />
        </div>

        {/* Tertiary */}
        <div className="px-4 mt-2">
          <button
            type="button"
            onClick={onReset}
            className="w-full py-2 text-[12px] font-medium text-ink-muted"
          >
            {t.tryDifferent}
          </button>
        </div>
      </div>

      {/* Sticky bottom: single combined CTA (countdown inside) + trust strip */}
      <div
        className="sticky bottom-0 left-0 right-0 px-4 pt-3 pb-5 bg-canvas"
        style={{ boxShadow: '0 -8px 24px rgba(0,0,0,0.08)' }}
      >
        <button
          type="button"
          onClick={() => !unlocking && onUnlock(expired)}
          disabled={unlocking}
          className="relative w-full overflow-hidden flex flex-col items-center justify-center disabled:opacity-70"
          style={{
            background:
              'linear-gradient(180deg, #FF5C7C 0%, #ff385c 55%, #e00b41 100%)',
            borderRadius: 16,
            paddingTop: 10,
            paddingBottom: 12,
            boxShadow: '0 10px 32px rgba(255,56,92,0.5)',
            animation: expired || unlocking ? 'none' : 'breathe 2.4s ease-in-out infinite',
          }}
        >
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%)',
              animation: 'shimmer 2.4s ease-in-out infinite',
            }}
          />
          {!expired ? (
            <>
              <div className="relative z-10 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#FFE082]">
                <Flame className="size-3" /> {t.priceGoingUp}
              </div>
              <div className="relative z-10 mt-1">
                <CountdownDigits remaining={remaining} />
              </div>
            </>
          ) : (
            <div className="relative z-10 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-white/80">
              <Flame className="size-3" /> {t.limitedEnded}
            </div>
          )}
          <div className="relative z-10 flex items-baseline gap-2 mt-2">
            {unlocking ? (
              <span className="font-bold text-[17px] text-white">{t.redirectingCreem}</span>
            ) : (
              <>
                <span className="font-bold text-[17px] text-white">{t.unlockAll3}</span>
                <span
                  className="font-bold text-[22px] text-white"
                  style={{ letterSpacing: '-0.3px' }}
                >
                  ${bundlePrice}
                </span>
                {showStrikethrough && (
                  <span
                    className="text-[13px] text-white/70"
                    style={{ textDecoration: 'line-through' }}
                  >
                    ${BUNDLE_REGULAR}
                  </span>
                )}
              </>
            )}
          </div>
        </button>

        <TrustStrip />
      </div>
    </div>
  );
}

function TrustStrip() {
  const t = useT().scannerCommon;
  return (
    <div className="text-[10.5px] text-center mt-2 flex items-center justify-center gap-2 flex-wrap text-ink-soft">
      <span className="inline-flex items-center gap-1">
        <Lock className="size-2.5" /> {t.creemSecured}
      </span>
      <span>·</span>
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className="size-2.5" /> {t.refund3}
      </span>
      <span>·</span>
      <span className="inline-flex items-center gap-1">
        <Download className="size-2.5" /> {t.instantDownload}
      </span>
    </div>
  );
}

