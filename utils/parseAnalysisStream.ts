/**
 * parseAnalysisStream
 * 
 * scanner API 的流式输出末尾会附带一个隐藏的 <analysis_json> 块。
 * 本函数将完整响应文本拆分为：
 *   - visibleText：展示给用户的分析内容
 *   - analysisJSON：结构化数据字符串，传给 enhance 接口
 * 
 * 用法（在流结束后调用）：
 * 
 *   const { visibleText, analysisJSON } = parseAnalysisStream(fullStreamText);
 *   setDisplayText(visibleText);
 *   setAnalysisResult(analysisJSON); // 传给 /api/enhance-photo
 */
export function parseAnalysisStream(raw: string): {
    visibleText: string;
    analysisJSON: string | null;
  } {
    const match = raw.match(/<analysis_json>([\s\S]*?)<\/analysis_json>/);
  
    if (!match) {
      return { visibleText: raw.trim(), analysisJSON: null };
    }
  
    const jsonString = match[1].trim();
    const visibleText = raw.replace(match[0], '').trim();
  
    // 验证 JSON 合法性，非法则 fallback 到 null
    try {
      JSON.parse(jsonString);
      return { visibleText, analysisJSON: jsonString };
    } catch {
      console.warn('analysis_json parse failed, falling back to null');
      return { visibleText, analysisJSON: null };
    }
  }