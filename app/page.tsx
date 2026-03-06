"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Flame, Wand2, Ghost, CheckCircle2 } from "lucide-react";
import { PricingSection } from "@/components/pricing-section";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background -z-10" />
        
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                Matchfix: The Ultimate AI Profile Roaster
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                Why are you still single?<br className="hidden sm:inline" />
                Let AI destroy your dating delusions.
              </h1>
              <p className="text-xl text-muted-foreground max-w-[600px] mx-auto">
                Stop blaming the algorithm. Upload your Tinder/Hinge screenshots or those tragic mirror selfies, and get the most ruthless, honest roast. Get a reality check, then get matches.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 w-full justify-center"
            >
              <Link href="/dashboard/scanner">
                <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-lg gap-2">
                  🔥 Get Roasted <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="pt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground"
            >
                <div className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500"/> No sign-up required</div>
                <div className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500"/> Auto-deleted instantly</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Fix Your Awful Profile</h2>
            <p className="text-muted-foreground text-lg">Better to get roasted by us than swiped left by everyone else.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-background p-8 rounded-xl border hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6 text-primary">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-20 border-y">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="space-y-2">
                <div className="text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
       {/* CTA Section */}
       <section className="py-20 bg-primary text-primary-foreground">
        <div className="container px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to face reality?</h2>
            <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto text-lg">
                Don't let terrible photos ruin your dating life. Upload a screenshot and let our AI give you the reality check you desperately need.
            </p>
            <Link href="/dashboard/scanner">
                <Button size="lg" variant="secondary" className="h-12 px-8 text-lg gap-2">
                  Upload Profile <ArrowRight className="w-4 h-4" />
                </Button>
            </Link>
        </div>
      </section>
      
      {/* PricingSection */}
      <PricingSection />    
    </div>
  );
}

const features = [
  {
    title: "Zero Sugarcoating",
    description: "Your gym selfies are cringe. Our AI will use ruthless but accurate feedback to point out exactly why you're scaring away matches.",
    icon: <Flame className="w-6 h-6" />,
  },
  {
    title: "Actionable Fixes",
    description: "We don't just roast; we rescue. Every roast comes with 3 high-impact tips to overhaul your profile. Follow them, and watch your match rate double.",
    icon: <Wand2 className="w-6 h-6" />,
  },
  {
    title: "Burn After Reading",
    description: "Your embarrassing photos are safe. We don't save your tragic screenshots—they are permanently deleted from our servers the second your roast is done.",
    icon: <Ghost className="w-6 h-6" />,
  },
];

const stats = [
  { value: "100%", label: "Unfiltered Roasts" },
  { value: "3", label: "Key Fixes Per Roast" },
  { value: "0", label: "Privacy Risks" },
  { value: "24/7", label: "Relentless Roasting" },
];