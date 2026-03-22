"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
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

export function MobileNav({ items, user, isDashboard }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-4 mt-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="text-lg font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              <span className="inline-flex items-center gap-2">
                {item.icon && <item.icon className="h-4 w-4" />}
                <span>{item.label}</span>
              </span>
            </Link>
          ))}
        </nav>

        {/* 只有已登录时才在抽屉底部显示用户信息和退出按钮 */}
        {user && (
          <div className="mt-auto pt-4 border-t">
            <div className="flex flex-col gap-2">
              {user.email && (
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              )}
              <form action={signOutAction} className="w-full">
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  onClick={() => setOpen(false)}
                >
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}