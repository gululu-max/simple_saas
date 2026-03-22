"use client";

import { useAuthModal } from "./auth-modal-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import SignInForm from "./sign-in-form";
import SignUpForm from "./sign-up-form";
import ForgotPasswordForm from "./forgot-password-form";

export function AuthModal() {
  const { isOpen, view, closeAuthModal } = useAuthModal();

  const titles = {
    "sign-in": "Sign in",
    "sign-up": "Sign up",
    "forgot-password": "Reset password",
  };

  return (
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
  );
}