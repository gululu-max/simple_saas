import { createClient } from "@/utils/supabase/server";
import { PricingSection } from "@/components/pricing-section";
import { SubscriptionStatusBar } from "@/components/subscribe/subscription-status-bar";
import { CreditTransaction } from "@/types/creem";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SubscribePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 访客直接渲染，不跳转
  if (!user) {
    return (
      <div className="flex-1 w-full flex flex-col pb-16 sm:pb-20">
        <div className="w-full mt-2 sm:mt-4">
          <PricingSection hideHeader className="!py-0 sm:!py-2" />
        </div>
      </div>
    );
  }

  const { data: customerData, error } = await supabase
    .from("customers")
    .select(`
      *,
      subscriptions (
        status,
        current_period_end,
        creem_product_id
      ),
      credits_history (
        id,
        customer_id,
        amount,
        type,
        description,
        creem_order_id,
        created_at,
        metadata
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", {
      foreignTable: "credits_history",
      ascending: false,
    })
    .single();

  if (error) {
    console.error("Supabase Query Error:", error.message);
  }

  const subscription = customerData?.subscriptions?.[0] ?? null;
  const credits = customerData?.credits || 0;
  const recentCreditsHistory = (customerData?.credits_history?.slice(0, 2) || []) as CreditTransaction[];

  const hasActiveAccess = (() => {
    if (!subscription) return false;
    const { status, current_period_end } = subscription;
    if (status === "active" || status === "trialing") return true;
    if (status === "canceled" && current_period_end && new Date(current_period_end) > new Date()) return true;
    return false;
  })();

  return (
    <div className="flex-1 w-full flex flex-col pb-16 sm:pb-20">
      {/* ── Status Bar (登录用户才显示) ── */}
      <div className="px-4 sm:px-8 max-w-4xl mx-auto w-full mt-4 sm:mt-5">
        <SubscriptionStatusBar
          subscription={subscription}
          credits={credits}
          recentHistory={recentCreditsHistory}
          hasActiveAccess={hasActiveAccess}
        />
      </div>

      {/* ── Pricing Section ── */}
      <div className="w-full mt-2 sm:mt-4">
        <PricingSection hideHeader className="!py-0 sm:!py-2" />
      </div>
    </div>
  );
}