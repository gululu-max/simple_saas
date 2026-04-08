"use client";

import { useAuthModal } from "./auth-modal-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

// --- 核心修复：改回 dynamic 引入，并添加 loading 占位 ---
const SignInForm = dynamic(() => import("./sign-in-form"), { 
  ssr: false, 
  loading: () => <div className="flex items-center justify-center min-h-[400px] text-sm text-gray-400">Loading form...</div>
});
const SignUpForm = dynamic(() => import("./sign-up-form"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-[400px] text-sm text-gray-400">Loading form...</div>
});
const ForgotPasswordForm = dynamic(() => import("./forgot-password-form"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-[300px] text-sm text-gray-400">Loading form...</div>
});

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

  const titles = {
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