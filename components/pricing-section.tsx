"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { SUBSCRIPTION_TIERS, CREDITS_TIERS } from "@/config/subscriptions";
import { ProductTier } from "@/types/subscriptions";

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
        title: "Payment Failed",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <section id="pricing" className={`w-full py-4 sm:py-8 bg-transparent ${className ?? ''}`}>
      <div className="container px-4 md:px-6">
        {!hideHeader && (
          <div className="text-center space-y-4 mb-8 sm:mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mx-auto max-w-2xl text-slate-400 text-lg">
              Choose the perfect plan for your needs.
            </p>
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="w-full flex flex-col items-center">
          <TabsList className="mb-5 sm:mb-8 bg-slate-900/80 border border-slate-800 p-1">
            <TabsTrigger
              value="subscription"
              className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 text-sm"
            >
              Subscriptions
            </TabsTrigger>
            <TabsTrigger
              value="credits"
              className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 text-sm"
            >
              Credit Packs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscription" className="w-full">
            <div className="grid gap-4 sm:gap-8 lg:grid-cols-3 max-w-6xl mx-auto">
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
            <div className="grid gap-4 sm:gap-8 lg:grid-cols-3 max-w-6xl mx-auto">
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
  const buttonText = type === 'subscription' ? "Subscribe" : "Purchase";

  return (
    <div className="relative h-full pt-4">
      {tier.featured && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-20">
          <Badge className="bg-gradient-to-r from-rose-500 to-pink-600 text-white border-0 px-4 py-1 shadow-[0_0_15px_rgba(225,29,72,0.4)] font-bold tracking-wide">
            {type === 'subscription' ? 'Most Popular' : 'Best Value'}
          </Badge>
        </div>
      )}

      <Card className={`h-full flex flex-col relative overflow-hidden transition-all duration-300 ${
        tier.featured
          ? 'bg-slate-900 border-rose-500/50 shadow-[0_0_30px_rgba(225,29,72,0.15)] sm:scale-105 z-10'
          : 'bg-slate-900/50 border-slate-800 text-slate-50 hover:border-slate-700'
      }`}>
        {tier.featured && (
          <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 blur-3xl -z-10 pointer-events-none" />
        )}

        <CardHeader className="pt-6 sm:pt-8 pb-3 sm:pb-4">
          <CardTitle className={`text-xl sm:text-2xl ${tier.featured ? 'text-white' : 'text-slate-100'}`}>
            {tier.name}
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            {tier.description}
          </CardDescription>
          <div className="mt-3 sm:mt-4 flex items-baseline">
            <span className={`text-3xl sm:text-4xl font-extrabold ${tier.featured ? 'text-white' : 'text-slate-100'}`}>
              {tier.priceMonthly}
            </span>
            <span className="text-slate-500 ml-1 font-medium text-sm">
              {type === 'subscription' ? '/month' : ' one-time'}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-3 sm:pb-4">
          <ul className="space-y-2.5 sm:space-y-3">
            {tier.features?.map((feature, i) => (
              <li key={i} className="flex items-center gap-2.5 sm:gap-3">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 font-bold" />
                <span className="text-sm text-slate-300">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="pb-5 sm:pb-6">
          {tier.featured ? (
            <Button
              className="w-full h-11 sm:h-12 text-sm sm:text-md font-bold bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white border-0 shadow-lg transition-transform hover:scale-105"
              onClick={() => onPurchase(tier)}
              disabled={isProcessing === tier.id}
            >
              {isProcessing === tier.id ? "Processing..." : buttonText}
            </Button>
          ) : (
            <Button
              className="w-full h-11 sm:h-12 text-sm sm:text-md font-semibold bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all"
              onClick={() => onPurchase(tier)}
              disabled={isProcessing === tier.id}
            >
              {isProcessing === tier.id ? "Processing..." : buttonText}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}