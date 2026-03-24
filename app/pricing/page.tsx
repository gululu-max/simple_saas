import { PriceComparisonSection } from "@/components/price-comparison-section";
import { PricingSection } from "@/components/pricing-section";

export const metadata = {
  title: "Pricing — Matchfix",
  description: "Simple, affordable plans to boost your dating profile.",
};

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50 selection:bg-red-500/30">

      {/* Page Header */}
      <section className="relative pt-20 pb-4 text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-600/10 rounded-full blur-[100px] -z-10" />
        <div className="container px-4 md:px-6">
          <div className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 mb-4">
            Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-4">
            Invest in Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
              Dating Life
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            One-time or subscription — pick what works for you. No hidden fees.
          </p>
        </div>
      </section>

      {/* Price Comparison */}
      <PriceComparisonSection />

      {/* Pricing Plans */}
      <div className="bg-slate-950 pb-16 pt-0">
        <PricingSection />
      </div>

    </div>
  );
}