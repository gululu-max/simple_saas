// ═══════════════════════════════════════════════════════════════
// utils/parseAnalysisStream.ts
// 直接覆盖现有文件
// ═══════════════════════════════════════════════════════════════

/**
 * parseAnalysisStream
 *
 * scanner API 的流式输出末尾会附带一个隐藏的 <analysis_json> 块。
 * 本函数将完整响应文本拆分为：
 *   - visibleText：展示给用户的分析内容
 *   - analysisJSON：结构化数据字符串，传给 enhance 接口
 *
 * 修复：流式过程中 JSON 标签的开头会被当成可见文本显示，
 * 现在会检测并截掉 <analysis_json 的部分片段。
 */
export function parseAnalysisStream(raw: string): {
  visibleText: string;
  analysisJSON: string | null;
} {
  // 完整匹配：流式结束后的正常路径
  const match = raw.match(/<analysis_json>([\s\S]*?)<\/analysis_json>/);

  if (match) {
    const jsonString = match[1].trim();
    const visibleText = raw.replace(match[0], '').trim();

    try {
      JSON.parse(jsonString);
      return { visibleText, analysisJSON: jsonString };
    } catch {
      console.warn('analysis_json parse failed, falling back to null');
      return { visibleText, analysisJSON: null };
    }
  }

  // 流式过程中：检测不完整的 <analysis_json 标签片段并截掉
  // 这防止了用户在流式过程中看到 "<analysis_json" 或 "<analysis_js" 等碎片
  const partialTagPattern = /<a(?:n(?:a(?:l(?:y(?:s(?:i(?:s(?:_(?:j(?:s(?:o(?:n)?)?)?)?)?)?)?)?)?)?)?)?$/i;
  let cleaned = raw;

  // 也处理已经有 <analysis_json> 开头但还没闭合的情况
  const openTagIndex = raw.indexOf('<analysis_json>');
  if (openTagIndex !== -1) {
    // 有开标签但没闭合标签，说明还在流式传输JSON内容
    cleaned = raw.substring(0, openTagIndex);
  } else {
    // 检查部分标签片段
    const partialMatch = cleaned.match(partialTagPattern);
    if (partialMatch) {
      cleaned = cleaned.substring(0, partialMatch.index);
    }

    // 也检查 "---" 分隔符后面的内容（prompt里JSON前有 "---"）
    // 如果最后一行只有 "---" 或者 "---\n<ana..."，截掉
    const lastDashIndex = cleaned.lastIndexOf('\n---');
    if (lastDashIndex !== -1) {
      const afterDash = cleaned.substring(lastDashIndex + 4).trim();
      // 如果 "---" 后面没有有意义的文字（空或只有标签碎片），截掉
      if (afterDash.length === 0 || afterDash.startsWith('<')) {
        cleaned = cleaned.substring(0, lastDashIndex);
      }
    }
  }

  return { visibleText: cleaned.trim(), analysisJSON: null };
}