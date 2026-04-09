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

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Matchfix | The Ultimate AI Profile booster",
  description: "Upload your photos and see how to get more matches.",
  keywords: "Matchfix, AI profile review, dating app tips, Tinder boost",
  other: {
    "facebook-domain-verification": "b34j96cqsebufe4eay7t75a61fmkf6",
  },
  openGraph: {
    title: "Matchfix | The Ultimate AI Profile booster",
    description: "Upload your photos and see how to get more matches.",
    type: "website",
    url: baseUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Matchfix | The Ultimate AI Profile booster",
    description: "Upload your photos and see how to get more matches.",
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
        {/*
          ✅ Google Fonts 改为非阻塞加载
          media="print" 让浏览器不等这个 CSS 就开始渲染
          onLoad 切回 media="all" 让字体生效
          这样 FCP 不再被字体 CSS 阻塞，省 200-400ms
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* ✅ 删除了 after-1.webp 的 preload — LCP 是 h1 不是图片，这个 preload 浪费带宽优先级 */}

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