"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { SUBSCRIPTION_TIERS, CREDITS_TIERS } from "@/config/subscriptions";
import { ProductTier } from "@/types/subscriptions";
import { useT } from "@/lib/i18n/provider";

const parsePrice = (priceStr: string | number) => {
  if (typeof priceStr === 'number') return priceStr;
  const parsed = parseFloat(String(priceStr).replace(/[^0-9.]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
};

interface PricingSectionProps {
  className?: string;
  hideHeader?: boolean;
  defaultTab?: 'subscription' | 'credits';
  onAfterPurchase?: () => void;
}

export function PricingSection({ className, hideHeader = false, defaultTab = 'subscription', onAfterPurchase }: PricingSectionProps) {
  const t = useT().pricing;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const returnPath = searchParams.get('returnPath');

  useEffect(() => {
    const allItems = [
      ...SUBSCRIPTION_TIERS.map((t) => ({
        item_id: t.id,
        item_name: t.name,
        item_category: "subscription",
        price: parsePrice(t.priceMonthly),
      })),
      ...CREDITS_TIERS.map((t) => ({
        item_id: t.id,
        item_name: t.name,
        item_category: "credits",
        price: parsePrice(t.priceMonthly),
      })),
    ];

    trackEvent("view_item_list", {
      ecommerce: {
        item_list_id: "pricing_section",
        item_list_name: "Matchfix Pricing Plans",
        items: allItems,
      },
    });
  }, []);

  const handlePurchase = async (tier: ProductTier) => {
    if (!user) {
      openAuthModal("sign-in");
      return;
    }

    const itemCategory = tier.creditAmount ? 'credits' : 'subscription';
    trackEvent("begin_checkout", {
      currency: "USD",
      value: parsePrice(tier.priceMonthly),
      ecommerce: {
        items: [
          {
            item_id: tier.id,
            item_name: tier.name,
            item_category: itemCategory,
            price: parsePrice(tier.priceMonthly),
            quantity: 1,
          }
        ]
      }
    });

    setIsProcessing(tier.id);

    try {
      const response = await fetch('/api/creem/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: tier.productId,
          productType: itemCategory,
          userId: user.id,
          credits: tier.creditAmount,
          returnPath: returnPath || '/subscribe',
        }),
      });

      if (!response.ok) throw new Error('Failed to create checkout session');

      const { checkoutUrl } = await response.json();

      if (checkoutUrl) {
        onAfterPurchase?.();
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: t.paymentFailedTitle,
        description: t.paymentFailedDesc,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <section id="pricing" className={`w-full py-4 sm:py-8 bg-canvas ${className ?? ''}`}>
      <div className="container px-4 md:px-6">
        {!hideHeader && (
          <div className="text-center space-y-3 mb-8 sm:mb-12">
            <h2 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.4px] text-ink leading-[1.18]">
              {t.sectionTitle}
            </h2>
            <p className="mx-auto max-w-2xl text-ink-body text-base leading-[1.5]">
              {t.sectionSubtitle}
            </p>
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="w-full flex flex-col items-center">
          <TabsList className="mb-5 sm:mb-8 bg-surface-soft border border-hairline-soft p-1 rounded-pill h-auto">
            <TabsTrigger
              value="subscription"
              className="data-[state=active]:bg-canvas data-[state=active]:text-ink data-[state=active]:shadow-ab-card text-ink-muted text-sm rounded-pill px-4 py-1.5"
            >
              {t.tabSubscriptions}
            </TabsTrigger>
            <TabsTrigger
              value="credits"
              className="data-[state=active]:bg-canvas data-[state=active]:text-ink data-[state=active]:shadow-ab-card text-ink-muted text-sm rounded-pill px-4 py-1.5"
            >
              {t.tabCredits}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscription" className="w-full">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
              {SUBSCRIPTION_TIERS.map((tier, index) => (
                <PricingCard
                  key={tier.id}
                  tier={tier}
                  index={index}
                  isProcessing={isProcessing}
                  onPurchase={handlePurchase}
                  type="subscription"
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="credits" className="w-full">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
              {CREDITS_TIERS.map((tier, index) => (
                <PricingCard
                  key={tier.id}
                  tier={tier}
                  index={index}
                  isProcessing={isProcessing}
                  onPurchase={handlePurchase}
                  type="credits"
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

function PricingCard({
  tier,
  index,
  isProcessing,
  onPurchase,
  type,
}: {
  tier: ProductTier;
  index: number;
  isProcessing: string | null;
  onPurchase: (tier: ProductTier) => void;
  type: 'subscription' | 'credits';
}) {
  const t = useT().pricing;
  const buttonText = type === 'subscription' ? t.btnSubscribe : t.btnPurchase;

  return (
    <div className="relative h-full pt-4">
      {tier.featured && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-20">
          {/* Featured badge — Airbnb 标准 pill：单色 Rausch，无渐变无 glow */}
          <span className="inline-flex items-center bg-rausch text-white text-[11px] font-semibold px-3 py-1 rounded-pill leading-[1.18]">
            {type === 'subscription' ? t.badgeMostPopular : t.badgeBestValue}
          </span>
        </div>
      )}

      <Card className={`h-full flex flex-col relative overflow-hidden transition-shadow ${
        tier.featured
          ? 'bg-canvas border-rausch shadow-ab-card sm:scale-105 z-10'
          : 'bg-canvas border-hairline hover:shadow-ab-card'
      } rounded-card`}>

        <CardHeader className="pt-6 sm:pt-8 pb-3 sm:pb-4">
          <CardTitle className="text-[20px] sm:text-[22px] font-semibold text-ink leading-[1.25] tracking-[-0.18px]">
            {tier.name}
          </CardTitle>
          <CardDescription className="text-ink-muted text-sm leading-[1.43]">
            {tier.description}
          </CardDescription>
          <div className="mt-3 sm:mt-4 flex items-baseline">
            <span className="text-3xl sm:text-[32px] font-bold text-ink tracking-[-0.5px]">
              {tier.priceMonthly}
            </span>
            <span className="text-ink-muted ml-1 font-normal text-sm">
              {type === 'subscription' ? t.perMonth : t.oneTime}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-3 sm:pb-4">
          <ul className="space-y-2.5 sm:space-y-3">
            {tier.features?.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                {/* Check — ink 单色（Airbnb 单 voltage 原则，不用 emerald） */}
                <Check className="h-4 w-4 text-ink shrink-0 mt-0.5" strokeWidth={2.5} />
                <span className="text-sm text-ink-body leading-[1.43]">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="pb-5 sm:pb-6">
          {tier.featured ? (
            <Button
              className="w-full h-12 text-base font-medium bg-rausch hover:bg-rausch-active text-white border-0 rounded-btn transition-colors"
              onClick={() => onPurchase(tier)}
              disabled={isProcessing === tier.id}
            >
              {isProcessing === tier.id ? t.btnProcessing : buttonText}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full h-12 text-base font-medium bg-canvas text-ink border border-ink hover:bg-surface-soft hover:text-ink rounded-btn transition-colors"
              onClick={() => onPurchase(tier)}
              disabled={isProcessing === tier.id}
            >
              {isProcessing === tier.id ? t.btnProcessing : buttonText}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
