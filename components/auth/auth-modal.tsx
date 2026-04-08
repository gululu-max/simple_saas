"use client";

import { useAuthModal } from "./auth-modal-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// 懒加载表单组件
import SignInForm from "./sign-in-form";
import SignUpForm from "./sign-up-form";
import ForgotPasswordForm from "./forgot-password-form";

// 终极版监听器：同时抓取 ? 参数和 # 哈希参数
function AuthErrorListener() {
  const searchParams = useSearchParams();
  const { openAuthModal } = useAuthModal();

  useEffect(() => {
    // 1. 抓取我们自己后端抛出的 Query 参数 (?auth_error=xxx)
    const authError = searchParams.get("auth_error");
    
    // 2. 抓取 Supabase 原生抛出的 Hash 错误 (#error=xxx)
    // 加一个 typeof window 判断，防止 Next.js 服务端渲染报错
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hasHashError = 
      hash.includes("error_description=Email+link+is+invalid") || 
      hash.includes("error=unauthorized_client") ||
      hash.includes("error_description=Token+has+expired");

    // 只要命中任何一种失效情况，立刻弹登录框接客
    if (authError === "expired_link" || hasHashError) {
      openAuthModal("sign-in");
      
      // 清理 URL 上难看的错误码，保持页面整洁
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, [searchParams, openAuthModal]);

  return null;
}

export function AuthModal() {
  const { isOpen, view, closeAuthModal } = useAuthModal();

  const titles = {
    "sign-in": "Sign in",
    "sign-up": "Sign up",
    "forgot-password": "Reset password",
  };

  return (
    <>
      {/* Suspense 包裹的监听器 */}
      <Suspense fallback={null}>
        <AuthErrorListener />
      </Suspense>

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeAuthModal()}>
        <DialogContent className="w-[calc(100%-32px)] sm:max-w-md bg-white border border-gray-200 shadow-2xl p-8 rounded-2xl [&>button]:text-gray-500 [&>button]:hover:text-gray-900 [&>button]:hover:bg-gray-100">
          <VisuallyHidden>
            <DialogTitle>{titles[view]}</DialogTitle>
          </VisuallyHidden>
          {view === "sign-in" && <SignInForm />}
          {view === "sign-up" && <SignUpForm />}
          {view === "forgot-password" && <ForgotPasswordForm />}
        </DialogContent>
      </Dialog>
    </>
  );
}