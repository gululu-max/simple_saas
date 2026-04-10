import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sun, Crop, Palette, ShieldCheck, Zap, Heart, Camera } from "lucide-react";
import type { Metadata } from "next";

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

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">About Matchfix</h1>
              <p className="text-sm text-muted-foreground">
                AI photo enhancement that keeps you real
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
              Real Photos. Real You. Better Results.
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Your Face Stays 100% Real.
              <br />
              <span className="text-primary">We Just Fix Everything Around It.</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Most AI dating photo tools generate fake images of you. Matchfix takes a different approach — we enhance your actual photos with better lighting, framing, and color so you look like you on your best day.
            </p>
          </div>

          {/* What We Do Section */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                  <Sun className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle>Lighting Enhancement</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Bad lighting ruins great faces. Our AI corrects shadows, exposure, and white balance to make you look naturally well-lit — like a golden hour photo, not a bathroom selfie.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Crop className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Smart Framing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Professional photographers know that cropping and composition make or break a photo. Our AI applies the same framing principles that get attention on dating apps.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <Palette className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Color Correction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Washed-out colors and weird tints make you look lifeless. We bring out natural skin tones and vibrant backgrounds without over-filtering or making things look fake.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Story Section */}
          <div className="prose prose-lg max-w-none">
            <div className="bg-muted/30 rounded-2xl p-8 md:p-12">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Camera className="h-6 w-6 text-primary" />
                Why We Built Matchfix
              </h3>
              <div className="space-y-6 text-muted-foreground">
                <p>
                  We noticed something frustrating about the AI dating photo space: <strong>every tool was generating completely fake images.</strong> AI-generated photos where you&apos;re standing on a yacht you&apos;ve never been on, wearing clothes you don&apos;t own, with a jawline that isn&apos;t yours.
                </p>
                <p>
                  Sure, those photos might get you matches — but what happens when you show up to the date looking nothing like your profile? The match feels catfished, you feel embarrassed, and everyone&apos;s time is wasted.
                </p>
                <p>
                  We built Matchfix to solve this the right way. Instead of generating a fake version of you, we take your real photos and apply the same techniques a professional photographer would use in post-production: <strong>better lighting, tighter framing, corrected color.</strong> The result looks like you hired a great photographer — because the technology behind it works the same way.
                </p>
                <p>
                  Your face, your body, your real self — just presented in the best possible light. No catfishing. No awkward first-date surprises. Just more matches with people who actually want to meet <em>you</em>.
                </p>
              </div>
            </div>
          </div>

          {/* Values Section */}
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold mb-4">What Makes Us Different</h3>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                In a market full of AI face generators, we chose authenticity
              </p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Enhancement, Not Generation</h4>
                  <p className="text-muted-foreground">
                    We never replace your face or body. We enhance what&apos;s already there — lighting, composition, and color — the same things a $500 photographer would fix.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">No Catfishing</h4>
                  <p className="text-muted-foreground">
                    Your enhanced photo looks like you on a great day — not like someone else entirely. Show up to dates with confidence, not anxiety.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">3</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Privacy First</h4>
                  <p className="text-muted-foreground">
                    Your photos are auto-deleted after processing. We never store, share, or use your images for AI training. Your face is yours alone.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">4</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">30 Seconds, Not 30 Minutes</h4>
                  <p className="text-muted-foreground">
                    Upload one photo, get it back enhanced in seconds. No sign-up required, no complicated settings. First enhancement is free.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-8 md:p-12">
            <Heart className="h-12 w-12 text-primary mx-auto mb-6" />
            <h3 className="text-2xl font-bold mb-4">See the difference for yourself.</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Upload your dating profile photo and get an AI-enhanced version in 30 seconds. Your face stays real — we just make the photo work harder for you.
            </p>
            <Button asChild size="lg" className="font-medium">
              <Link href="/subscribe/scanner">
                Enhance Your Photo Free
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}