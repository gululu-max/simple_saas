import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════
// [DISABLED 2026-05-13 — no-login refactor]
// 一次性生意改造：取消邮箱预检接口。
// 未来恢复时：删除下方 stub，把更下方注释里的原实现
// 取消注释即可。
// ═══════════════════════════════════════════════════════════
export async function POST() {
  return NextResponse.json({ exists: false });
}

// import { supabaseAdmin } from "@/utils/supabase/admin";
//
// export async function POST(req: Request) {
//   const { email } = await req.json();
//   if (!email) return NextResponse.json({ exists: false });
//
//   const { data } = await supabaseAdmin.auth.admin.listUsers();
//   const exists = data?.users?.some((u) => u.email === email) ?? false;
//
//   return NextResponse.json({ exists });
// }
