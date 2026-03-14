"use client";

import { useEffect } from "react";
import { sendGAEvent } from "@next/third-parties/google";

export function ViewPricingTracker() {
  useEffect(() => {
    // 页面加载完成时触发标准的 view_item_list
    sendGAEvent("event", "view_item_list", {
      ecommerce: {
        item_list_id: "pricing_page",
        item_list_name: "Matchfix Pricing Plans",
        // 这里可以枚举你展示的所有商品，帮助后续归因
        items: [
          { item_id: "sub_monthly", item_name: "Pro Monthly", item_category: "subscription", price: 9.99 },
          { item_id: "credits_100", item_name: "100 Credits", item_category: "one_time", price: 4.99 }
        ]
      }
    });
  }, []);

  return null; // 隐形探针，不渲染任何 DOM
}
