import crypto from "crypto";

// 辅助函数：Meta 强制要求对敏感信息（Email）进行 SHA256 加密
function hashData(data: string) {
  if (!data) return "";
  return crypto.createHash("sha256").update(data.trim().toLowerCase()).digest("hex");
}

export async function sendMetaCAPIEvent(eventName: string, userEmail: string) {
  const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("Meta CAPI: Missing Pixel ID or Token in environment variables.");
    return;
  }

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000), // Unix 时间戳 (秒)
        action_source: "website",
        user_data: {
          em: [hashData(userEmail)], // 加密后的邮箱，这是精准匹配的核心！
        },
      },
    ],
    // 👇 这是我们刚刚加进去的测试码，注意它是和 data 平级的！
    test_event_code: "TEST24799", 
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();
    console.log(`[Meta CAPI] Event ${eventName} sent successfully:`, result);
  } catch (error) {
    console.error(`[Meta CAPI] Error sending ${eventName}:`, error);
  }
}