'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flame, Check, ArrowRight, X } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';

interface Props {
  mainPhoto: string;
  // [2026-06-01 redesign] Subscription paywall (Weekly / Yearly).
  // Responsive: H5/mobile keeps the full-screen layout; desktop (lg+) renders
  // the two-panel modal layout. UI-first per user request — pricing/checkout
  // logic is TBD. `onUnlock` keeps its old signature so the parent
  // (BoostScanner) still compiles; the selected plan is held locally and will
  // be threaded into checkout once pricing/Creem wiring is confirmed.
  // TODO[pricing].
  onUnlock: (expired: boolean) => void;
  onReset: () => void;
  unlocking?: boolean; // disable CTA + show spinner copy while redirecting to Creem
}

// ─── Pricing (visual only — final amounts/Creem IDs wired in pricing pass) ──
const WEEKLY_PRICE = '$4.99';
const YEARLY_PRICE = '$39.99';
const YEARLY_PER_WEEK = '$0.77';

type PlanId = 'weekly' | 'yearly';

// Brand coral keeps the current Matchfix spec (Airbnb Rausch family) rather
// than the prototype's raw #FB3A5D. CTA reuses the existing gradient.
const BRAND = '#ff385c';
const CTA_GRADIENT =
  'linear-gradient(180deg, #FF5C7C 0%, #ff385c 55%, #e00b41 100%)';

// Keyframes for the photo-wall motion (entrance + column drift + ken-burns),
// shared by both the mobile and desktop layouts. Injected here because these
// are local to the paywall, not in globals.css.
const HERO_MOTION_CSS = `
@keyframes pwDriftA { 0%,100%{ transform:translateY(-14px);} 50%{ transform:translateY(14px);} }
@keyframes pwDriftB { 0%,100%{ transform:translateY(13px);} 50%{ transform:translateY(-13px);} }
@keyframes pwDriftC { 0%,100%{ transform:translateY(-10px);} 50%{ transform:translateY(16px);} }
.pw-col-a { animation:pwDriftA 7.5s ease-in-out infinite; }
.pw-col-b { animation:pwDriftB 8.8s ease-in-out infinite; }
.pw-col-c { animation:pwDriftC 8.1s ease-in-out infinite; }
@keyframes pwTileIn {
  0%{ opacity:0; transform:translateY(22px) scale(.9); filter:blur(6px); }
  100%{ opacity:1; transform:translateY(0) scale(1); filter:blur(0); }
}
.pw-tile { opacity:0; animation:pwTileIn .8s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes pwZoom { 0%,100%{ transform:scale(1);} 50%{ transform:scale(1.07);} }
.pw-tile-img { animation:pwZoom 12s ease-in-out infinite; transform-origin:center; }
@media (prefers-reduced-motion: reduce){
  .pw-col-a,.pw-col-b,.pw-col-c,.pw-tile,.pw-tile-img{ animation:none !important; opacity:1 !important; }
}
`;

// Per-tile look variations so the single uploaded photo reads as a collage
// instead of identical copies. `delayIdx` matches the prototype's stagger.
type TileCfg = { h: number; filter: string; pos: string; delayIdx: number; col: 'a' | 'b' | 'c' };

const MOBILE_TILES: TileCfg[] = [
  { h: 150, filter: 'saturate(1.08) brightness(1.04)', pos: '50% 30%', delayIdx: 0, col: 'a' },
  { h: 214, filter: 'contrast(1.06) saturate(1.05)', pos: '50% 45%', delayIdx: 1, col: 'b' },
  { h: 168, filter: 'sepia(0.14) saturate(1.18) brightness(1.03)', pos: '40% 50%', delayIdx: 2, col: 'c' },
  { h: 190, filter: 'brightness(1.02) contrast(1.04)', pos: '60% 40%', delayIdx: 3, col: 'a' },
  { h: 150, filter: 'grayscale(0.1) contrast(1.08)', pos: '50% 55%', delayIdx: 4, col: 'b' },
  { h: 178, filter: 'saturate(1.12) brightness(1.05)', pos: '45% 35%', delayIdx: 5, col: 'c' },
];

