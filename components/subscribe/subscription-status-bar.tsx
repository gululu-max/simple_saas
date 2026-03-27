"use client";

import { useState, useRef, useEffect } from "react";
import { CreditCard, Zap, CalendarClock, ChevronDown, Crown } from "lucide-react";
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
}

export function SubscriptionStatusBar({
  subscription,
  credits,
  recentHistory,
  hasActiveAccess,
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
        className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30
                   px-3.5 py-3 text-sm transition-colors hover:bg-muted/50 active:bg-muted/60"
      >
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-1 min-w-0">

          {hasActiveAccess ? (
            /* ── 会员：展示会员状态 ── */
            <>
              <div className="flex items-center gap-1.5 shrink-0">
                <Crown className="h-4 w-4 text-amber-400" />
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500 capitalize">
                  Pro
                </span>
              </div>

              {periodEnd && (
                <>
                  <span className="h-3.5 w-px bg-border/60 shrink-0" />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground text-xs hidden sm:inline">Renews</span>
                    <span className="font-medium">{periodEnd}</span>
                  </div>
                </>
              )}
            </>
          ) : (
            /* ── 普通登录用户：展示积分数 ── */
            <div className="flex items-center gap-1.5 shrink-0">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-muted-foreground hidden sm:inline">Credits</span>
              <span className="font-semibold tabular-nums">{credits}</span>
            </div>
          )}
        </div>

        {/* Toggle arrow */}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* ── Dropdown Panel：会员和普通用户都展示会员+积分卡片 ── */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-border/60 bg-background shadow-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-3">
          {subscription?.current_period_end && (
            <SubscriptionStatusCard
              subscription={{
                status: subscription.status,
                current_period_end: subscription.current_period_end,
              }}
            />
          )}
          <CreditsBalanceCard credits={credits} recentHistory={recentHistory} />
        </div>
      )}
    </div>
  );
}