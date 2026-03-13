import Header from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "next-themes";
import { createClient } from "@/utils/supabase/server";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
// 引入你的 Meta Pixel 组件
import MetaPixel from "@/components/MetaPixel"; 

const baseUrl = process.env.BASE_URL
  ? `${process.env.BASE_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: "Matchfix | The Ultimate AI Profile Roaster",
  description: "Stop blaming the algorithm. Let AI destroy your dating delusions.",
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
  
  // 1. 获取当前登录用户
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. 查询用户的 credits 余额
  let credits = 0;
  if (user) {
    // 根据 dashboard 的逻辑，正确查询 customers 表
    const { data } = await supabase
      .from("customers") 
      .select("credits") // 因为 Header 只需要额度，所以只 select credits 即可，不用像 dashboard 查那么多
      .eq("user_id", user.id) // 注意：这里是 user_id
      .single();
      
    if (data?.credits) {
      credits = data.credits;
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-50" suppressHydrationWarning>
        
        {/* 在这里插入 Meta Pixel 组件，紧贴着 body 标签下面 */}
        <MetaPixel />
        
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="relative min-h-screen">
            {/* 3. 修改：将查询到的 credits 传给 Header 组件 */}
            <Header user={user} credits={credits} />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}