"use client";

import { Logo } from "./logo";
import Link from "next/link";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    // 1. 去除默认边框，改为深色背景和极细的高级灰边框
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="container px-4 py-8 md:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-6">
          <div className="col-span-full lg:col-span-2">
            <Logo />
            {/* 2. 文本改为质感克制灰 */}
            <p className="mt-4 text-sm text-slate-400">
            Stop guessing. Start roasting.
            </p>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-4">
            {footerLinks.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                {/* 3. 标题加亮一层，提升层级感 */}
                <h3 className="text-sm font-medium text-slate-200">{group.title}</h3>
                <nav className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      // 4. 去除 hover:text-primary，改为 hover:text-rose-500 呼应荷尔蒙主题
                      className="text-sm text-slate-400 transition-colors hover:text-rose-500"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}