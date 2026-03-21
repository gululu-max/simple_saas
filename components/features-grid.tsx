"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Flame, Wand2, Ghost } from "lucide-react";

const features = [
  {
    title: "The Matchfix Scanner",
    description: "Your gym selfies are cringe. Our AI will use ruthless but accurate feedback to point out exactly why you're scaring away matches.",
    icon: <Flame className="w-6 h-6" />,
    link: "/dashboard/scanner"
  },
  {
    title: "AI Photo Scorer",
    description: "Stop guessing which photo works. Our AI analyzes facial expressions, lighting, and social cues to pick your top 3 winners.",
    icon: <Wand2 className="w-6 h-6" />,
    link: "/dashboard/photo-scorer"
  },
  {
    title: "Burn After Reading",
    description: "Your embarrassing photos are safe. We don't save your tragic screenshots—they are permanently deleted from our servers the second your boost is done.",
    icon: <Ghost className="w-6 h-6" />,
    link: "/dashboard"
  },
];

export function FeaturesGrid() {
  return (
    <div className="grid md:grid-cols-3 gap-8">
      {features.map((feature, index) => (
        <Link href={feature.link} key={index} className="block group">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-900 p-8 rounded-xl border border-slate-800 hover:border-red-500/50 transition-all h-full cursor-pointer shadow-lg relative overflow-hidden"
          >
            <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center mb-6 text-red-500 group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors">
              {feature.icon}
            </div>
            <h3 className="text-xl font-semibold mb-3 group-hover:text-red-400 transition-colors">
              {feature.title}
            </h3>
            <p className="text-slate-400 leading-relaxed">
              {feature.description}
            </p>
            <div className="mt-6 flex items-center text-sm font-medium text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Try it now <ArrowRight className="ml-2 w-4 h-4" />
            </div>
          </motion.div>
        </Link>
      ))}
    </div>
  );
}