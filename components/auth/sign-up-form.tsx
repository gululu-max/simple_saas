"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useAuthModal } from "./auth-modal-context";
import { sendCompleteRegistrationEvent } from "@/lib/meta-capi";
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

// Supabase 原始错误 → 友好提示
function getFriendlyError(message: string): string {
  if (message.includes("User already registered") || message.includes("already been registered")) {
    return "This email is already registered. Please sign in instead.";
  }
  if (message.includes("Password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (message.includes("Unable to validate email address")) {
    return "Please enter a valid email address.";
  }
  if (message.includes("Signup is disabled")) {
    return "Sign up is currently unavailable. Please try again later.";
  }
  if (message.includes("Too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return message;
}

export default function SignUpForm() {
  const { setView, closeAuthModal } = useAuthModal();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const pathname = usePathname(); // 获取当前页面路径
  const router = useRouter(); // 👈 新增：用于登录成功后刷新页面

  // --- 新增：倒计时与重发逻辑 ---
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // --- 新增：监听跨标签页登录状态 ---
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // 监听到用户已登录（比如在另一个标签页点了邮件里的链接）
      if (event === 'SIGNED_IN' && session) {
        closeAuthModal(); // 自动关闭弹窗
        router.refresh(); // 刷新当前页面状态
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [closeAuthModal, router]);
  // ---------------------------------

  const handleResend = async () => {
    setCountdown(60);
    const supabase = createClient();
    await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${pathname}`,
      }
    });
  };
  // -----------------------------

  const handleSignUp = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    // 先查邮箱是否已注册
    try {
      const checkRes = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const { exists } = await checkRes.json();
      if (exists) {
        setError("This email is already registered. Please sign in instead.");
        setLoading(false);
        return;
      }
    } catch (e) {
      console.error("check-email error", e);
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // 将当前路径作为 redirect_to 参数传递给验证邮件的 callback
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${pathname}`,
      },
    });

    if (error) {
      setError(getFriendlyError(error.message));
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
    setCountdown(60); // 👈 新增这行，触发倒计时
  };

  const signUpWithGoogle = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // 将当前路径作为 redirect_to 参数传递给 callback 路由
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=${pathname}`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) { console.error(error.message); return; }
    if (data.url) window.location.href = data.url;
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-4 px-2 text-gray-900 animate-in fade-in zoom-in duration-300">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
        </div>
        
        <div className="text-center space-y-3">
          <h3 className="text-xl font-extrabold text-gray-900">Check your inbox now</h3>
          <p className="max-w-[280px] text-sm text-gray-600 leading-relaxed mx-auto">
            We just sent a magic link to <span className="font-semibold text-gray-900">{email}</span>.
          </p>
          
          <div className="bg-amber-50 text-amber-800 text-xs font-medium px-3 py-2.5 rounded-lg inline-block border border-amber-200 shadow-sm mt-2">
            ⚠️ Don&apos;t close this page. Click the link in your email to continue.
          </div>
        </div>

        <div className="w-full flex flex-col gap-3 mt-4">
          {email.includes("@gmail.com") && (
            <Button
              onClick={() => window.open("https://mail.google.com/mail/u/0/#inbox", "_blank")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-11 shadow-sm"
            >
              Open Gmail
            </Button>
          )}
          
          <Button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0}
            className="w-full h-11 bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 disabled:opacity-100 shadow-sm transition-all"
          >
            {countdown > 0 ? `Didn't get it? Resend in ${countdown}s` : "Resend email"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-gray-900">
      <div className="flex flex-col space-y-1 text-center mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Create your account
        </h1>
        <p className="text-sm text-gray-500">
        Stop guessing. Get a date tonight.
        </p>
      </div>

      <div className="grid gap-5">
        <Button
          type="button"
          onClick={signUpWithGoogle}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium transition-all h-11"
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-400 font-medium">or</span>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="modal-signup-email" className="text-sm font-medium text-gray-700">
              Email
            </Label>
            <Input
              id="modal-signup-email"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
              className="h-11 border-gray-300 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
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
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                className="h-11 pr-10 border-gray-300 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
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

          <Button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold border-0 shadow-sm transition-all mt-1"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </div>

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