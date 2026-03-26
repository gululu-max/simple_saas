"use client";

import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { Button } from "./ui/button";
import { Logo } from "./logo";
import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Flame, ScanSearch, ChevronDown, Wand2 } from "lucide-react";
import { useAuthModal } from "@/components/auth/auth-modal-context";

interface HeaderProps {
  user: any;
  credits?: number;
}

export default function Header({ user, credits = 0 }: HeaderProps) {
  const pathname = usePathname();
  const isSubscribe = pathname?.startsWith("/subscribe");
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const { openAuthModal } = useAuthModal();

  const featureLinks = [
    {
      title: "AI Photo Enhancer",
      description: "Unlock your best-looking photo with AI",
      icon: <Wand2 className="w-4 h-4 text-purple-500" />,
      href: "/subscribe/photo-enhancer",
    },
    // Photo Scorer 已下线，后续优化完再上
  ];

  const isLoggedIn = user && user?.email;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60 text-slate-50">
      <div className="container flex h-16 items-center justify-between px-4">

        {/* Logo */}
        <div className="flex items-center">
          <Logo />
        </div>

        {/* 桌面端导航 */}
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
            <AnimatePresence>
              {isFeaturesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 w-72 pt-4 z-50"
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link href="/#pricing" className="text-lg font-semibold text-slate-400 transition-colors hover:text-slate-100">
            Pricing
          </Link>
        </nav>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
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
              { label: "✨ AI Photo Enhancer", href: "/subscribe/photo-enhancer" },
              // Photo Scorer 已下线
              { label: "Pricing", href: "/#pricing" },
            ]}
            user={isLoggedIn ? user : null}
            isDashboard={isSubscribe}
          />
        </div>
      </div>
    </header>
  );
}