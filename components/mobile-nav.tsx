"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Menu, Home, Wand2, DollarSign, LogOut, X, BookOpen, Image as ImageIcon, MessageCircleHeart } from "lucide-react";
import Link from "next/link";
import { signOutAction } from "@/app/actions";
import type { LucideIcon } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";

type IconKey = "home" | "enhancer" | "pricing" | "blog" | "photos" | "coach";

interface MobileNavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  iconKey?: IconKey;
}

interface MobileNavProps {
  items: MobileNavItem[];
  user: any;
  isDashboard: boolean;
}

const ICONS: Record<IconKey, LucideIcon> = {
  home: Home,
  enhancer: Wand2,
  pricing: DollarSign,
  blog: BookOpen,
  photos: ImageIcon,
  coach: MessageCircleHeart,
};

export function MobileNav({ items, user }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
      <Button
        variant="ghost"
        size="icon"
        className="text-ink-muted hover:text-ink hover:bg-surface-soft"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="transition-transform duration-150">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </span>
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* 蒙层 — Airbnb scrim：纯黑 50% */}
      <div
        className={`
          fixed inset-x-0 top-16 bottom-0 z-40 bg-black/50
          transition-opacity duration-200
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onClick={() => setOpen(false)}
      />

      {/* 下拉面板 — 白底 + hairline + 单层阴影 */}
      <div
        className={`
          fixed left-0 right-0 top-16 z-50 border-b border-hairline bg-canvas shadow-ab-card
          transition-all duration-200 ease-out
          ${open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
          }
        `}
      >
        <nav className="flex flex-col px-3 py-3">
          {items.map((item) => {
            const Icon = item.icon ?? (item.iconKey ? ICONS[item.iconKey] : Home);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="group flex items-center gap-3 rounded-btn px-3 py-3 text-ink-body hover:text-ink hover:bg-surface-soft active:bg-surface-strong transition-colors"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-soft group-hover:bg-surface-strong transition-colors">
                  <Icon className="h-4 w-4 text-ink-muted group-hover:text-ink" />
                </span>
                <span className="text-[15px] font-semibold">{item.label}</span>
              </Link>
            );
          })}

          <div className="mt-2 pt-3 border-t border-hairline-soft px-3">
            <LanguageSwitcher />
          </div>
        </nav>

        {user && (
          <div className="mx-3 mb-3 mt-1 rounded-card border border-hairline bg-surface-soft p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-rausch text-white text-sm font-bold">
                  {avatarLetter}
                </div>
                <p className="text-sm text-ink-body truncate">{user.email}</p>
              </div>
              <form action={signOutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-ink-muted hover:text-rausch hover:bg-canvas transition-colors px-2"
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
