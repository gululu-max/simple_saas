"use client";

import { useAuthModal } from "./auth-modal-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// 懒加载表单组件
const SignInForm = dynamic(() => import("./sign-in-form"), { ssr: false });
const SignUpForm = dynamic(() => import("./sign-up-form"), { ssr: false });
const ForgotPasswordForm = dynamic(() => import("./forgot-password-form"), { ssr: false });

// 新增：专门监听 URL 错误的子组件
function AuthErrorListener() {
  const searchParams = useSearchParams();
  const { openAuthModal } = useAuthModal();

  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError === "expired_link") {
      openAuthModal("sign-in");
      // 清理 URL，保持页面整洁
      window.history.replaceState(null, "", window.location.pathname);
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
      {/* 新增：Suspense 包裹的监听器 */}
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