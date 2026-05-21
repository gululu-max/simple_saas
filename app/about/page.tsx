import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sun, Crop, Palette, ShieldCheck, Zap, Heart, Camera } from "lucide-react";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "About — Why We Enhance Real Photos, Not Generate Fake Ones",
  description:
    "Matchfix enhances your real dating photos with AI — no fake faces, no AI-generated images. Learn why authenticity gets you better matches and how our technology works.",
  alternates: {
    canonical: "https://www.matchfix.site/about",
  },
  openGraph: {
    title: "About Matchfix — Real Photo Enhancement, Not AI Face Generation",
    description:
      "We fix lighting, framing & color on your real photos. No fake AI faces.",
    url: "https://www.matchfix.site/about",
  },
};

export default async function AboutPage() {
  const { dict } = await getDictionary();
  const t = dict.about;
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                {t.backToHome}
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{t.headerTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {t.headerSubtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container px-4 md:px-6 py-16">
        <div className="max-w-4xl mx-auto space-y-16">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center rounded-full px-3 py-1 text-sm bg-primary/10 text-primary mb-4">
              <span className="mr-2">📸</span>
              {t.heroBadge}
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {t.heroTitle}
              <br />
              <span className="text-primary">{t.heroTitleAccent}</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {t.heroSubtitle}
            </p>
          </div>

          {/* What We Do Section */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                  <Sun className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle>{t.feat1Title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t.feat1Body}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Crop className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>{t.feat2Title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t.feat2Body}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <Palette className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>{t.feat3Title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t.feat3Body}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Story Section */}
          <div className="prose prose-lg max-w-none">
            <div className="bg-muted/30 rounded-2xl p-8 md:p-12">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Camera className="h-6 w-6 text-primary" />
                {t.storyTitle}
              </h3>
              <div className="space-y-6 text-muted-foreground">
                <p>
                  <strong>{t.storyP1Strong}</strong> {t.storyP1}
                </p>
                <p>{t.storyP2}</p>
                <p>
                  <strong>{t.storyP3Strong}</strong> {t.storyP3}
                </p>
                <p>{t.storyP4}</p>
              </div>
            </div>
          </div>

          {/* Values Section */}
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold mb-4">{t.valuesTitle}</h3>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.valuesSubtitle}
              </p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">{t.value1Title}</h4>
                  <p className="text-muted-foreground">
                    {t.value1Body}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">{t.value2Title}</h4>
                  <p className="text-muted-foreground">{t.value2Body}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">3</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">{t.value3Title}</h4>
                  <p className="text-muted-foreground">{t.value3Body}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">4</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">{t.value4Title}</h4>
                  <p className="text-muted-foreground">{t.value4Body}</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-8 md:p-12">
            <Heart className="h-12 w-12 text-primary mx-auto mb-6" />
            <h3 className="text-2xl font-bold mb-4">{t.ctaTitle}</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              {t.ctaBody}
            </p>
            <Button asChild size="lg" className="font-medium">
              <Link href="/subscribe/scanner">
                {t.ctaButton}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}