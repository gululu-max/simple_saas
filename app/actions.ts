"use server";

import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════
// [DISABLED 2026-05-13 — no-login refactor]
// 一次性生意改造：三个 server action 全部 stub 化。
// signOutAction 还被 Header / MobileNav 的 <form action={...}>
// 引用，所以保留同名导出，签名一致，但 body 改成 no-op。
// 未来恢复时：删除下方三个 stub，把再下方注释里的原函数体
// 取消注释即可。
// ═══════════════════════════════════════════════════════════

export const signUpAction = async (_formData: FormData) => {
  // no-op — sign up disabled
};

export const resetPasswordAction = async (_formData: FormData) => {
  // no-op — password reset disabled
};

export const signOutAction = async () => {
  return redirect("/");
};

// ───────── 原实现保留如下 ─────────
//
// import { encodedRedirect } from "@/utils/utils";
// import { createClient } from "@/utils/supabase/server";
// import { headers } from "next/headers";
// import { sendCompleteRegistrationEvent } from "@/lib/meta-capi";
//
// /**
//  * 注册逻辑
//  */
// export const signUpAction = async (formData: FormData) => {
//   const email = formData.get("email")?.toString();
//   const password = formData.get("password")?.toString();
//   const supabase = await createClient();
//   const origin = (await headers()).get("origin");
//
//   if (!email || !password) {
//     return encodedRedirect(
//       "error",
//       "/sign-up",
//       "Email and password are required"
//     );
//   }
//
//   const { error } = await supabase.auth.signUp({
//     email,
//     password,
//     options: {
//       emailRedirectTo: `${origin}/auth/callback`,
//     },
//   });
//
//   if (error) {
//     console.error(error.code + " " + error.message);
//     return encodedRedirect("error", "/sign-up", error.message);
//   } else {
//     await sendCompleteRegistrationEvent(email, {
//       eventId: `reg_${Date.now()}`,
//     });
//
//     return encodedRedirect(
//       "success",
//       "/sign-up",
//       "Account created! Please check your email to verify your account."
//     );
//   }
// };
//
// /**
//  * 重置密码（更新新密码）
//  */
// export const resetPasswordAction = async (formData: FormData) => {
//   const supabase = await createClient();
//
//   const password = formData.get("password") as string;
//   const confirmPassword = formData.get("confirmPassword") as string;
//
//   if (!password || !confirmPassword) {
//     return encodedRedirect(
//       "error",
//       "/reset-password",
//       "Password and confirm password are required"
//     );
//   }
//
//   if (password !== confirmPassword) {
//     return encodedRedirect(
//       "error",
//       "/reset-password",
//       "Passwords do not match"
//     );
//   }
//
//   const { error } = await supabase.auth.updateUser({
//     password: password,
//   });
//
//   if (error) {
//     return encodedRedirect(
//       "error",
//       "/reset-password",
//       "Password update failed"
//     );
//   }
//
//   return encodedRedirect("success", "/reset-password", "Password updated");
// };
//
// /**
//  * 退出登录
//  */
// export const signOutAction = async () => {
//   const supabase = await createClient();
//   await supabase.auth.signOut();
//   return redirect("/");
// };
