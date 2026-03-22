"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useAuthModal } from "./auth-modal-context";
import { sendCompleteRegistrationEvent } from "@/lib/meta-capi";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function SignUpForm() {
  const { setView, closeAuthModal } = useAuthModal();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    try {
      await sendCompleteRegistrationEvent(email, { eventId: `reg_${Date.now()}` });
    } catch (e) {
      console.error("Meta CAPI error", e);
    }

    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "sign_up_complete", { method: "email" });
    }

    setSuccess(true);
    setLoading(false);
  };

  const signUpWithGoogle = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) { console.error(error.message); return; }
    if (data.url) window.location.href = data.url;
  };

  // 注册成功状态
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-6 px-4 text-gray-900">
        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7 text-green-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-gray-900">Check your email</h3>
          <p className="max-w-[260px] text-sm text-gray-500 leading-relaxed">
            We&apos;ve sent a verification link to{" "}
            <span className="font-medium text-gray-700">{email}</span>.
            Please check your inbox.
          </p>
        </div>
        <Button
          onClick={closeAuthModal}
          className="mt-2 bg-gray-900 hover:bg-gray-800 text-white px-8 h-10"
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="text-gray-900">
      {/* 标题 */}
      <div className="flex flex-col space-y-1 text-center mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Create your account
        </h1>
        <p className="text-sm text-gray-500">
          Stop guessing. Start boosting.
        </p>
      </div>

      <div className="grid gap-5">
        {/* Google 按钮 */}
        <Button
          type="button"
          onClick={signUpWithGoogle}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium transition-all h-11"
        >
          <GoogleIcon />
          Continue with Google
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

        {/* 邮箱+密码表单 */}
        <form className="grid gap-4" onSubmit={handleSignUp}>
          <div className="grid gap-1.5">
            <Label htmlFor="modal-signup-email" className="text-sm font-medium text-gray-700">
              Email
            </Label>
            <Input
              id="modal-signup-email"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 border-gray-300 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="modal-signup-password" className="text-sm font-medium text-gray-700">
              Password
            </Label>
            <div className="relative">
              <Input
                id="modal-signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pr-10 border-gray-300 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center bg-red-50 border border-red-200 rounded-lg py-2 px-3">
              {error}
            </p>
          )}

          {/* 两个按钮风格完全一致 */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold border-0 shadow-sm transition-all mt-1"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        {/* 切换登录 */}
        <p className="text-sm text-gray-500 text-center">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => setView("sign-in")}
            className="text-red-600 font-medium hover:text-red-700 transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}