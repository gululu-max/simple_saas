import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SubscriptionStatusCard } from "@/components/dashboard/subscription-status-card";
import { CreditsBalanceCard } from "@/components/dashboard/credits-balance-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Check Auth User
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // 2. 获取用户基础信息 & 订阅状态
  const { data: customerData } = await supabase
    .from("customers")
    .select(`
      *,
      subscriptions (
        status,
        current_period_end,
        creem_product_id
      )
    `)
    .eq("user_id", user.id)
    .single();

  // 3. 🚨 核心修复：独立查询流水表，强制按时间倒序排，取最新的 5 条！
  const { data: historyData } = await supabase
    .from("credits_history")
    .select("amount, type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false }) // false 代表最新的排在最前面
    .limit(5); // 建议展示 5 条，比 2 条看起来更饱满

  const subscription = customerData?.subscriptions?.[0];
  const credits = customerData?.credits || 0;
  const recentCreditsHistory = historyData || []; // 直接使用查出来的新鲜数组

  return (
    <div className="flex-1 w-full flex flex-col gap-6 sm:gap-8 px-4 sm:px-8 container pb-10">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg p-6 sm:p-8 mt-6 sm:mt-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 break-words">
          Welcome back, {customerData?.name || user.email?.split("@")[0]}
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription, check your credits.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Credits Card */}
        <CreditsBalanceCard credits={credits} recentHistory={recentCreditsHistory} />
        
        {/* Subscription Status */}
        <SubscriptionStatusCard subscription={subscription} />
      </div>
    </div>
  );
}