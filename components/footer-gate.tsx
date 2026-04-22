"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./footer";

const HIDDEN_PREFIXES = ["/subscribe/scanner"];

export function FooterGate() {
  const pathname = usePathname();
  if (pathname && HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }
  return (
    <div className="pb-24 md:pb-0">
      <Footer />
    </div>
  );
}
