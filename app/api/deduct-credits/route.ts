import { createClient } from "@/utils/supabase/server";
import { consumeCredits } from "@/lib/credits";

const COST_PER_DOWNLOAD = 20;

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (customerError || !customer) {
      return new Response(JSON.stringify({ error: "Failed to fetch credits" }), { status: 500 });
    }

    if (customer.credits < COST_PER_DOWNLOAD) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", code: "INSUFFICIENT_CREDITS" }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const deduction = await consumeCredits(user.id, "PhotoEnhance");
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