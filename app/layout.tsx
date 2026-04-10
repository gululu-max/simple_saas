import Header from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import MetaPixel from "@/components/MetaPixel";
import Script from "next/script";
import type { Metadata } from "next";
import { AuthModalProvider } from "@/components/auth/auth-modal-context";
import { AuthModal } from "@/components/auth/auth-modal";

const baseUrl = process.env.BASE_URL
  ? `${process.env.BASE_URL}`
  : "http://localhost:3000";

// ============================================================
// SEO Meta Tags — 全局默认
// 每个子页面可以通过自己的 export const metadata 覆盖这些值
// title.template 会让子页面标题自动变成 "子页面标题 | Matchfix"
// ============================================================
export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default:
      "Matchfix — AI Dating Photo Enhancer | Get More Matches on Tinder & Bumble",
    template: "%s | Matchfix",
  },
  description:
    "Enhance your real dating profile photos with AI. Better lighting, framing & color — your face stays 100% real. Get more matches on Tinder, Bumble & Hinge in seconds. First photo free.",
  keywords: [
    "AI dating photo enhancer",
    "dating profile photo editor",
    "improve dating photos",
    "tinder photo enhancer",
    "bumble profile photos",
    "hinge photo tips",
    "dating app photos",
    "AI photo enhancement",
    "get more matches",
    "dating profile optimization",
  ],
  authors: [{ name: "Matchfix" }],
  creator: "Matchfix",
  publisher: "Matchfix",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "Matchfix",
    title:
      "Matchfix — AI Dating Photo Enhancer | Get More Matches on Tinder & Bumble",
    description:
      "Enhance your real dating profile photos with AI. Better lighting, framing & color — 100% your real face. First photo free.",
    images: [
      {
        url: "/og-image.png", // ← 需要创建 1200x630 的 OG 图片放到 public/
        width: 1200,
        height: 630,
        alt: "Matchfix AI Dating Photo Enhancer — Before and After",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Matchfix — AI Dating Photo Enhancer | Get More Matches on Tinder & Bumble",
    description:
      "Enhance your real dating photos with AI. Better lighting, framing & color — 100% your real face. First photo free.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: baseUrl,
  },
  other: {
    "facebook-domain-verification": "b34j96cqsebufe4eay7t75a61fmkf6",
  },
  // ↓ 注册 Google Search Console 后把验证码填这里
  // verification: {
  //   google: "YOUR_GOOGLE_SEARCH_CONSOLE_VERIFICATION_CODE",
  // },
};

// ============================================================
// JSON-LD 结构化数据 — 帮助 Google 理解产品类型
// ============================================================
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Matchfix",
  applicationCategory: "PhotographyApplication",
  operatingSystem: "Web",
  url: "https://www.matchfix.site",
  description:
    "AI-powered dating profile photo enhancer. Improves lighting, framing and color on your real photos to get more matches on Tinder, Bumble and Hinge.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "First photo enhancement free",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* JSON-LD 结构化数据 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        <Script id="microsoft-clarity" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "w3fj41aw6c");
          `}
        </Script>
      </head>
      <body
        className="bg-slate-950 text-slate-50 font-[Inter,_-apple-system,_BlinkMacSystemFont,_'Segoe_UI',_Roboto,_'Helvetica_Neue',_Arial,_sans-serif]"
        suppressHydrationWarning
      >
        <MetaPixel />
        <AuthModalProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            forcedTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <div className="relative min-h-screen">
              <Header />
              <main className="flex-1">{children}</main>
              <div className="pb-24 md:pb-0">
                <Footer />
              </div>
            </div>
            <Toaster />
          </ThemeProvider>
          <AuthModal />
        </AuthModalProvider>

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-0SVH6XDETV"
          strategy="lazyOnload"
        />
        <Script id="ga-init" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-0SVH6XDETV');
          `}
        </Script>
      </body>
    </html>
  );
}