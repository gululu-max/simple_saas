"use client";

import { useState, useRef, useEffect } from "react";
import { Zap, CalendarClock, ChevronDown, Crown } from "lucide-react";
import { CreditsBalanceCard } from "@/components/subscribe/credits-balance-card";
import { SubscriptionStatusCard } from "@/components/subscribe/subscription-status-card";
import { CreditTransaction } from "@/types/creem";

interface SubscriptionStatusBarProps {
  subscription: {
    status: string;
    current_period_end?: string;
    creem_product_id?: string;
  } | null;
  credits: number;
  recentHistory: CreditTransaction[];
  hasActiveAccess: boolean;
  creemCustomerId?: string | null;
}

export function SubscriptionStatusBar({
  subscription,
  credits,
  recentHistory,
  hasActiveAccess,
  creemCustomerId,
}: SubscriptionStatusBarProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* ── Compact Status Bar ── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-3 rounded-card border border-hairline bg-canvas
                   px-3.5 py-3 text-sm transition-colors hover:bg-surface-soft active:bg-surface-strong"
      >
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-1 min-w-0">

          {hasActiveAccess ? (
            <>
              <div className="flex items-center gap-1.5 shrink-0">
                <Crown className="h-4 w-4 text-rausch" />
                <span className="inline-flex items-center rounded-pill bg-rausch/10 px-2 py-0.5 text-[11px] font-semibold text-rausch capitalize">
                  Pro
                </span>
              </div>

              {periodEnd && (
                <>
                  <span className="h-3.5 w-px bg-hairline shrink-0" />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <CalendarClock className="h-4 w-4 text-ink-muted" />
                    <span className="text-ink-muted text-[13px] hidden sm:inline">Renews</span>
                    <span className="font-medium text-ink">{periodEnd}</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <Zap className="h-4 w-4 text-rausch" />
              <span className="text-ink-muted hidden sm:inline">Credits</span>
              <span className="font-semibold text-ink tabular-nums">{credits}</span>
            </div>
          )}
        </div>

        {/* Toggle arrow */}
        <ChevronDown
          className={`h-4 w-4 text-ink-muted shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-card border border-hairline bg-canvas shadow-ab-card p-3 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-3">
          {subscription?.current_period_end && (
            <SubscriptionStatusCard
              subscription={{
                status: subscription.status,
                current_period_end: subscription.current_period_end,
              }}
              creemCustomerId={creemCustomerId}
            />
          )}
          <CreditsBalanceCard credits={credits} recentHistory={recentHistory} />
        </div>
      )}
    </div>
  );
}
