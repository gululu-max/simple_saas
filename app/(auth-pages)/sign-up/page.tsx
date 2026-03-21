"use client";

import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { use, useEffect } from "react";

export default function SignUp(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = use(props.searchParams);
  const isSuccess = "success" in searchParams && !!searchParams.success;

  // 1. 自动埋点：当用户看到"注册成功/验证邮件"页面时触发
  useEffect(() => {
    if (isSuccess) {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'sign_up_complete', { method: 'email' });
      }
    }
  }, [isSuccess]);

  // Google 注册逻辑
  const signUpWithGoogle = async () => {
    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error(error.message);
      return;
    }

    if (data.url) {
      window.location.href = data.url;
    }
  };

  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Create your account
        </h1>
        <p className="text-sm text-slate-400">
          Stop guessing. Start boosting. Spot the flaws others overlook.
        </p>
      </div>

      <div className="grid gap-6 mt-6">
        {isSuccess ? (
          /* 注册成功状态 UI */
          <div className="flex flex-col items-center justify-center gap-4 py-10 px-4 border border-slate-800 rounded-xl bg-slate-900/50">
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-green-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium text-slate-50">Verify your email</h3>
              <p className="max-w-[280px] text-sm text-slate-400 leading-relaxed">
                We&apos;ve sent a verification link to your email. Please check your inbox to activate your account.
              </p>
            </div>
            <Button asChild className="mt-4 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors px-8">
              <Link href="/sign-in">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          /* 注册表单状态 UI */
          <>
            <form className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  name="email"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  required
                  className="bg-slate-950 border-slate-800 text-slate-200 focus:ring-red-600"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="bg-slate-950 border-slate-800 text-slate-200 focus:ring-red-600"
                />
              </div>
              <SubmitButton
                className="w-full bg-red-600 hover:bg-red-700 text-white border-0 mt-2 transition-colors"
                pendingText="Creating account..."
                formAction={signUpAction}
                onClick={() => {
                  if (typeof window !== 'undefined' && window.gtag) {
                    window.gtag('event', 'sign_up_attempt', { method: 'email' });
                  }
                }}
              >
                Create account
              </SubmitButton>
              <FormMessage message={searchParams} />
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-950 px-2 text-slate-500">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'sign_up_attempt', { method: 'google' });
                }
                signUpWithGoogle();
              }}
              className="w-full flex items-center justify-center gap-2 border-slate-800 bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100 transition-all"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign up with Google
            </Button>

            <div className="text-sm text-slate-500 text-center">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="text-slate-400 underline underline-offset-4 hover:text-slate-100"
              >
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}