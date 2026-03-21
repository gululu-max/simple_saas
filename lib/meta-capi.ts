import crypto from "crypto";

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** Meta 强制要求对敏感信息进行 SHA256 加密 */
function hashData(data: string): string {
  if (!data) return "";
  return crypto.createHash("sha256").update(data.trim().toLowerCase()).digest("hex");
}

/** 获取环境变量，缺失时打印警告 */
function getEnvVars() {
  const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_CAPI_TOKEN;
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("Meta CAPI: Missing Pixel ID or Token in environment variables.");
    return null;
  }
  return { PIXEL_ID, ACCESS_TOKEN };
}

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

interface BaseEventOptions {
  userEmail?: string;
  eventId?: string;       // 用于前端 Pixel 去重（deduplication）
  testEventCode?: string; // 测试阶段使用，上线后删除
}

interface LeadEventOptions extends BaseEventOptions {
  contentName?: string;   // 例如："AI Photo boost Report"
}

interface PurchaseEventOptions extends BaseEventOptions {
  value: number;          // 订单金额，必填
  currency?: string;      // 默认 "USD"
  contentIds?: string[];  // 商品 ID 列表
}

// ─────────────────────────────────────────────
// 核心发送函数
// ─────────────────────────────────────────────

async function sendCAPIEvent(
  eventName: string,
  userData: Record<string, unknown>,
  customData?: Record<string, unknown>,
  options?: BaseEventOptions
) {
  const env = getEnvVars();
  if (!env) return;

  const { PIXEL_ID, ACCESS_TOKEN } = env;

  const eventPayload: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    user_data: userData,
    ...(options?.eventId && { event_id: options.eventId }),
    ...(customData && { custom_data: customData }),
  };

  const payload: Record<string, unknown> = {
    data: [eventPayload],
    ...(options?.testEventCode && { test_event_code: options.testEventCode }),
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

    if (!response.ok) {
      console.error(`[Meta CAPI] ❌ ${eventName} failed:`, result);
    } else {
      console.log(`[Meta CAPI] ✅ ${eventName} sent:`, result);
    }

    return result;
  } catch (error) {
    console.error(`[Meta CAPI] ❌ Network error for ${eventName}:`, error);
  }
}

// ─────────────────────────────────────────────
// 1. PageView — 基础流量（前端 MetaPixel 已覆盖，CAPI 作为备份）
// ─────────────────────────────────────────────

export async function sendPageViewEvent(options?: BaseEventOptions) {
  const userData = {
    ...(options?.userEmail && { em: [hashData(options.userEmail)] }),
  };

  return sendCAPIEvent("PageView", userData, undefined, options);
}

// ─────────────────────────────────────────────
// 2. CompleteRegistration — 用户注册完成
//    状态：已部署待验证 → 补全 eventId 用于去重
// ─────────────────────────────────────────────

export async function sendCompleteRegistrationEvent(
  userEmail: string,
  options?: BaseEventOptions
) {
  const userData = {
    em: [hashData(userEmail)],
  };

  const customData = {
    status: "completed",
  };

  return sendCAPIEvent("CompleteRegistration", userData, customData, options);
}

// ─────────────────────────────────────────────
// 3. Lead / Generate_boost — 用户真正使用 AI 跑了报告
//    这是你的核心深度转化事件
// ─────────────────────────────────────────────

export async function sendLeadEvent(
  userEmail: string,
  options?: LeadEventOptions
) {
  const userData = {
    em: [hashData(userEmail)],
  };

  const customData = {
    ...(options?.contentName && { content_name: options.contentName }),
  };

  // 同时发送标准 Lead 事件 + 自定义 Generate_boost 事件
  await Promise.all([
    sendCAPIEvent("Lead", userData, customData, options),
    sendCAPIEvent("Generate_boost", userData, customData, options),
  ]);
}

// ─────────────────────────────────────────────
// 4. Purchase — 商业变现，追踪谁付了钱
//    这是最核心的事件，算法会用它来找高价值用户
// ─────────────────────────────────────────────

export async function sendPurchaseEvent(
  userEmail: string,
  options: PurchaseEventOptions
) {
  const userData = {
    em: [hashData(userEmail)],
  };

  const customData = {
    value: options.value,
    currency: options.currency ?? "USD",
    ...(options.contentIds && {
      content_ids: options.contentIds,
      content_type: "product",
    }),
  };

  return sendCAPIEvent("Purchase", userData, customData, options);
}

// ─────────────────────────────────────────────
// 使用示例（可删除）
// ─────────────────────────────────────────────
//
// 用户注册后：
// await sendCompleteRegistrationEvent("user@example.com", {
//   eventId: "reg_" + userId,
//   testEventCode: "TEST12345",  // 测试阶段加，上线删
// });
//
// 用户点击生成报告后：
// await sendLeadEvent("user@example.com", {
//   contentName: "AI Photo boost Report",
//   eventId: "lead_" + userId,
// });
//
// 用户付款成功后（服务端调用）：
// await sendPurchaseEvent("user@example.com", {
//   value: 9.99,
//   currency: "USD",
//   contentIds: ["plan_pro"],
//   eventId: "purchase_" + orderId,
// });