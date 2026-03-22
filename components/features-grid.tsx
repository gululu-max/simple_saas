"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Flame, Wand2, Ghost } from "lucide-react";

const features = [
  {
    title: "AI Photo Enhancer",
    description: "Your best photo, made even better. Our AI retouches lighting, sharpens details, and elevates your look — so you always put your best face forward.",
    icon: <Wand2 className="w-6 h-6" />,
    link: "/dashboard/photo-enhancer"
  },
  {
    title: "AI Photo Scorer",
    description: "Not sure which photo to use? Our AI analyzes facial expressions, lighting, and composition to find your top performers — so you lead with your strongest shot.",
    icon: <Flame className="w-6 h-6" />,
    link: "/dashboard/photo-scorer"
  },
  {
    title: "Burn After Reading",
    description: "Your photos stay private. Every image you upload is permanently deleted from our servers the moment your session ends — no storage, no risk.",
    icon: <Ghost className="w-6 h-6" />,
    link: null
  },
];

export function FeaturesGrid() {
  return (
    <div className="grid md:grid-cols-3 gap-8">
      {features.map((feature, index) => {
        const card = (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-900 p-8 rounded-xl border border-slate-800 hover:border-red-500/50 transition-all h-full shadow-lg relative overflow-hidden"
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
            {feature.link && (
              <div className="mt-6 flex items-center text-sm font-medium text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                Try it now <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            )}
          </motion.div>
        );

        return feature.link ? (
          <Link href={feature.link} key={index} className="block group">
            {card}
          </Link>
        ) : (
          <div key={index} className="block">
            {card}
          </div>
        );
      })}
    </div>
  );
}