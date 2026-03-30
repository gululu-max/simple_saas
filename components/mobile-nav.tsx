"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Home, Wand2, DollarSign, LogOut, X } from "lucide-react";
import Link from "next/link";
import { signOutAction } from "@/app/actions";
import type { LucideIcon } from "lucide-react";

interface MobileNavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

interface MobileNavProps {
  items: MobileNavItem[];
  user: any;
  isDashboard: boolean;
}

function getIcon(label: string): LucideIcon {
  if (label.toLowerCase().includes("home")) return Home;
  if (label.toLowerCase().includes("photo") || label.toLowerCase().includes("enhancer")) return Wand2;
  if (label.toLowerCase().includes("pricing")) return DollarSign;
  return Home;
}

function getAvatarColor(email: string): string {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-emerald-500 to-teal-600",
    "from-sky-500 to-blue-600",
  ];
  return colors[email.charCodeAt(0) % colors.length];
}

function stripLeadingEmoji(label: string): string {
  return label.replace(/^[\uD800-\uDBFF][\uDC00-\uDFFF]\s*/, "").replace(/^\S{1,2}\s+/, (m) =>
    /[a-zA-Z0-9]/.test(m.trim()) ? m : ""
  ).trim();
}

export function MobileNav({ items, user, isDashboard }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const avatarColor = user?.email ? getAvatarColor(user.email) : "from-slate-500 to-slate-600";
  const avatarLetter = user?.email ? user.email[0].toUpperCase() : "?";

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div ref={ref} className="relative md:hidden">
      {/* 汉堡按钮 — 纯 CSS icon 切换 */}
      <Button
        variant="ghost"
        size="icon"
        className="text-slate-400 hover:text-slate-100 hover:bg-slate-800"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="transition-transform duration-150">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </span>
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* 蒙层 */}
      <div
        className={`
          fixed inset-x-0 top-16 bottom-0 z-40 bg-black/60 backdrop-blur-sm
          transition-opacity duration-200
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onClick={() => setOpen(false)}
      />

      {/* 下拉面板 */}
      <div
        className={`
          fixed left-0 right-0 top-16 z-50 border-b border-slate-800 bg-slate-900 shadow-2xl shadow-black/50
          transition-all duration-200 ease-out
          ${open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
          }
        `}
      >
        {/* 导航链接 */}
        <nav className="flex flex-col px-3 py-3">
          {items.map((item) => {
            const Icon = item.icon ?? getIcon(item.label);
            const cleanLabel = stripLeadingEmoji(item.label);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="group flex items-center gap-3 rounded-lg px-3 py-3 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 active:bg-slate-800 transition-all duration-150"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 group-hover:bg-slate-700 transition-colors">
                  <Icon className="h-4 w-4 text-slate-400 group-hover:text-slate-200" />
                </span>
                <span className="text-[15px] font-semibold">{cleanLabel}</span>
              </Link>
            );
          })}
        </nav>

        {/* 用户区域 */}
        {user && (
          <div className="mx-3 mb-3 mt-1 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor} text-white text-sm font-bold shadow-lg`}
                >
                  {avatarLetter}
                </div>
                <p className="text-sm text-slate-400 truncate">{user.email}</p>
              </div>
              <form action={signOutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors px-2"
                  onClick={() => setOpen(false)}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}