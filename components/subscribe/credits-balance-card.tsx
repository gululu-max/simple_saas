"use client";

import { Coins } from "lucide-react";
import { CreditTransaction } from "@/types/creem";
import { useT } from "@/lib/i18n/provider";

type CreditsBalanceCardProps = {
  credits: number;
  recentHistory: CreditTransaction[];
};

export function CreditsBalanceCard({
  credits,
  recentHistory,
}: CreditsBalanceCardProps) {
  const t = useT().subscribeStatus;
  return (
    <div className="rounded-card border border-hairline bg-canvas p-6">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-rausch/10 rounded-md">
          <Coins className="h-6 w-6 text-rausch" />
        </div>
        <div>
          <p className="text-sm text-ink-muted leading-[1.43]">{t.availableCredits}</p>
          <h3 className="text-[22px] font-bold text-ink mt-1 tracking-[-0.4px] tabular-nums leading-[1.18]">
            {credits}
          </h3>
        </div>
      </div>
      {recentHistory.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[13px] text-ink-muted leading-[1.23]">{t.recentActivity}</p>
          <div className="space-y-1">
            {recentHistory.map((history, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm leading-[1.43]"
              >
                <span
                  className={
                    history.type === "add" ? "text-rausch font-medium" : "text-ink-body font-medium"
                  }
                >
                  {history.type === "add" ? "+" : "-"}
                  {history.amount}
                </span>
                <span className="text-ink-muted text-[13px]" suppressHydrationWarning>
                  {new Date(history.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
