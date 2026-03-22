import { supabaseAdmin } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ exists: false });

  const { data } = await supabaseAdmin.auth.admin.listUsers();
  const exists = data?.users?.some((u) => u.email === email) ?? false;

  return NextResponse.json({ exists });
}