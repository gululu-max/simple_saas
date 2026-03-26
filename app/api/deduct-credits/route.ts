import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { consumeCredits } from "@/lib/credits";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // 查会员状态
    const { data: customer } = await supabase
      .from("customers")
      .select("id, credits")
      .eq("user_id", user.id)
      .single();

    if (!customer) {
      return new Response(JSON.stringify({ error: "Failed to fetch credits" }), { status: 500 });
    }

    const { data: subData } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("customer_id", customer.id)
      .eq("status", "active")
      .maybeSingle();

    const isSubscribed = !!subData;
    const actionType = isSubscribed ? 'PhotoEnhance_Member' : 'PhotoEnhance_NonMember';
    const costNeeded = isSubscribed ? 20 : 25;

    if (customer.credits < costNeeded) {
      return new Response(
        JSON.stringify({
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS",
          needed: costNeeded,
          current: customer.credits,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const deduction = await consumeCredits(user.id, actionType);
    if (!deduction.success) {
      return new Response(JSON.stringify({ error: "Failed to deduct credits" }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ success: true, remaining: deduction.remaining }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}