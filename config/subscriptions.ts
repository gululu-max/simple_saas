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

export const SUBSCRIPTION_TIERS: ProductTier[] = [
  {
    name: "Starter",
    id: "tier-starter",
    productId: PRODUCT_IDS.STARTER,
    priceMonthly: "$6.99",
    description: "Fix your worst photos and start getting more matches.",
    features: [
      "40 Credits per month",
      "Enhance up to 2 photos with AI",
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
      "Enhance up to 10 photos with AI",
      "Unlimited watermark-free downloads",
      "AI photo analysis included free",
      "Save $1.50/photo vs credit packs",
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
      "Enhance up to 25 photos with AI",
      "Unlimited watermark-free downloads",
      "AI photo analysis included free",
      "Best per-photo value",
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
    description: "Try it out — enough for 3 full photo enhancements.",
    creditAmount: 75,
    features: [
      "75 Credits",
      "Enhance up to 3 photos",
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
      "Enhance up to 8 photos",
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
      "Enhance up to 20 photos",
      "Watermark-free downloads included",
      "Lowest cost per photo",
      "Credits never expire",
    ],
    featured: false,
    discountCode: "",
  },
];