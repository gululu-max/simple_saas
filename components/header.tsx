"use client";

import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { Button } from "./ui/button";
// 已移除 ThemeSwitcher 引用
import { Logo } from "./logo";
import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
// 已移除无用的 Flame 图标引入

interface HeaderProps {
  user: any;
}

interface NavItem {
  label: string;
  href: string;
  icon?: any; // 将原来的 typeof Flame 改为了更通用的类型，方便以后加其他图标
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  // Main navigation items for generic SaaS
  const mainNavItems: NavItem[] = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
  ];

  // Dashboard items - 导航条目已清空，移除了“毒舌扫雷”
  const dashboardItems: NavItem[] = [];

  // Choose which navigation items to show
  const navItems = isDashboard ? dashboardItems : mainNavItems;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60 text-slate-50">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          <Logo />
        </div>
        
        {/* Centered Navigation */}
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
          {/* ThemeSwitcher 已从此处移除 */}
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              {isDashboard && (
                <span className="hidden sm:inline text-sm text-slate-500">
                  {user.email}
                </span>
              )}
              {!isDashboard && (
                <Button asChild size="sm" variant="outline" className="border-slate-800/70 bg-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              )}
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
          <MobileNav items={navItems} user={user} isDashboard={isDashboard} />
        </div>
      </div>
    </header>
  );
}