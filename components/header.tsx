"use client";

import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { Button } from "./ui/button";
import { Logo } from "./logo";
import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";

interface HeaderProps {
  user: any;
  credits?: number;
}

interface NavItem {
  label: string;
  href: string;
  icon?: any;
}

export default function Header({ user, credits = 0 }: HeaderProps) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  const mainNavItems: NavItem[] = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
  ];

  const dashboardItems: NavItem[] = [];
  const navItems = isDashboard ? dashboardItems : mainNavItems;

  // 【关键修复】：这里加上一个布尔值判断，确保 user 真的包含信息
  const isLoggedIn = user && user?.email; 

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60 text-slate-50">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          <Logo />
        </div>
        
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-lg font-semibold text-slate-400 transition-colors hover:text-slate-100"
            >
              <span className="inline-flex items-center gap-2">
                {item.icon && <item.icon className="h-4 w-4" />}
                <span>{item.label}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* 【修复点】：使用 isLoggedIn 进行严格判断 */}
          {isLoggedIn ? (
            <div className="hidden md:flex items-center gap-2">
              {isDashboard && (
                <span className="hidden sm:inline text-sm text-slate-500">
                  {user.email}
                </span>
              )}
              
              <Button asChild size="sm" variant="outline" className="border-slate-800/70 bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100">
                <Link href="/dashboard">
                  <span className="mr-1.5 text-amber-500">🪙</span>
                  {credits} Credits
                </Link>
              </Button>

              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm" className="border-slate-800/70 bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100">
                  Sign out
                </Button>
              </form>
            </div>
          ) : (
            <div className="hidden md:flex gap-2">
              <Button asChild size="sm" variant="outline" className="border-slate-800/70 bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="bg-red-600 text-white hover:bg-red-700 border-0">
                <Link href="/sign-up">Sign up</Link>
              </Button>
            </div>
          )}
          {/* MobileNav 也最好使用严格判断的状态传入，避免移动端也出 bug */}
          <MobileNav items={navItems} user={isLoggedIn ? user : null} isDashboard={isDashboard} />
        </div>
      </div>
    </header>
  );
}