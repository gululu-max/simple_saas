import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Dating Photo Enhancer — Upgrade Your Profile Photo in 30 Seconds",
  description:
    "Upload your dating profile photo and get AI-enhanced lighting, framing & color instantly. No AI-generated faces — your real photo, just better. Works for Tinder, Bumble, Hinge & all dating apps. First enhancement free.",
  alternates: {
    canonical: "https://www.matchfix.site/subscribe/scanner",
  },
  openGraph: {
    title: "AI Dating Photo Enhancer — Upgrade Your Profile in 30 Seconds",
    description:
      "Upload your photo → enhanced lighting, framing & color → more matches. 100% your real face.",
    url: "https://www.matchfix.site/subscribe/scanner",
  },
};

export default function ScannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}