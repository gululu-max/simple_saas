// lib/google-ads-conversion.ts

const GA_MEASUREMENT_ID = "G-0SVH6XDETV";
const GA_API_SECRET = process.env.GA_API_SECRET || "";

export async function sendGooglePurchaseEvent(params: {
  clientId: string;
  transactionId: string;
  value: number;
  currency: string;
  items?: Array<{ item_id: string; item_name: string; price: number }>;
}) {
  if (!GA_API_SECRET) {
    console.warn("⚠️ GA_API_SECRET 未配置，跳过 Google 转化上报");
    return;
  }

  const payload = {
    client_id: params.clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: params.transactionId,
          value: params.value,
          currency: params.currency,
          items: params.items || [],
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    console.log(`✅ Google purchase 事件已发送 (status: ${res.status})`);
  } catch (error) {
    console.error("❌ Google 转化上报失败:", error);
  }
}