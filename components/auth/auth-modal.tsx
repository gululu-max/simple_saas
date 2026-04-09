"use client";

import { useAuthModal } from "./auth-modal-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// ✅ 改回普通 import — modal 本身就是条件渲染，Next.js 已经会 code-split
// dynamic 反而在用户点击后多一次 chunk 加载 + "Loading form..." 占位延迟
import SignInForm from "./sign-in-form";
import SignUpForm from "./sign-up-form";
import ForgotPasswordForm from "./forgot-password-form";

function AuthErrorListener() {
  const searchParams = useSearchParams();
  const { openAuthModal } = useAuthModal();

  useEffect(() => {
    const authError = searchParams.get("auth_error");
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hasHashError =
      hash.includes("error_description=Email+link+is+invalid") ||
      hash.includes("error=unauthorized_client") ||
      hash.includes("error_description=Token+has+expired");

    if (authError === "expired_link" || hasHashError) {
      openAuthModal("sign-in");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, [searchParams, openAuthModal]);

  return null;
}

export function AuthModal() {
  const { isOpen, view, closeAuthModal } = useAuthModal();

  const titles: Record<string, string> = {
    "sign-in": "Sign in",
    "sign-up": "Sign up",
    "forgot-password": "Reset password",
  };

  return (
    <>
      <Suspense fallback={null}>
        <AuthErrorListener />
      </Suspense>

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeAuthModal()}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}  // ← 加这一行
          className="w-[calc(100%-32px)] sm:max-w-md bg-white border border-gray-200 shadow-2xl p-8 rounded-2xl [&>button]:text-gray-500 [&>button]:hover:text-gray-900 [&>button]:hover:bg-gray-100 [&>button]:outline-none"
        >
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