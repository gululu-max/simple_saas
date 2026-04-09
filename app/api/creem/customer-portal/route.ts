import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceRoleClient();

    const { data: customer, error: customerError } = await serviceClient
      .from("customers")
      .select("creem_customer_id")
      .eq("user_id", user.id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    if (!customer.creem_customer_id || !customer.creem_customer_id.startsWith('cust_')) {
      return NextResponse.json({ error: "Not a paid customer yet" }, { status: 404 });
    }

    const response = await fetch(
      `${process.env.CREEM_API_URL}/customers/billing`,
      {
        method: "POST",
        headers: {
          "x-api-key": process.env.CREEM_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.creem_customer_id,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get customer portal link");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error getting customer portal link:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}