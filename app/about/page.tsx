import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShieldAlert, Crosshair, BrainCircuit, HeartCrack, Flame } from "lucide-react";
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
                The story behind the ultimate BS detector
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
              <span className="mr-2">🚩</span>
              Saving You From Dating Disasters
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Modern Dating is a Minefield.
              <br />
              <span className="text-primary">We Are the Minesweeper.</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              We built Matchfix because we got tired of friends swiping right on walking red flags. 
              It&apos;s time to bring brutally honest AI analysis to the chaotic world of online dating.
            </p>
          </div>

          {/* Mission Section */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mb-4">
                  <ShieldAlert className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle>Detect Red Flags</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  &ldquo;I&apos;m fluent in sarcasm&rdquo; usually just means &ldquo;I&apos;m mean.&rdquo; We decode the clichés so you don&apos;t have to waste your Friday night.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
                  <Crosshair className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle>Brutal Honesty</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your friends might lie to spare your feelings, but our AI won&apos;t. Expect a boost that hits close to home.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <BrainCircuit className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>AI-Powered Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Powered by advanced vision and text models, we analyze the subtext behind the gym selfies and generic bios.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Story Section */}
          <div className="prose prose-lg max-w-none">
            <div className="bg-muted/30 rounded-2xl p-8 md:p-12">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Flame className="h-6 w-6 text-primary" />
                Our Story: Why We Built This
              </h3>
              <div className="space-y-6 text-muted-foreground">
                <p>
                  Matchfix was born out of pure frustration. After sitting through countless brunches listening to friends complain about matches who looked great on paper but were total disasters in real life, we realized something: <strong>people are terrible at reading dating profiles objectively.</strong>
                </p>
                <p>
                  When you&apos;re looking for love (or just a fun weekend), you tend to wear rose-colored glasses. You ignore the fact that their only personality trait is &ldquo;liking dogs&rdquo; or that all 6 photos are group shots where you can&apos;t tell who they are.
                </p>
                <p>
                  We decided to train an AI to be the ultimate wingman—the kind that slaps the phone out of your hand when you&apos;re about to make a bad decision. By combining image recognition with natural language processing, Matchfix rips apart the carefully curated facade of dating profiles to give you the harsh truth, wrapped in a healthy layer of comedy.
                </p>
              </div>
            </div>
          </div>

          {/* Values Section */}
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold mb-4">Our Core Tenets</h3>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                What drives our merciless AI engine
              </p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">No Sugarcoating</h4>
                  <p className="text-muted-foreground">
                    We deliver the truth straight up. If a profile screams &ldquo;narcissist with commitment issues,&rdquo; our AI will say exactly that.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Humor is Coping</h4>
                  <p className="text-muted-foreground">
                    Dating is hard enough. If we&apos;re going to point out red flags, we&apos;re going to make you laugh while doing it.
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
                    We process the screenshots to give you the boost, but we don&apos;t save or share the identities of your potential matches.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">4</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Save Time &amp; Energy</h4>
                  <p className="text-muted-foreground">
                    Every minute spent texting a walking red flag is a minute wasted. We help you filter the noise fast.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-8 md:p-12">
            <HeartCrack className="h-12 w-12 text-primary mx-auto mb-6" />
            <h3 className="text-2xl font-bold mb-4">Stop guessing. Get a date tonight.</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Got a screenshot of someone you just matched with? Let our AI tear their profile apart before you commit to that coffee date.
            </p>
            <Button asChild size="lg" className="font-medium">
              <Link href="/">
                boost a Profile Now
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}