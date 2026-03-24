import { X, Check } from "lucide-react";

const comparisons = [
  {
    title: "Bad Dates",
    price: "$100+",
    highlight: false,
    badge: null,
    items: [
      { ok: false, text: "Wasted weekends" },
      { ok: false, text: "Zero feedback" },
    ],
  },
  {
    title: "Dating Coach",
    price: "$200/hr",
    highlight: false,
    badge: null,
    items: [
      { ok: false, text: "Expensive" },
      { ok: false, text: "Sugarcoated advice" },
    ],
  },
  {
    title: "Matchfix AI",
    price: "From $6.99",
    highlight: true,
    badge: "SMART CHOICE",
    items: [
      { ok: true, text: "Brutally honest" },
      { ok: true, text: "Instant results" },
    ],
  },
];

export function PriceComparisonSection() {
  return (
    <section className="py-20">
      <div className="container px-4 md:px-6 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-12 text-slate-50">
          100X Cheaper Than Remaining Single.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {comparisons.map((plan) =>
            plan.highlight ? (
              <div
                key={plan.title}
                className="p-6 rounded-xl border border-red-500 bg-red-950/20 shadow-[0_0_30px_rgba(220,38,38,0.15)] relative transform md:-translate-y-2"
              >
                {plan.badge && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                    {plan.badge}
                  </div>
                )}
                <h4 className="font-bold text-red-400 mb-2">{plan.title}</h4>
                <div className="text-2xl font-bold text-white mb-4">{plan.price}</div>
                {plan.items.map((item) => (
                  <div key={item.text} className="flex items-center gap-2 text-sm text-slate-300 mt-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    {item.text}
                  </div>
                ))}
              </div>
            ) : (
              <div
                key={plan.title}
                className="p-6 rounded-xl border border-slate-800 bg-slate-900 opacity-70"
              >
                <h4 className="font-bold text-slate-300 mb-2">{plan.title}</h4>
                <div className="text-2xl font-bold text-slate-50 mb-4">{plan.price}</div>
                {plan.items.map((item) => (
                  <div key={item.text} className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                    <X className="w-4 h-4 text-red-500 shrink-0" />
                    {item.text}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}