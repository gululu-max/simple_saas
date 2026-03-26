"use client";

import { Coins } from "lucide-react";
import { CreditTransaction } from "@/types/creem";

type CreditsBalanceCardProps = {
  credits: number;
  recentHistory: CreditTransaction[];
};

export function CreditsBalanceCard({
  credits,
  recentHistory,
}: CreditsBalanceCardProps) {
  return (
    // 在这里去掉了 border 类，现在它只保留了圆角和背景色
    <div className="rounded-xl bg-card p-6">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Coins className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Available Credits</p>
          <h3 className="text-2xl font-bold mt-1">{credits}</h3>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm text-muted-foreground">Recent Activity</p>
        <div className="space-y-1">
          {recentHistory.map((history, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <span
                className={
                  history.type === "add" ? "text-primary" : "text-destructive"
                }
              >
                {history.type === "add" ? "+" : "-"}
                {history.amount}
              </span>
              {/* 核心修复：在这里加上 suppressHydrationWarning 属性 */}
              <span className="text-muted-foreground" suppressHydrationWarning>
                {new Date(history.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}