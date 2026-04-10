"use client";

import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { Button } from "./ui/button";
import { Logo } from "./logo";
import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import { useState, useEffect, useCallback } from "react";
import { Zap, ChevronDown, Wand2 } from "lucide-react";
import { useAuthModal } from "@/components/auth/auth-modal-context";

export default function Header() {
  const pathname = usePathname();
  const isSubscribe = pathname?.startsWith("/subscribe");
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const { openAuthModal } = useAuthModal();

  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // ─── Fetch credits (reusable) ─────────────────────────────
  const fetchCredits = useCallback(async () => {
    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      setUser(currentUser);
      const { data } = await supabase
        .from("customers")
        .select("credits")
        .eq("user_id", currentUser.id)
        .single();
      if (data?.credits != null) {
        setCredits(data.credits);
      }
    } catch {
      // silently fail
    }
  }, []);

  // ─── Initial load ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    import("@/utils/supabase/client").then(async ({ createClient }) => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;

        if (user) {
          setUser(user);
          const { data } = await supabase
            .from("customers")
            .select("credits")
            .eq("user_id", user.id)
            .single();
          if (!cancelled && data?.credits != null) {
            setCredits(data.credits);
          }
        }
      } catch {
        // 失败时保持未登录状态
      } finally {
        if (!cancelled) setLoaded(true);
      }
    });

    return () => { cancelled = true; };
  }, []);

  // ─── Listen for credits-updated events from BoostScanner ──
  useEffect(() => {
    const handleCreditsUpdate = () => {
      // Small delay to let backend finish writing
      setTimeout(() => fetchCredits(), 800);
    };

    window.addEventListener('credits-updated', handleCreditsUpdate);
    return () => window.removeEventListener('credits-updated', handleCreditsUpdate);
  }, [fetchCredits]);
  // ← 加在这里，紧跟上面那个 useEffect
  // ─── Listen for auth changes (login/logout) ────────────────
  useEffect(() => {
    const handleAuthChanged = () => {
      fetchCredits().then(() => setLoaded(true));
    };

    window.addEventListener('auth-changed', handleAuthChanged);
    return () => window.removeEventListener('auth-changed', handleAuthChanged);
  }, [fetchCredits]);

  const featureLinks = [
    {
      title: "AI Photo Enhancer",
      description: "Unlock your best-looking photo with AI",
      icon: <Wand2 className="w-4 h-4 text-purple-500" />,
      href: "/subscribe/scanner",
    },
  ];

  const isLoggedIn = loaded && user && user?.email;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60 text-slate-50">
      <div className="container flex h-16 items-center justify-between px-4">

        <div className="flex items-center">
          <Logo />
        </div>

        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
          <Link href="/" className="text-lg font-semibold text-slate-400 transition-colors hover:text-slate-100">
            Home
          </Link>

          <div
            className="relative py-2 cursor-pointer group"
            onMouseEnter={() => setIsFeaturesOpen(true)}
            onMouseLeave={() => setIsFeaturesOpen(false)}
          >
            <span className="flex items-center gap-1 text-lg font-semibold text-slate-400 group-hover:text-slate-100 transition-colors">
              Features <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFeaturesOpen ? "rotate-180" : ""}`} />
            </span>

            <div
              className={`
                absolute top-full left-1/2 -translate-x-1/2 w-72 pt-4 z-50
                transition-all duration-200 ease-out
                ${isFeaturesOpen
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none"
                }
              `}
            >
              <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 overflow-hidden backdrop-blur-xl">
                {featureLinks.map((link) => (
                  <Link
                    key={link.title}
                    href={link.href}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors group/item"
                  >
                    <div className="mt-1">{link.icon}</div>
                    <div>
                      <div className="text-sm font-bold text-slate-100 group-hover/item:text-red-400 transition-colors">
                        {link.title}
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-1">
                        {link.description}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link href="/subscribe#pricing" className="text-lg font-semibold text-slate-400 transition-colors hover:text-slate-100">
            Pricing
          </Link>

          <Link href="/blog" className="text-lg font-semibold text-slate-400 transition-colors hover:text-slate-100">
            Blog
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {!loaded ? (
            <div className="hidden md:flex gap-2">
              <div className="h-8 w-16 rounded-md bg-slate-800 animate-pulse" />
              <div className="h-8 w-16 rounded-md bg-slate-800 animate-pulse" />
            </div>
          ) : isLoggedIn ? (
            <div className="flex items-center gap-2">
              {isSubscribe && (
                <span className="hidden md:inline text-sm text-slate-500 mr-2">
                  {user.email}
                </span>
              )}
              <Button asChild size="sm" variant="outline" className="border-slate-800/70 bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100">
                <Link href="/subscribe">
                  <Zap className="mr-1.5 h-4 w-4 text-amber-500 fill-amber-500" />
                  {credits} <span className="hidden sm:inline ml-1">Credits</span>
                </Link>
              </Button>
              <form action={signOutAction} className="hidden md:block">
                <Button type="submit" variant="outline" size="sm" className="border-slate-800/70 bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100">
                  Sign out
                </Button>
              </form>
            </div>
          ) : (
            <>
              <div className="hidden md:flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-800/70 bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                  onClick={() => openAuthModal("sign-in")}
                >
                  Sign in
                </Button>
                <Button
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700 border-0"
                  onClick={() => openAuthModal("sign-up")}
                >
                  Sign up
                </Button>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="md:hidden border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100 text-xs px-3 h-8"
                onClick={() => openAuthModal("sign-up")}
              >
                Get started
              </Button>
            </>
          )}

          <MobileNav
            items={[
              { label: "Home", href: "/" },
              { label: "✨ AI Photo Enhancer", href: "/subscribe/scanner" },
              { label: "Pricing", href: "/subscribe#pricing" },
              { label: "Blog", href: "/blog" },
            ]}
            user={isLoggedIn ? user : null}
            isDashboard={isSubscribe ?? false}
          />
        </div>
      </div>
    </header>
  );
}