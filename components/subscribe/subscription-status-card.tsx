"use client";

import {
  CreditCard,
  Package2,
  AlertCircle,
  Clock,
  Ban,
  PauseCircle,
  LucideIcon,
} from "lucide-react";
import { SubscriptionPortalDialog } from "./subscription-portal-dialog";
import { SubscriptionState } from "@/types/subscriptions";
import { useT } from "@/lib/i18n/provider";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type StatusConfig = {
  color: string;
  icon: LucideIcon;
  message: string;
  iconColor: string;
};

type StatusConfigs = {
  [key in SubscriptionState]: StatusConfig;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US");
}

function isFutureDate(date: string) {
  return new Date(date) > new Date();
}

function getStatusConfig(
  status: string,
  current_period_end: string,
  t: Dictionary["subscribeStatus"],
): StatusConfig {
  const inGracePeriod = isFutureDate(current_period_end);
  const date = formatDate(current_period_end);

  // 状态色：保留功能性语义（active=ink、warning=amber、error=destructive）
  // 不并入 Airbnb single-voltage，因为这是状态指示器而非品牌信号
  const configs: StatusConfigs = {
    active: {
      color: "text-ink",
      icon: Package2,
      message: `${t.statusRenewsOn} ${date}`,
      iconColor: "text-ink",
    },
    trialing: {
      color: "text-rausch",
      icon: Clock,
      message: `${t.statusTrialEndsOn} ${date}`,
      iconColor: "text-rausch",
    },
    canceled: {
      color: inGracePeriod ? "text-amber-600" : "text-destructive",
      icon: Ban,
      message: inGracePeriod
        ? `${t.statusAccessUntil} ${date}`
        : `${t.statusEndedOn} ${date}`,
      iconColor: inGracePeriod ? "text-amber-600" : "text-destructive",
    },
    past_due: {
      color: "text-amber-600",
      icon: AlertCircle,
      message: `${t.statusPaymentDueUntil} ${date}`,
      iconColor: "text-amber-600",
    },
    unpaid: {
      color: "text-destructive",
      icon: AlertCircle,
      message: t.statusPaymentRequired,
      iconColor: "text-destructive",
    },
    paused: {
      color: "text-amber-600",
      icon: PauseCircle,
      message: `${t.statusPausedUntil} ${date}`,
      iconColor: "text-amber-600",
    },
    incomplete: {
      color: "text-amber-600",
      icon: AlertCircle,
      message: t.statusSetupIncomplete,
      iconColor: "text-amber-600",
    },
    expired: {
      color: "text-destructive",
      icon: Ban,
      message: `${t.statusExpiredOn} ${date}`,
      iconColor: "text-destructive",
    },
  };

  return (
    configs[status as SubscriptionState] || {
      color: "text-ink-muted",
      icon: AlertCircle,
      message: t.statusNoActive,
      iconColor: "text-ink-muted",
    }
  );
}

type SubscriptionStatusCardProps = {
  subscription?: {
    status: string;
    current_period_end: string;
  } | null;
  creemCustomerId?: string | null;
};

export function SubscriptionStatusCard({
  subscription,
  creemCustomerId,
}: SubscriptionStatusCardProps) {
  const t = useT().subscribeStatus;
  return (
    <div className="rounded-card border border-hairline bg-canvas p-6">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-rausch/10 rounded-md">
          <CreditCard className="h-6 w-6 text-rausch" />
        </div>
        <div>
          <p className="text-sm text-ink-muted leading-[1.43]">{t.subscriptionStatus}</p>
          {subscription && (
            <h3
              className={`text-[22px] font-bold capitalize mt-1 tracking-[-0.4px] leading-[1.18] ${
                getStatusConfig(
                  subscription.status,
                  subscription.current_period_end,
                  t,
                ).color
              }`}
            >
              {subscription.status}
            </h3>
          )}
          {!subscription && (
            <h3 className="text-[22px] font-bold mt-1 text-ink-muted tracking-[-0.4px] leading-[1.18]">
              {t.noActivePlan}
            </h3>
          )}
        </div>
      </div>
      {subscription && (
        <div className="mt-4 flex items-center text-sm gap-2 leading-[1.43]">
          {(() => {
            const config = getStatusConfig(
              subscription.status,
              subscription.current_period_end,
              t,
            );
            const Icon = config.icon;
            return (
              <>
                <Icon className={`h-4 w-4 ${config.iconColor}`} />
                <span className="text-ink-muted" suppressHydrationWarning>
                  {config.message}
                </span>
              </>
            );
          })()}
        </div>
      )}
      <div className="mt-4">
        <SubscriptionPortalDialog creemCustomerId={creemCustomerId} />
      </div>
    </div>
  );
}
