"use client";

import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { Button } from "./ui/button";
import { Logo } from "./logo";
import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import { useState, useEffect, useCallback } from "react";
import { Zap, ChevronDown, Wand2, Image as ImageIcon, MessageCircleHeart } from "lucide-react";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { useT } from "@/lib/i18n/provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function Header() {
  const pathname = usePathname();
  const isSubscribe = pathname?.startsWith("/subscribe");
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const { openAuthModal } = useAuthModal();
  const t = useT();

  // ═══════════════════════════════════════════════════════════
  // [RESTORED 2026-05-29 — login revert] 用户态 + 积分获取恢复。
  // ═══════════════════════════════════════════════════════════
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const fetchPhotoCount = useCallback(async () => {
    try {
      const res = await fetch("/api/my-photos?count=1");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === "number") setPhotoCount(data.count);
    } catch {
      // silently fail — badge is a nicety
    }
  }, []);

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
          if (!cancelled) fetchPhotoCount();
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
      fetchPhotoCount();
    };

    window.addEventListener('auth-changed', handleAuthChanged);
    return () => window.removeEventListener('auth-changed', handleAuthChanged);
  }, [fetchCredits, fetchPhotoCount]);

  const featureLinks = [
    {
      title: t.header.aiPhotoEnhancerTitle,
      description: t.header.aiPhotoEnhancerDesc,
      icon: <Wand2 className="w-4 h-4 text-rausch" />,
      href: "/subscribe/scanner",
    },
    {
      title: "Opening Coach",
      description: "Practice better first messages after a match",
      icon: <MessageCircleHeart className="w-4 h-4 text-rausch" />,
      href: "/subscribe/opening-coach",
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
            {t.header.home}
          </Link>

          <div
            className="relative py-2 cursor-pointer group"
            onMouseEnter={() => setIsFeaturesOpen(true)}
            onMouseLeave={() => setIsFeaturesOpen(false)}
          >
            <span className="flex items-center gap-1 text-base font-semibold text-ink-muted group-hover:text-ink transition-colors">
              {t.header.features} <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFeaturesOpen ? "rotate-180" : ""}`} />
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
            {t.header.pricing}
          </Link>

          <Link href="/blog" className={navLinkCls(isActive("/blog"))}>
            {t.header.blog}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden md:block" />
          {/* [RESTORED 2026-05-29 — login revert] 登录/登出/积分 UI 恢复 */}
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
              <Button asChild size="sm" variant="outline" className="hidden md:inline-flex relative border-hairline bg-canvas text-ink hover:bg-surface-soft hover:text-ink rounded-btn">
                <Link href="/subscribe/photos" aria-label={t.header.myPhotos}>
                  <ImageIcon className="mr-1.5 h-4 w-4 text-ink-muted" />
                  <span className="hidden sm:inline">{t.header.myPhotos}</span>
                  {photoCount > 0 && (
                    <span className="ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center text-[10px] font-bold bg-rausch text-white">
                      {photoCount}
                    </span>
                  )}
                </Link>
              </Button>
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

          <MobileNav
            items={[
              { label: t.header.home, href: "/", iconKey: "home" },
              { label: t.header.aiPhotoEnhancerTitle, href: "/subscribe/scanner", iconKey: "enhancer" },
              { label: "Opening Coach", href: "/subscribe/opening-coach", iconKey: "coach" as const },
              ...(isLoggedIn ? [{ label: t.header.myPhotos, href: "/subscribe/photos", iconKey: "photos" as const }] : []),
              { label: t.header.pricing, href: "/subscribe#pricing", iconKey: "pricing" },
              { label: t.header.blog, href: "/blog", iconKey: "blog" },
            ]}
            user={isLoggedIn ? user : null}
            isDashboard={isSubscribe ?? false}
          />
        </div>
      </div>
    </header>
  );
}
