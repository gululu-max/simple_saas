// ═══════════════════════════════════════════════════════════════
// utils/parseAnalysisStream.ts — v3
// 直接覆盖现有文件
//
// 新 prompt 是纯 JSON 输出（不再有 <analysis_json> 标签和自然段混排）。
// 本函数职责：
//   - 完整响应：解析 JSON，从 copy 字段拼出 visibleText 给前端展示
//   - 流式中途：尽量从未完成的 JSON 里提取已经闭合的 copy 字段
// ═══════════════════════════════════════════════════════════════

interface CopyFields {
  headline?: string;
  one_liner_positive?: string | null;
  one_liner_issue?: string | null;
  first_impression?: string | null;
  cta?: string;
}

/**
 * 从已解析的 JSON 对象的 copy 字段拼出自然段文本
 */
function buildVisibleTextFromCopy(copy: CopyFields | undefined | null): string {
  if (!copy) return '';
  const parts = [
    copy.headline,
    copy.one_liner_positive,
    copy.one_liner_issue,
    copy.first_impression,
    copy.cta,
  ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  return parts.join('\n\n');
}

/**
 * 流式中途，用正则提取已经闭合的字符串字段
 * 只匹配 "field": "...完整闭合的字符串..."
 */
function extractPartialCopy(raw: string): string {
  const fields = [
    'headline',
    'one_liner_positive',
    'one_liner_issue',
    'first_impression',
    'cta',
  ];
  const parts: string[] = [];
  for (const f of fields) {
    // 匹配已闭合的字符串（处理转义引号）
    const re = new RegExp(`"${f}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
    const m = raw.match(re);
    if (m && m[1]) {
      // 还原常见转义
      const unescaped = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      parts.push(unescaped);
    }
  }
  return parts.join('\n\n');
}

/**
 * 剥除可能的 markdown 代码围栏（防御性 — prompt 明确禁止但模型偶尔会出）
 */
function stripMarkdownFences(s: string): string {
  let cleaned = s.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

export function parseAnalysisStream(raw: string): {
  visibleText: string;
  analysisJSON: string | null;
} {
  if (!raw || !raw.trim()) {
    return { visibleText: '', analysisJSON: null };
  }

  const cleaned = stripMarkdownFences(raw);

  // 尝试解析完整 JSON
  try {
    const parsed = JSON.parse(cleaned);
    const visibleText = buildVisibleTextFromCopy(parsed?.copy);
    return {
      visibleText,
      analysisJSON: JSON.stringify(parsed),
    };
  } catch {
    // 流式中途：JSON 还没收完，尽量提取已闭合的 copy 字段
    const partialText = extractPartialCopy(cleaned);
    return {
      visibleText: partialText,
      analysisJSON: null,
    };
  }
}