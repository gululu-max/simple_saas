import Header from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "next-themes";
import { createClient } from "@/utils/supabase/server";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
// 引入你的 Meta Pixel 组件
import MetaPixel from "@/components/MetaPixel";
// 1. 引入 Google Analytics 组件
import { GoogleAnalytics } from '@next/third-parties/google';
import type { Metadata } from 'next';

const baseUrl = process.env.BASE_URL
  ? `${process.env.BASE_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Matchfix | The Ultimate AI Profile booster",
  description: "Upload your photos and see how to get more matches.",
  keywords: "Matchfix, AI profile review, dating app tips, Tinder boost",
  other: {
    'facebook-domain-verification': 'b34j96cqsebufe4eay7t75a61fmkf6',
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  // 1. 获取当前登录用户
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. 查询用户的 credits 余额
  let credits = 0;
  if (user) {
    const { data } = await supabase
      .from("customers")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (data?.credits) {
      credits = data.credits;
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/hero-demo.jpg"
          as="image"
          fetchPriority="high"
        />
      </head>
      <body className="bg-slate-950 text-slate-50" suppressHydrationWarning>

        {/* Meta Pixel 保持不变 */}
        <MetaPixel />

        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="relative min-h-screen">
            <Header user={user} credits={credits} />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </ThemeProvider>

        {/* 2. 插入 Google Analytics 代码 */}
        <GoogleAnalytics gaId="G-0SVH6XDETV" />
      </body>
    </html>
  );
}