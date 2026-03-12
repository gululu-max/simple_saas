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
  // 1. 新增一个状态来控制抽屉的开关
  const [open, setOpen] = useState(false);

  return (
    // 2. 将状态绑定到 Sheet 组件上
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <SheetHeader>
          {/* 3. 给标题加上 sr-only 隐身衣，解决红屏报错 */}
          <SheetTitle className="sr-only">Navigation</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-4 mt-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // 4. 点击任何菜单项时，把状态设为 false (关闭抽屉)
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
        <div className="mt-auto pt-4 border-t">
          {user ? (
            <div className="flex flex-col gap-2">
              {user.email && (
                <p className="text-sm text-muted-foreground">{user.email}</p>
              )}
              <form action={signOutAction} className="w-full">
                {/* 点击 Sign out 自动关闭 */}
                <Button type="submit" variant="outline" className="w-full" onClick={() => setOpen(false)}>
                  Sign out
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full">
                {/* 点击 Sign in 自动关闭 */}
                <Link href="/sign-in" onClick={() => setOpen(false)}>Sign in</Link>
              </Button>
              <Button asChild variant="default" className="w-full">
                {/* 点击 Sign up 自动关闭 */}
                <Link href="/sign-up" onClick={() => setOpen(false)}>Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}