const WEB_TILES: TileCfg[] = [
  { h: 224, filter: 'saturate(1.08) brightness(1.04)', pos: '50% 30%', delayIdx: 0, col: 'a' },
  { h: 290, filter: 'contrast(1.06) saturate(1.05)', pos: '50% 45%', delayIdx: 1, col: 'b' },
  { h: 246, filter: 'sepia(0.14) saturate(1.18) brightness(1.03)', pos: '40% 50%', delayIdx: 2, col: 'c' },
  { h: 268, filter: 'brightness(1.02) contrast(1.04)', pos: '60% 40%', delayIdx: 3, col: 'a' },
  { h: 230, filter: 'grayscale(0.1) contrast(1.08)', pos: '50% 55%', delayIdx: 4, col: 'b' },
  { h: 256, filter: 'saturate(1.12) brightness(1.05)', pos: '45% 35%', delayIdx: 5, col: 'c' },
];

export default function PaywallView({ mainPhoto, onUnlock, onReset, unlocking = false }: Props) {
  const t = useT().paywall;
  const [plan, setPlan] = useState<PlanId>('weekly');

  const benefits = [t.benefitMatches, t.benefitScenes];
  const weeklySub = `${t.planWeeklySubPrefix}${WEEKLY_PRICE}${t.planWeeklySubSuffix}`;
  const yearlySub = `${t.planYearlySubPrefix}${YEARLY_PER_WEEK}${t.planYearlySubSuffix}`;

  // TODO[pricing]: thread `plan` into checkout once pricing/Creem confirmed.
  const handleContinue = () => !unlocking && onUnlock(false);

  return (
    <div
      className="pw-scroll relative flex flex-col w-full bg-canvas overflow-y-auto lg:items-center lg:justify-center lg:bg-surface-soft"
      style={{ minHeight: 'calc(100vh - 64px)', scrollbarWidth: 'none' }}
    >
      <style dangerouslySetInnerHTML={{ __html: HERO_MOTION_CSS }} />

      {/* ═══════════════ H5 / Mobile (full-screen) ═══════════════ */}
      <div className="lg:hidden w-full flex flex-col">
        <div className="relative">
          <PhotoWall mainPhoto={mainPhoto} tiles={MOBILE_TILES} height={326} colPad={{ a: 70, b: 44, c: 86 }} gap={8} radius={14} px={14} />

          {/* top scrim */}
          <div
            className="absolute top-0 left-0 right-0 pointer-events-none"
            style={{ height: 100, background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.82) 40%, rgba(255,255,255,0) 100%)' }}
          />
          {/* bottom fade into content */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{ height: 112, background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #fff 84%)' }}
          />

          {/* overlay chrome: close + logo */}
          <div className="absolute left-0 right-0 flex items-center justify-center px-[18px]" style={{ top: 16 }}>
            <CloseButton onClick={onReset} className="absolute left-4" style={{ top: -4 }} />
            <Logo />
          </div>
        </div>

        <div className="flex flex-col px-[22px] pt-0.5">
          <Headline t={t} size={27} />
          <Subline t={t} size={14} className="mb-4" />

          <div className="flex flex-col gap-3.5 mb-[22px]">
            {benefits.map((b, i) => (
              <BenefitRow key={i} label={b} size={14.5} />
            ))}
          </div>

          <div className="flex flex-col gap-[13px] mb-4">
            <PlanCardMobile label={t.planWeeklyLabel} sub={weeklySub} price={WEEKLY_PRICE} per={t.planPerWeek} tag={t.badgeMostPopular} tagKind="popular" selected={plan === 'weekly'} onSelect={() => setPlan('weekly')} />
            <PlanCardMobile label={t.planYearlyLabel} sub={yearlySub} price={YEARLY_PRICE} per={t.planPerYear} tag={t.badgeSave} tagKind="value" selected={plan === 'yearly'} onSelect={() => setPlan('yearly')} />
          </div>

          <ContinueButton t={t} unlocking={unlocking} onClick={handleContinue} height={58} fontSize={18} />

          <p className="text-center text-ink-soft font-medium" style={{ margin: '11px 0 0', fontSize: 12.5 }}>
            {t.cancelAnytime}
          </p>

          <FooterLinks t={t} onRestore={handleContinue} className="justify-center gap-[22px]" style={{ margin: '14px 0 18px' }} />
        </div>
      </div>

      {/* ═══════════════ Web / Desktop (two-panel modal) ═══════════════ */}
      <div
        className="hidden lg:flex bg-canvas overflow-hidden"
        style={{ width: 880, maxWidth: '100%', height: 560, borderRadius: 26, boxShadow: '0 40px 90px rgba(20,12,16,0.4)' }}
      >
        {/* left: animated photo wall + logo lockup */}
        <div className="relative shrink-0 overflow-hidden" style={{ width: 360, background: '#EDE7EA' }}>
          <PhotoWall mainPhoto={mainPhoto} tiles={WEB_TILES} fill colPad={{ a: 36, b: 8, c: 56 }} gap={10} radius={16} px={12} />
          {/* brand wash + bottom darken for logo legibility */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(180deg, rgba(255,56,92,0.14) 0%, rgba(255,56,92,0) 22%, rgba(20,12,16,0) 55%, rgba(20,12,16,0.5) 100%)' }}
          />
          <div className="absolute flex items-center gap-[9px] pointer-events-none" style={{ left: 26, bottom: 26 }}>
            <span
              className="inline-flex items-center justify-center"
              style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' }}
            >
              <Flame className="size-[22px] text-rausch" fill="currentColor" />
            </span>
            <span className="font-extrabold text-white" style={{ fontSize: 21, letterSpacing: '-0.3px', textShadow: '0 2px 10px rgba(0,0,0,.35)' }}>
              {t.brand}
            </span>
          </div>
        </div>

        {/* right: content */}
        <div className="flex-1 relative flex flex-col" style={{ padding: '46px 48px 32px' }}>
          <CloseButton onClick={onReset} className="absolute" style={{ top: 20, right: 20, background: '#F2F2F5' }} />

          <span
            className="self-start uppercase font-bold text-rausch"
            style={{ fontSize: 12, letterSpacing: 0.4, background: 'rgba(255,56,92,0.10)', padding: '5px 12px', borderRadius: 999, marginBottom: 16, whiteSpace: 'nowrap' }}
          >
            {t.proBadge}
          </span>

          <Headline t={t} size={34} />
          <Subline t={t} size={15} className="mb-[22px]" style={{ maxWidth: 380 }} />

          <div className="flex flex-col gap-3.5 mb-[26px]">
            {benefits.map((b, i) => (
              <BenefitRow key={i} label={b} size={15.5} nowrap />
            ))}
          </div>

          <div className="flex gap-3.5 mb-[22px]">
            <PlanCardWeb label={t.planWeeklyLabel} sub={weeklySub} price={WEEKLY_PRICE} per={t.planPerWeek} tag={t.badgeMostPopular} tagKind="popular" selected={plan === 'weekly'} onSelect={() => setPlan('weekly')} />
            <PlanCardWeb label={t.planYearlyLabel} sub={yearlySub} price={YEARLY_PRICE} per={t.planPerYear} tag={t.badgeSave} tagKind="value" selected={plan === 'yearly'} onSelect={() => setPlan('yearly')} />
          </div>

          <div className="mt-auto flex items-center gap-5">
            <ContinueButton t={t} unlocking={unlocking} onClick={handleContinue} height={56} fontSize={17} className="flex-1" />
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-ink-soft font-semibold" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                {t.cancelAnytime}
              </span>
              <FooterLinks t={t} onRestore={handleContinue} className="gap-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────
function Logo() {
  const t = useT().paywall;
  return (
    <div className="flex items-center gap-1.5">
      <Flame className="size-[22px] text-rausch" fill="currentColor" />
      <span className="text-[19px] font-extrabold tracking-[-0.3px] text-rausch">{t.brand}</span>
    </div>
  );
}

function CloseButton({ onClick, className, style }: { onClick: () => void; className?: string; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
      className={`grid place-items-center rounded-full ${className ?? ''}`}
      style={{
        width: 34,
        height: 34,
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        ...style,
      }}
    >
      <X className="size-3.5 text-ink-body" strokeWidth={2.4} />
    </button>
  );
}

function Headline({ t, size }: { t: ReturnType<typeof useT>['paywall']; size: number }) {
  return (
    <h1 className="text-ink font-extrabold" style={{ margin: '0 0 8px', fontSize: size, lineHeight: 1.1, letterSpacing: '-0.7px' }}>
      {t.heroTitle1}
      <br />
      {t.heroTitle2}
    </h1>
  );
}

function Subline({ t, size, className, style }: { t: ReturnType<typeof useT>['paywall']; size: number; className?: string; style?: React.CSSProperties }) {
  return (
    <p className={`text-ink-muted font-medium ${className ?? ''}`} style={{ margin: 0, fontSize: size, lineHeight: 1.45, ...style }}>
      {t.heroSubtitle}
    </p>
  );
}

function BenefitRow({ label, size, nowrap }: { label: string; size: number; nowrap?: boolean }) {
  return (
    <div className="flex items-center gap-[11px]">
      <span className="grid place-items-center rounded-full shrink-0 size-[22px]" style={{ background: 'rgba(255,56,92,0.10)' }}>
        <Check className="size-3 text-rausch" strokeWidth={3} />
      </span>
      <span className="text-ink font-semibold" style={{ fontSize: size, letterSpacing: '-0.1px', whiteSpace: nowrap ? 'nowrap' : undefined }}>
        {label}
      </span>
    </div>
  );
}

function ContinueButton({
  t,
  unlocking,
  onClick,
  height,
  fontSize,
  className,
}: {
  t: ReturnType<typeof useT>['paywall'];
  unlocking: boolean;
  onClick: () => void;
  height: number;
  fontSize: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={unlocking}
      className={`flex items-center justify-center gap-2 text-white font-extrabold disabled:opacity-70 ${className ?? ''}`}
      style={{ height, border: 'none', borderRadius: 16, background: CTA_GRADIENT, fontSize, letterSpacing: 0.1, boxShadow: '0 12px 26px rgba(255,56,92,0.36)' }}
    >
      {unlocking ? (
        t.redirectingCreem
      ) : (
        <>
          {t.ctaContinue}
          <ArrowRight className="size-4" strokeWidth={2.4} />
        </>
      )}
    </button>
  );
}

function FooterLinks({
  t,
  onRestore,
  className,
  style,
}: {
  t: ReturnType<typeof useT>['paywall'];
  onRestore: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`flex ${className ?? ''}`} style={style}>
      <Link href="/terms" className="text-ink-soft font-semibold no-underline" style={{ fontSize: 12.5 }}>
        {t.footerTerms}
      </Link>
      <Link href="/privacy" className="text-ink-soft font-semibold no-underline" style={{ fontSize: 12.5 }}>
        {t.footerPrivacy}
      </Link>
      <button type="button" onClick={onRestore /* TODO[pricing]: restore-purchases flow */} className="text-ink-soft font-semibold" style={{ fontSize: 12.5 }}>
        {t.footerRestore}
      </button>
    </div>
  );
}

// ── Photo wall (shared; mobile fixed-height vs web fill) ─────────────────
function PhotoWall({
  mainPhoto,
  tiles,
  height,
  fill,
  colPad,
  gap,
  radius,
  px,
}: {
  mainPhoto: string;
  tiles: TileCfg[];
  height?: number;
  fill?: boolean;
  colPad: Record<'a' | 'b' | 'c', number>;
  gap: number;
  radius: number;
  px: number;
}) {
  const cols: Array<'a' | 'b' | 'c'> = ['a', 'b', 'c'];
  return (
    <div className="relative overflow-hidden" style={fill ? { height: '100%' } : { height }}>
      <div className="grid h-full" style={{ gridTemplateColumns: '1fr 1.12fr 1fr', gap, padding: `0 ${px}px` }}>
        {cols.map((c) => (
          <div key={c} className={`pw-col-${c} flex flex-col`} style={{ gap, paddingTop: colPad[c] }}>
            {tiles.filter((tl) => tl.col === c).map((tl, i) => (
              <div
                key={i}
                className="pw-tile relative overflow-hidden bg-surface-soft"
                style={{ width: '100%', height: tl.h, borderRadius: radius, animationDelay: `${0.08 + tl.delayIdx * 0.09}s` }}
              >
                <img
                  src={mainPhoto}
                  alt=""
                  draggable={false}
                  className="pw-tile-img absolute inset-0 w-full h-full object-cover"
                  style={{ filter: tl.filter, objectPosition: tl.pos }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Plan card — mobile (horizontal row) ──────────────────────────────────
function PlanCardMobile(props: PlanCardProps) {
  const { label, sub, price, per, tag, tagKind, selected, onSelect } = props;
  return (
    <button type="button" onClick={onSelect} className="relative w-full text-left flex items-center gap-[13px] text-ink" style={planShellStyle(selected, '15px 16px')}>
      <Radio selected={selected} />
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.2px' }}>{label}</div>
        <div className="text-ink-muted" style={{ fontSize: 12.5, marginTop: 2, fontWeight: 500 }}>{sub}</div>
      </div>
      <div className="text-right shrink-0 flex items-baseline gap-0.5 justify-end">
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.6px' }}>{price}</span>
        <span className="text-ink-soft" style={{ fontSize: 12.5, fontWeight: 600 }}>{per}</span>
      </div>
      <PlanTag tag={tag} tagKind={tagKind} />
    </button>
  );
}

// ── Plan card — web (vertical, side-by-side) ─────────────────────────────
function PlanCardWeb(props: PlanCardProps) {
  const { label, sub, price, per, tag, tagKind, selected, onSelect } = props;
  return (
    <button type="button" onClick={onSelect} className="relative flex-1 text-left flex flex-col gap-1 text-ink" style={planShellStyle(selected, '20px 18px 18px')}>
      <div className="flex items-center gap-[9px]" style={{ marginBottom: 2 }}>
        <Radio selected={selected} size={20} />
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.2px' }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-[3px]">
        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.8px' }}>{price}</span>
        <span className="text-ink-soft" style={{ fontSize: 14, fontWeight: 600 }}>{per}</span>
      </div>
      <div className="text-ink-muted" style={{ fontSize: 13, fontWeight: 500 }}>{sub}</div>
      <PlanTag tag={tag} tagKind={tagKind} />
    </button>
  );
}

interface PlanCardProps {
  label: string;
  sub: string;
  price: string;
  per: string;
  tag: string;
  tagKind: 'popular' | 'value';
  selected: boolean;
  onSelect: () => void;
}

function planShellStyle(selected: boolean, padding: string): React.CSSProperties {
  return {
    background: selected ? 'rgba(255,56,92,0.06)' : '#fff',
    border: `2px solid ${selected ? BRAND : '#ECECEF'}`,
    borderRadius: 18,
    padding,
    boxShadow: selected ? '0 8px 22px rgba(255,56,92,0.16)' : 'none',
    transition: 'background .15s, border-color .15s, box-shadow .15s',
  };
}

function Radio({ selected, size = 22 }: { selected: boolean; size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-full shrink-0"
      style={{ width: size, height: size, border: `2px solid ${selected ? BRAND : '#D6D6DC'}`, background: selected ? BRAND : '#fff' }}
    >
      {selected && <Check className="size-3 text-white" strokeWidth={3} />}
    </span>
  );
}

function PlanTag({ tag, tagKind }: { tag: string; tagKind: 'popular' | 'value' }) {
  if (!tag) return null;
  return (
    <span
      className="absolute uppercase text-white"
      style={{
        top: -11,
        right: 14,
        background: tagKind === 'popular' ? BRAND : '#10241C',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        padding: '4px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
      }}
    >
      {tag}
    </span>
  );
}
