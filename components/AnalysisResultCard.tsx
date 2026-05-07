"use client";

import React, { useMemo } from "react";
import {
  Sun, Camera, Mountain, Eye, Smile, Palette, Shirt, Focus,
  AlertTriangle, ThumbsUp, Crosshair, Copy, Check, TrendingUp,
  ChevronRight, ImageOff, Sparkles,
} from "lucide-react";

type Route = 'needs_real_photo' | 'already_great' | 'can_improve';
type Authenticity = 'usable' | 'suspiciously_edited' | 'unusable';

interface AnalysisData {
  authenticity?: Authenticity | string;
  route?: Route | string;
  scores?: { attractiveness?: number; approachability?: number; confidence?: number } | null;
  percentile?: number | null;
  diagnostics?: {
    lighting?: number; composition?: number; background?: number; eye_contact?: number;
    expression?: number; color_grading?: number; clothing?: number; sharpness?: number;
  } | null;
  match_prediction?: { current_rate?: string; enhanced_rate?: string } | null;
  copy?: {
    headline?: string;
    one_liner_positive?: string | null;
    one_liner_issue?: string | null;
    first_impression?: string | null;
    cta?: string;
  };
  main_issue?: string;
  positive?: string;
  red_flags?: string[];
  fix_plan?: { visual_outcome?: string } | null;
}

interface AnalysisResultCardProps {
  analysisJSON: string | null;
  visibleText: string;
  onCopy: () => void;
  isCopied: boolean;
}

// ── Circular Gauge — ink stroke, no traffic-light coloring ──
function CircularGauge({ score, label }: { score: number; label: string }) {
  const r = 26, circ = 2 * Math.PI * r;
  const s = Math.max(0, Math.min(10, score));
  const progress = (s / 10) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-[64px]">
        <svg viewBox="0 0 64 64" className="size-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#ebebeb" strokeWidth="4" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="#222222" strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - progress} className="transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[18px] font-semibold text-ink tabular-nums">{s}</span>
        </div>
      </div>
      <span className="text-[12px] text-ink-muted text-center leading-tight">{label}</span>
    </div>
  );
}

// ── Diagnostic Row — amenity-row style ──
const diagnosticConfig: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'lighting', label: 'Lighting', icon: Sun },
  { key: 'composition', label: 'Composition', icon: Camera },
  { key: 'background', label: 'Background', icon: Mountain },
  { key: 'eye_contact', label: 'Eye Contact', icon: Eye },
  { key: 'expression', label: 'Expression', icon: Smile },
  { key: 'color_grading', label: 'Color', icon: Palette },
  { key: 'clothing', label: 'Clothing', icon: Shirt },
  { key: 'sharpness', label: 'Sharpness', icon: Focus },
];

function DiagnosticRow({ icon: Icon, label, score }: { icon: React.ElementType; label: string; score: number }) {
  const s = Math.max(0, Math.min(10, score));
  const pct = s * 10;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-hairline-soft last:border-b-0">
      <Icon className="size-4 text-ink-muted shrink-0" />
      <span className="text-sm text-ink w-[110px] shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-hairline-soft rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-ink transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-ink w-6 text-right tabular-nums">{s}</span>
    </div>
  );
}

