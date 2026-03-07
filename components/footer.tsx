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
    title: "Support",
    links: [
      { label: "Email Support", href: "mailto:gululumax01@gmail.com" },
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
    <footer className="border-t border-slate-900 bg-slate-950">
      <div className="container px-4 py-8 md:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-6">
          <div className="col-span-full lg:col-span-2">
            <Logo />
            <p className="mt-4 text-sm text-slate-400">
              Stop guessing. Start roasting.
            </p>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-4">
            {footerLinks.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-slate-200">{group.title}</h3>
                <nav className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
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
        
        {/* 底部版权和邮箱：统一字号并完美居中对齐 */}
        <div className="mt-16 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Matchfix. All rights reserved.
          </p>
          
          <div className="flex items-center gap-2">
             <span className="text-sm text-slate-600 font-medium">
               Support:
             </span>
             <a 
               href="mailto:gululumax01@gmail.com" 
               className="text-sm text-slate-500 hover:text-rose-500 transition-colors"
             >
               gululumax01@gmail.com
             </a>
          </div>
        </div>
      </div>
    </footer>
  );
}