"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useAuthModal } from "./auth-modal-context";
import { useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

// Supabase 原始错误 → 友好提示
function getFriendlyError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (message.includes("Email not confirmed")) {
    return "Please verify your email before signing in. Check your inbox.";
  }
  if (message.includes("Too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (message.includes("User not found")) {
    return "No account found with this email. Please sign up first.";
  }
  return message;
}

export default function SignInForm() {
  const { setView, closeAuthModal } = useAuthModal();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // ✅ 用 ref 直接读取 DOM 值，解决浏览器自动填充不触发 onChange 的问题
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const pathname = usePathname();

  const handleSignIn = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // ✅ 核心修复：优先从 DOM 读取值（兜底浏览器自动填充场景）
    const actualEmail = emailRef.current?.value || email;
    const actualPassword = passwordRef.current?.value || password;

    // 同步回 state（让 UI 和 state 一致）
    setEmail(actualEmail);
    setPassword(actualPassword);

    if (!actualEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actualEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!actualPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: actualEmail,
      password: actualPassword,
    });

    if (error) {
      setError(getFriendlyError(error.message));
      setLoading(false);
      return;
    }

    closeAuthModal();
    window.dispatchEvent(new Event("auth-changed"));  // ← 加这行
    router.refresh();
  };

  const signInWithGoogle = async () => {
    setIsGoogleLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=${pathname}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      console.error(error.message);
      setIsGoogleLoading(false);
      return;
    }
    if (data.url) window.location.href = data.url;
  };

  return (
    <div className="text-gray-900">
      <div className="flex flex-col space-y-1 text-center mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Welcome back
        </h1>
        <p className="text-sm text-gray-500">
          Sign in to your Matchfix account
        </p>
      </div>

      <div className="grid gap-5">
        {/* Google 按钮 */}
        <Button
          type="button"
          onClick={signInWithGoogle}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium transition-all h-11 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isGoogleLoading ? (
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-700" />
          ) : (
            <GoogleIcon />
          )}
          {isGoogleLoading ? "Connecting..." : "Continue with Google"}
        </Button>

        {/* 分割线 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-400 font-medium">or</span>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={handleSignIn} autoComplete="on">
          <div className="grid gap-1.5">
            <Label
              htmlFor="modal-email"
              className="text-sm font-medium text-gray-700"
            >
              Email
            </Label>
            <Input
              ref={emailRef}
              id="modal-email"
              name="email"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              autoComplete="email"
              className="h-11 border-gray-300 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="modal-password"
                className="text-sm font-medium text-gray-700"
              >
                Password
              </Label>
              <button
                type="button"
                onClick={() => setView("forgot-password")}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                ref={passwordRef}
                id="modal-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                className="h-11 pr-10 border-gray-300 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center bg-red-50 border border-red-200 rounded-lg py-2 px-3">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold border-0 shadow-sm transition-all mt-1"
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-sm text-gray-500 text-center">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => setView("sign-up")}
            className="text-red-600 font-medium hover:text-red-700 transition-colors"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}