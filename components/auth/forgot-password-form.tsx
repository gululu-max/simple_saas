"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useAuthModal } from "./auth-modal-context";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordForm() {
  const { setView } = useAuthModal();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect_to=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-6 px-4 text-gray-900">
        <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-blue-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-gray-900">Check your email</h3>
          <p className="max-w-[260px] text-sm text-gray-500 leading-relaxed">
            We&apos;ve sent a reset link to{" "}
            <span className="font-medium text-gray-700">{email}</span>.
            Please check your inbox.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView("sign-in")}
          className="mt-1 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="text-gray-900">
      {/* 标题 */}
      <div className="flex flex-col space-y-1 text-center mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Reset password
        </h1>
        <p className="text-sm text-gray-500">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <div className="grid gap-5">
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="forgot-email" className="text-sm font-medium text-gray-700">
              Email
            </Label>
            <Input
              id="forgot-email"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 border-gray-300 bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              required
            />
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
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setView("sign-in")}
          className="flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </button>
      </div>
    </div>
  );
}