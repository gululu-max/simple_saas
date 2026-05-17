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

  // ═══════════════════════════════════════════════════════════
  // [DISABLED 2026-05-13 — no-login refactor]
  // 用户态 + 积分获取全部去掉。一次性生意不需要持久 user。
  // 未来恢复时：删除下面的占位常量，把再下方注释里的原 hook 代码
  // 取消注释即可。
  // ═══════════════════════════════════════════════════════════
  const user: any = null;
  const credits = 0;
  const loaded = true;
  const fetchCredits = async () => {};

  /*
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState(0);
  const [loaded, setLoaded] = useState(false);

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

  useEffect(() => {
    const handleCreditsUpdate = () => {
      setTimeout(() => fetchCredits(), 800);
    };

    window.addEventListener('credits-updated', handleCreditsUpdate);
    return () => window.removeEventListener('credits-updated', handleCreditsUpdate);
  }, [fetchCredits]);

  useEffect(() => {
    const handleAuthChanged = () => {
      fetchCredits().then(() => setLoaded(true));
    };

    window.addEventListener('auth-changed', handleAuthChanged);
    return () => window.removeEventListener('auth-changed', handleAuthChanged);
  }, [fetchCredits]);
  */
  // 引用一下避免 unused-var：
  void credits; void fetchCredits; void user;

  const featureLinks = [
    {
      title: "AI Photo Enhancer",
      description: "Unlock your best-looking photo with AI",
      icon: <Wand2 className="w-4 h-4 text-rausch" />,
      href: "/subscribe/scanner",
    },
  ];

  const isLoggedIn = loaded && user && user?.email;

  // Active 判断：home 严格相等，其余前缀匹配
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !!pathname?.startsWith(href.split("#")[0]);

  const navLinkCls = (active: boolean) =>
    `text-base font-semibold transition-colors ${
      active ? "text-ink" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="container flex h-16 items-center justify-between px-4">

        <div className="flex items-center">
          <Logo />
        </div>

        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
          <Link href="/" className={navLinkCls(isActive("/"))}>
            Home
          </Link>

          <div
            className="relative py-2 cursor-pointer group"
            onMouseEnter={() => setIsFeaturesOpen(true)}
            onMouseLeave={() => setIsFeaturesOpen(false)}
          >
            <span className="flex items-center gap-1 text-base font-semibold text-ink-muted group-hover:text-ink transition-colors">
              Features <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFeaturesOpen ? "rotate-180" : ""}`} />
            </span>

            <div
              className={`
                absolute top-full left-1/2 -translate-x-1/2 w-72 pt-3 z-50
                transition-all duration-200 ease-out
                ${isFeaturesOpen
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none"
                }
              `}
            >
              <div className="bg-canvas border border-hairline rounded-card shadow-ab-card p-2 overflow-hidden">
                {featureLinks.map((link) => (
                  <Link
                    key={link.title}
                    href={link.href}
                    className="flex items-start gap-3 p-3 rounded-btn hover:bg-surface-soft transition-colors group/item"
                  >
                    <div className="mt-1">{link.icon}</div>
                    <div>
                      <div className="text-sm font-semibold text-ink group-hover/item:text-rausch transition-colors">
                        {link.title}
                      </div>
                      <div className="text-xs text-ink-muted line-clamp-1">
                        {link.description}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link href="/subscribe#pricing" className={navLinkCls(isActive("/subscribe#pricing") || pathname === "/subscribe")}>
            Pricing
          </Link>

          <Link href="/blog" className={navLinkCls(isActive("/blog"))}>
            Blog
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {/* ═══════════════════════════════════════════════════════════
              [DISABLED 2026-05-13 — no-login refactor]
              登录/登出/积分 UI 暂时移除。未来恢复时把下方整段
              取消注释，并同步恢复 hooks 区块即可。
              ═══════════════════════════════════════════════════════════ */}
          {/*
          {!loaded ? (
            <div className="hidden md:flex gap-2">
              <div className="h-8 w-16 rounded-btn bg-surface-soft animate-pulse" />
              <div className="h-8 w-16 rounded-btn bg-surface-soft animate-pulse" />
            </div>
          ) : isLoggedIn ? (
            <div className="flex items-center gap-2">
              {isSubscribe && (
                <span className="hidden md:inline text-sm text-ink-muted mr-2">
                  {user.email}
                </span>
              )}
              <Button asChild size="sm" variant="outline" className="border-hairline bg-canvas text-ink hover:bg-surface-soft hover:text-ink rounded-btn">
                <Link href="/subscribe">
                  <Zap className="mr-1.5 h-4 w-4 text-rausch fill-rausch" />
                  {credits} <span className="hidden sm:inline ml-1">Credits</span>
                </Link>
              </Button>
              <form action={signOutAction} className="hidden md:block">
                <Button type="submit" variant="outline" size="sm" className="border-hairline bg-canvas text-ink hover:bg-surface-soft hover:text-ink rounded-btn">
                  Sign out
                </Button>
              </form>
            </div>
          ) : (
            <>
              <div className="hidden md:flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-ink hover:bg-surface-soft hover:text-ink rounded-btn"
                  onClick={() => openAuthModal("sign-in")}
                >
                  Sign in
                </Button>
                <Button
                  size="sm"
                  className="bg-rausch text-white hover:bg-rausch-active rounded-btn border-0"
                  onClick={() => openAuthModal("sign-up")}
                >
                  Sign up
                </Button>
              </div>

              <Button
                size="sm"
                className="md:hidden bg-rausch text-white hover:bg-rausch-active rounded-btn text-xs px-3 h-8 border-0"
                onClick={() => openAuthModal("sign-up")}
              >
                Get started
              </Button>
            </>
          )}
          */}

          <MobileNav
            items={[
              { label: "Home", href: "/" },
              { label: "AI Photo Enhancer", href: "/subscribe/scanner" },
              { label: "Pricing", href: "/subscribe#pricing" },
              { label: "Blog", href: "/blog" },
            ]}
            user={null}
            isDashboard={isSubscribe ?? false}
          />
        </div>
      </div>
    </header>
  );
}
