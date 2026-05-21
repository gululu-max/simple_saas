"use client";

import { Logo } from "./logo";
import Link from "next/link";
import { useT } from "@/lib/i18n/provider";

export function Footer() {
  const t = useT().footer;
  const footerLinks = [
    {
      title: t.groupProduct,
      links: [
        { label: t.linkFeatures, href: "/#features" },
        { label: t.linkPricing, href: "/#pricing" },
      ],
    },
    {
      title: t.groupCompany,
      links: [{ label: t.linkAbout, href: "/about" }],
    },
    {
      title: t.groupSupport,
      links: [{ label: t.linkEmailSupport, href: "mailto:gululumax01@gmail.com" }],
    },
    {
      title: t.groupLegal,
      links: [
        { label: t.linkPrivacy, href: "/privacy" },
        { label: t.linkTerms, href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="border-t border-hairline bg-canvas">
      <div className="container px-6 py-12 lg:py-section">
        {/* 主区：Logo + 4 列链接组 */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-6">
          <div className="col-span-full lg:col-span-2">
            <Logo />
            <p className="mt-4 text-sm text-ink-muted leading-[1.5] max-w-[260px]">
              {t.tagline}
            </p>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-4">
            {footerLinks.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                {/* 列标题 — title-sm: 16px / 500 ink */}
                <h3 className="text-base font-medium text-ink leading-[1.25]">
                  {group.title}
                </h3>
                <nav className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="text-sm text-ink-body hover:underline transition-colors leading-[1.43]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* Legal band — caption-sm 13px muted，hairline-soft 上边分隔 */}
        <div className="mt-12 pt-6 border-t border-hairline-soft flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <p className="text-[13px] text-ink-muted leading-[1.23]">
            © {new Date().getFullYear()} Matchfix · {t.copyright}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-[13px] text-ink-muted leading-[1.23]">
              {t.support}
            </span>
            <a
              href="mailto:gululumax01@gmail.com"
              className="text-[13px] text-ink hover:underline transition-colors leading-[1.23]"
            >
              gululumax01@gmail.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
