import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendLeadEvent } from "@/lib/meta-capi";

export async function POST(request: Request) {
  try {
    // 1. 验证用户登录状态，同时拿到 email
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await request.json();

    // 2. 触发 Lead + Generate_boost 双事件
    await sendLeadEvent(user.email, {
      contentName: "AI Photo boost Report",
      eventId: eventId ?? `lead_${Date.now()}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[meta-event] Error:", error);
    return NextResponse.json({ error: "Failed to send event" }, { status: 500 });
  }
}