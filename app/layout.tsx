import Header from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "next-themes";
import { createClient } from "@/utils/supabase/server";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const baseUrl = process.env.BASE_URL
  ? `${process.env.BASE_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: "Matchfix | The Ultimate AI Profile Roaster", // 帮你顺手把标题改成了你的产品名
  description: "Stop blaming the algorithm. Let AI destroy your dating delusions.", // 描述也换成了你的文案
  keywords: "Matchfix, AI profile review, dating app tips, Tinder roast",
  openGraph: {
    title: "Matchfix | The Ultimate AI Profile Roaster",
    description: "Stop blaming the algorithm. Let AI destroy your dating delusions.",
    type: "website",
    url: baseUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Matchfix | The Ultimate AI Profile Roaster",
    description: "Stop blaming the algorithm. Let AI destroy your dating delusions.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-50" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark" // 1. 默认改为深色
          forcedTheme="dark"  // 2. 强制锁定深色模式，彻底消灭白条隐患
          enableSystem={false} // 3. 关闭跟随系统设定
          disableTransitionOnChange
        >
          <div className="relative min-h-screen">
            <Header user={user} />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}