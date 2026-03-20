"use client";

import { useEffect } from "react";

export function ViewPricingTracker() {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'view_item_list', {
        ecommerce: {
          item_list_id: "pricing_page",
          item_list_name: "Matchfix Pricing Plans",
          items: [
            { item_id: "sub_monthly", item_name: "Pro Monthly", item_category: "subscription", price: 9.99 },
            { item_id: "credits_100", item_name: "100 Credits", item_category: "one_time", price: 4.99 }
          ]
        }
      });
    }
  }, []);

  return null;
}