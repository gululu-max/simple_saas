import { ProductTier } from "@/types/subscriptions";

// ─── Product IDs from env ────────────────────────────────
// 切环境只需要改 .env，不用动代码
const PRODUCT_IDS = {
  STARTER:      process.env.NEXT_PUBLIC_PRODUCT_ID_STARTER!,
  PRO:          process.env.NEXT_PUBLIC_PRODUCT_ID_PRO!,
  ULTRA:        process.env.NEXT_PUBLIC_PRODUCT_ID_ULTRA!,
  PACK_STARTER: process.env.NEXT_PUBLIC_PRODUCT_ID_PACK_STARTER!,
  PACK_VALUE:   process.env.NEXT_PUBLIC_PRODUCT_ID_PACK_VALUE!,
  PACK_PRO:     process.env.NEXT_PUBLIC_PRODUCT_ID_PACK_PRO!,
};

// Pricing model:
//   Each "enhancement" generates 3 different scene variations to choose from.
//   Subscribers pay 25 credits per enhancement.
//   Non-subscribers (credit-pack only) pay 40 credits per enhancement.
//
// Tier credit allocations are unchanged from launch — the copy below
// reflects how those credits map to the new 3-variant model.
export const SUBSCRIPTION_TIERS: ProductTier[] = [
  {
    name: "Starter",
    id: "tier-starter",
    productId: PRODUCT_IDS.STARTER,
    priceMonthly: "$6.99",
    description: "Try the full experience — perfect for fixing one standout photo.",
    features: [
      "40 Credits per month",
      "1 photo enhancement (3 scene options)",
      "Unlimited watermark-free downloads",
      "AI photo analysis included free",
      "Credits never expire",
    ],
    featured: false,
    discountCode: "",
  },
  {
    name: "Pro",
    id: "tier-pro",
    productId: PRODUCT_IDS.PRO,
    priceMonthly: "$19.99",
    description: "Optimize your entire profile — the #1 choice for serious daters.",
    features: [
      "200 Credits per month",
      "8 photo enhancements (3 scenes each)",
      "Unlimited watermark-free downloads",
      "AI photo analysis included free",
      "Save $1.50/enhancement vs credit packs",
      "Credits never expire",
    ],
    featured: true,
    discountCode: "",
  },
  {
    name: "Ultra",
    id: "tier-ultra",
    productId: PRODUCT_IDS.ULTRA,
    priceMonthly: "$39.99",
    description: "For power users, dating coaches, and profile makeover pros.",
    features: [
      "500 Credits per month",
      "20 photo enhancements (3 scenes each)",
      "Unlimited watermark-free downloads",
      "AI photo analysis included free",
      "Best per-enhancement value",
      "Credits never expire",
    ],
    featured: false,
    discountCode: "",
  },
];

export const CREDITS_TIERS: ProductTier[] = [
  {
    name: "Starter Pack",
    id: "pack-75-credits",
    productId: PRODUCT_IDS.PACK_STARTER,
    priceMonthly: "$9.99",
    description: "One-shot top-up — enough for a single 3-scene enhancement.",
    creditAmount: 75,
    features: [
      "75 Credits",
      "1 photo enhancement (3 scene options)",
      "Watermark-free downloads included",
      "Credits never expire",
    ],
    featured: false,
    discountCode: "",
  },
  {
    name: "Value Pack",
    id: "pack-200-credits",
    productId: PRODUCT_IDS.PACK_VALUE,
    priceMonthly: "$19.99",
    description: "Best seller — revamp your entire dating profile.",
    creditAmount: 200,
    features: [
      "200 Credits",
      "5 photo enhancements (3 scenes each)",
      "Watermark-free downloads included",
      "Credits never expire",
    ],
    featured: true,
    discountCode: "",
  },
  {
    name: "Pro Pack",
    id: "pack-500-credits",
    productId: PRODUCT_IDS.PACK_PRO,
    priceMonthly: "$39.99",
    description: "Maximum value — test every angle, every outfit, every look.",
    creditAmount: 500,
    features: [
      "500 Credits",
      "12 photo enhancements (3 scenes each)",
      "Watermark-free downloads included",
      "Lowest cost per enhancement",
      "Credits never expire",
    ],
    featured: false,
    discountCode: "",
  },
];