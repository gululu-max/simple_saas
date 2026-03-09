import { ProductTier } from "@/types/subscriptions";

export const SUBSCRIPTION_TIERS: ProductTier[] = [
  {
    name: "Starter",
    id: "tier-starter",
    productId: "prod_xxxxxx_starter", // 替换为真实的支付网关 Product ID
    priceMonthly: "$6.99",
    description: "Quickly diagnose what’s hurting your dating profile and fix your worst photos.",
    features: [
      "40 Credits per month",
      "Analyze up to 8 photos with AI",
      "Rank your best photos for dating apps",
      "Find red flags hurting your match rate",
      "Access to Matchfix Scanner",
      "Access to AI Photo Scorer",
    ],
    featured: false,
    discountCode: "",
  },
  {
    name: "Pro",
    id: "tier-pro",
    productId: "prod_xxxxxx_pro", // 替换为真实的支付网关 Product ID
    priceMonthly: "$19.99",
    description: "Optimize your entire dating profile and dramatically increase your swipe-right rate.",
    features: [
      "200 Credits per month",
      "Analyze up to 40 photos with AI",
      "Find your highest-performing dating photos",
      "Spot hidden profile red flags instantly",
      "Perfect for testing multiple photo combinations",
      "Access to Matchfix Scanner",
      "Access to AI Photo Scorer",
    ],
    featured: true,
    discountCode: "",
  },
  {
    name: "Ultra",
    id: "tier-ultra",
    productId: "prod_xxxxxx_ultra", // 替换为真实的支付网关 Product ID
    priceMonthly: "$39.99",
    description: "Built for power users who constantly test and optimize dating profiles.",
    features: [
      "500 Credits per month",
      "Analyze up to 100 photos with AI",
      "Bulk photo scoring and ranking",
      "Ideal for A/B testing dating photos",
      "Perfect for dating coaches and profile reviews",
      "Access to Matchfix Scanner",
      "Access to AI Photo Scorer",
    ],
    featured: false,
    discountCode: "",
  },
];

export const CREDITS_TIERS: ProductTier[] = [
  {
    name: "Basic Pack",
    id: "pack-25-credits",
    productId: "prod_xxxxxx_basic_pack", // 替换为真实的支付网关 Product ID
    priceMonthly: "$5", 
    description: "Quickly test how your dating photos perform.",
    creditAmount: 25,
    features: [
      "25 Credits",
      "Score up to 5 photos",
      "Rank your best dating pictures",
      "Credits never expire",
      "Full access to Matchfix tools"
    ],
    featured: false,
    discountCode: "",
  },
  {
    name: "Value Pack",
    id: "pack-100-credits",
    productId: "prod_xxxxxx_value_pack", // 替换为真实的支付网关 Product ID
    priceMonthly: "$12",
    description: "The most popular choice for fully optimizing your dating profile.",
    creditAmount: 100,
    features: [
      "100 Credits",
      "Score up to 20 photos",
      "Find your best-performing dating pictures",
      "Credits never expire",
      "Full access to Matchfix tools"
    ],
    featured: true,
    discountCode: "",
  },
  {
    name: "Pro Pack",
    id: "pack-300-credits",
    productId: "prod_xxxxxx_pro_pack", // 替换为真实的支付网关 Product ID
    priceMonthly: "$25",
    description: "Best value for continuous profile testing and optimization.",
    creditAmount: 300,
    features: [
      "300 Credits",
      "Score up to 60 photos",
      "Perfect for testing multiple photo combinations",
      "Credits never expire",
      "Full access to Matchfix tools"
    ],
    featured: false,
    discountCode: "",
  },
];