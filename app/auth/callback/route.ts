import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  // ✅ 安全校验：防止 open redirect 攻击
  const rawRedirect = requestUrl.searchParams.get("redirect_to") || "/";
  const redirectTo =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth Callback Error:", error.message);
      // 核心拦截：如果验证码过期/被邮箱爬虫消耗，带着错误参数跳回首页
      return NextResponse.redirect(`${origin}/?auth_error=expired_link`);
    }
  } else {
    // 根本没有收到 code 的情况
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  // 验证成功，Cookie 已写入，重定向
  return NextResponse.redirect(`${origin}${redirectTo}`);
}