// ── Insight row — icon + heading + body, hairline-separated ──
function InsightRow({
  icon: Icon, heading, body, accent,
}: {
  icon: React.ElementType;
  heading: string;
  body: React.ReactNode;
  accent?: 'rausch' | 'ink' | 'amber' | 'emerald';
}) {
  const iconColor =
    accent === 'rausch' ? 'text-rausch' :
    accent === 'amber' ? 'text-amber-600' :
    accent === 'emerald' ? 'text-emerald-600' :
    'text-ink-muted';
  return (
    <div className="flex items-start gap-3 py-4 border-b border-hairline-soft last:border-b-0">
      <Icon className={`size-5 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink mb-1">{heading}</div>
        <div className="text-sm text-ink-body leading-relaxed">{body}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function AnalysisResultCard({ analysisJSON, visibleText, onCopy, isCopied }: AnalysisResultCardProps) {
  const data: AnalysisData | null = useMemo(() => {
    if (!analysisJSON) return null;
    try { return JSON.parse(analysisJSON); } catch { return null; }
  }, [analysisJSON]);

  // ── Fallback: no JSON, show streaming text ──
  if (!data) {
    return (
      <div className="rounded-card border border-hairline bg-canvas shadow-ab-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline-soft">
          <h3 className="text-[16px] font-semibold text-ink">Photo Analysis</h3>
          <button
            type="button"
            onClick={onCopy}
            className="grid size-8 place-items-center rounded-full bg-surface-strong text-ink hover:bg-hairline-soft transition-colors"
            aria-label={isCopied ? 'Copied' : 'Copy analysis'}
          >
            {isCopied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          </button>
        </div>
        <div className="p-5 whitespace-pre-wrap text-sm leading-relaxed text-ink-body">
          {visibleText}
        </div>
      </div>
    );
  }

  // ── Route: needs_real_photo ──
  if (data.route === 'needs_real_photo') {
    const headline = data.copy?.headline ?? "This doesn't look like a real photo of you.";
    const cta = data.copy?.cta ?? "Upload a real photo of you. That's the one worth working with.";
    return (
      <div className="rounded-card border border-hairline bg-canvas shadow-ab-card overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline-soft">
          <h3 className="text-[16px] font-semibold text-ink">A quick note</h3>
        </div>
        <div className="p-6 flex flex-col items-center text-center gap-3">
          <div className="grid size-12 place-items-center rounded-full bg-surface-soft">
            <ImageOff className="size-5 text-ink-muted" />
          </div>
          <p className="text-base text-ink leading-relaxed max-w-md">{headline}</p>
          <p className="text-sm text-ink-muted leading-relaxed max-w-md">{cta}</p>
        </div>
      </div>
    );
  }

  // ── Full analysis ──
  const { scores, percentile, diagnostics, match_prediction, copy, red_flags, fix_plan, authenticity } = data;

  const oneLinerIssue = copy?.one_liner_issue ?? data.main_issue ?? null;
  const oneLinerPositive = copy?.one_liner_positive ?? data.positive ?? null;
  const headline = copy?.headline ?? null;
  const firstImpression = copy?.first_impression ?? null;
  const cta = copy?.cta ?? null;

  const overallScore = scores ? Math.round(((scores.attractiveness ?? 0) + (scores.approachability ?? 0) + (scores.confidence ?? 0)) / 3 * 10) : 0;
  const isSuspicious = authenticity === 'suspiciously_edited';
  const isAlreadyGreat = data.route === 'already_great';

  return (
    <div className="rounded-card border border-hairline bg-canvas shadow-ab-card overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline-soft">
        <h3 className="text-[16px] font-semibold text-ink">Photo Analysis</h3>
        <button
          type="button"
          onClick={onCopy}
          className="grid size-8 place-items-center rounded-full bg-surface-strong text-ink hover:bg-hairline-soft transition-colors"
          aria-label={isCopied ? 'Copied' : 'Copy analysis'}
        >
          {isCopied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </button>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* Suspicious-edit hint */}
        {isSuspicious && (
          <div className="flex items-start gap-2 text-xs text-ink-body bg-surface-soft border border-hairline-soft rounded-card px-3 py-2.5">
            <AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>Heads up — this photo looks noticeably filtered. Analysis is based on what we can see.</span>
          </div>
        )}

        {/* Headline — display-sm */}
        {headline && (
          <p className="text-[20px] font-semibold text-ink leading-[1.2] tracking-[-0.18px]">
            {headline}
          </p>
        )}

        {/* Score Hero — rating-display style for overall, gauges below */}
        {scores && (
          <div className="flex items-center justify-between gap-6 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[64px] font-bold text-ink leading-[1.1] tracking-[-1px] tabular-nums">
                {overallScore}
              </span>
              <span className="text-[16px] text-ink-muted">/100</span>
            </div>
            {percentile != null && (
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.32px] text-ink-muted font-bold">Percentile</div>
                <div className="text-base font-semibold text-ink mt-0.5">Top {percentile}%</div>
              </div>
            )}
          </div>
        )}

        {scores && (
          <div className="flex items-start justify-around gap-3 pb-1">
            <CircularGauge score={scores.attractiveness ?? 0} label="Attractive" />
            <CircularGauge score={scores.approachability ?? 0} label="Approachable" />
            <CircularGauge score={scores.confidence ?? 0} label="Confident" />
          </div>
        )}

        {/* Match Rate Prediction */}
        {match_prediction && (match_prediction.current_rate || match_prediction.enhanced_rate) && (
          <div className="border-t border-hairline-soft pt-5">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="size-4 text-ink-muted" />
              <span className="text-sm font-semibold text-ink">Match rate prediction</span>
            </div>
            <div className="flex items-center gap-4">
              {match_prediction.current_rate && (
                <div className="flex-1">
                  <div className="text-[22px] font-semibold text-ink-muted tabular-nums leading-[1.18]">{match_prediction.current_rate}</div>
                  <div className="text-xs text-ink-muted mt-1">Current photo</div>
                </div>
              )}
              {match_prediction.current_rate && match_prediction.enhanced_rate && (
                <ChevronRight className="size-4 text-ink-soft shrink-0" />
              )}
              {match_prediction.enhanced_rate && (
                <div className="flex-1">
                  <div className="text-[22px] font-semibold text-rausch tabular-nums leading-[1.18]">{match_prediction.enhanced_rate}</div>
                  <div className="text-xs text-ink-muted mt-1">After enhancement</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Diagnostics — amenity-row list */}
        {diagnostics && (
          <div className="border-t border-hairline-soft pt-5">
            <h4 className="text-sm font-semibold text-ink mb-1">Photo diagnostics</h4>
            <div>
              {diagnosticConfig.map(({ key, label, icon }) => {
                const val = (diagnostics as any)[key];
                if (val == null) return null;
                return <DiagnosticRow key={key} icon={icon} label={label} score={val} />;
              })}
            </div>
          </div>
        )}

        {/* Insights stack */}
        {(oneLinerIssue || oneLinerPositive || firstImpression || (red_flags && red_flags.length > 0) || fix_plan?.visual_outcome) && (
          <div className="border-t border-hairline-soft pt-5">
            <h4 className="text-sm font-semibold text-ink mb-1">What we noticed</h4>
            <div>
              {oneLinerIssue && oneLinerIssue !== "none" && !isAlreadyGreat && (
                <InsightRow
                  icon={Crosshair}
                  heading="#1 thing holding you back"
                  body={oneLinerIssue}
                  accent="rausch"
                />
              )}
              {oneLinerPositive && (
                <InsightRow
                  icon={ThumbsUp}
                  heading="What's working"
                  body={oneLinerPositive}
                  accent="emerald"
                />
              )}
              {firstImpression && (
                <InsightRow
                  icon={Eye}
                  heading="First impression on a dating app"
                  body={firstImpression}
                />
              )}
              {red_flags && red_flags.length > 0 && (
                <InsightRow
                  icon={AlertTriangle}
                  heading="Red flags"
                  body={
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {red_flags.map((f, i) => (
                        <span key={i} className="text-xs text-ink-body bg-surface-soft border border-hairline-soft px-2.5 py-0.5 rounded-pill">
                          {f}
                        </span>
                      ))}
                    </div>
                  }
                  accent="amber"
                />
              )}
              {fix_plan?.visual_outcome && fix_plan.visual_outcome !== 'no edit needed' && (
                <InsightRow
                  icon={Sparkles}
                  heading="What enhancement will do"
                  body={fix_plan.visual_outcome}
                  accent="rausch"
                />
              )}
            </div>
          </div>
        )}

        {/* CTA — already_great ready-to-go banner */}
        {cta && isAlreadyGreat && (
          <div className="border-t border-hairline-soft pt-5">
            <div className="flex items-start gap-3 rounded-card bg-surface-soft px-4 py-3.5">
              <Sparkles className="size-5 text-rausch shrink-0 mt-0.5" />
              <p className="text-sm text-ink leading-relaxed">{cta}</p>
            </div>
          </div>
        )}

        {/* Full analysis (collapsible) */}
        {visibleText && (
          <details className="group border-t border-hairline-soft pt-4">
            <summary className="text-xs text-ink-muted cursor-pointer hover:text-ink-body transition-colors flex items-center gap-1.5 list-none [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-3.5 transition-transform duration-200 group-open:rotate-90" />
              <span>Full analysis</span>
            </summary>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-body bg-surface-soft rounded-card border border-hairline-soft p-3">
              {visibleText}
            </div>
          </details>
        )}

      </div>
    </div>
  );
}
