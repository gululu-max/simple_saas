import Header from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "next-themes";
import { createClient } from "@/utils/supabase/server";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import MetaPixel from "@/components/MetaPixel";
import { GoogleAnalytics } from '@next/third-parties/google';
import Script from "next/script";
import type { Metadata } from 'next';
import { AuthModalProvider } from "@/components/auth/auth-modal-context";
import { AuthModal } from "@/components/auth/auth-modal";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",          // 关键：保证文字立即可见，字体加载后替换
  weight: ["400", "500", "600", "700", "800", "900"],
});

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

  const { data: { user } } = await supabase.auth.getUser();

  let credits = 0;
  if (user) {
    const { data } = await supabase
      .from("customers")
      .select("credits")
      .eq("user_id", user.id)
      .single();
    if (data?.credits) credits = data.credits;
  }

  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <link rel="preload" href="/hero-demo.jpg" as="image" fetchPriority="high" />
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "w3fj41aw6c");
          `}
        </Script>
      </head>
      <body className="bg-slate-950 text-slate-50" suppressHydrationWarning>
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
              <Header user={user} credits={credits} />
              <main className="flex-1">{children}</main>
              <div className="pb-24 md:pb-0">
                <Footer />
              </div>
            </div>
            <Toaster />
          </ThemeProvider>
          <AuthModal />
        </AuthModalProvider>
        <GoogleAnalytics gaId="G-0SVH6XDETV" />
      </body>
    </html>
  );
}