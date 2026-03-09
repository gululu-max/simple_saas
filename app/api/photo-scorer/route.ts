import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { ProxyAgent } from 'undici';

export async function POST(req: Request) {
  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length < 3) {
      return new Response(
        JSON.stringify({ error: '至少需要提供3张照片' }),
        { status: 400 }
      );
    }

    if (images.length > 9) {
      return new Response(
        JSON.stringify({ error: '最多只能上传9张照片' }),
        { status: 400 }
      );
    }

    // 图片大小检查
    for (const img of images) {
      if (img.base64 && img.base64.length > 6_000_000) {
        return new Response(
          JSON.stringify({ error: '图片过大，请上传小于6MB的图片' }),
          { status: 413 }
        );
      }
    }

    let fetchOptions: any = {};

    if (process.env.NODE_ENV === 'development') {
      const proxyUrl =
        process.env.HTTP_PROXY ||
        process.env.HTTPS_PROXY ||
        'http://127.0.0.1:10808';

      console.log('🚀 Dev mode proxy:', proxyUrl);

      const agent = new ProxyAgent(proxyUrl);
      fetchOptions = { dispatcher: agent };
    }

    const googleCustom = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      fetch: (url: any, options: any) =>
        fetch(url, { ...options, ...fetchOptions }),
    });

    // =========================
    //  HIGH VALUE PROMPT
    // =========================

    const userPrompt = `
你是一位专业的 Dating App Profile 照片优化顾问，专门帮助用户在交友软件上提升匹配率。

用户上传了多张照片，你的任务是：
评估每一张照片的吸引力、可信度、社交吸引力，并帮助用户选出最适合放在 Profile 的照片组合。

你的分析必须让用户感觉专业、具体、有价值，就像一个真实的约会顾问在认真帮他优化个人资料。

--------------------------------

用户上传照片数量：${images.length}张

--------------------------------

【评分标准】

请对每张照片从以下维度评分（1-10）：

Attractiveness：外在吸引力  
Approachability：亲和力（是否让人觉得容易接近）  
Confidence：自信度  
Photo Quality：照片质量（清晰度、光线、构图）  
Dating Appeal：约会吸引力（是否适合作为 dating profile）  

然后给出：

Overall Score：综合评分（1-10）

评分要求：

- 分数必须真实反映照片差异
- 不要让所有照片评分非常接近
- 至少有明显的高分和低分
- 综合评分要合理

--------------------------------

【输出格式必须严格按照下面结构】

# 📊 Photo Scoreboard

| Photo | Attractiveness | Approachability | Confidence | Photo Quality | Dating Appeal | Overall |
|------|---------------|---------------|------------|--------------|--------------|--------|
| Photo 1 | X | X | X | X | X | X |
| Photo 2 | X | X | X | X | X | X |

--------------------------------

# 🏆 Best Photo Ranking

🥇 第1名：Photo X  
原因：一句话说明为什么最适合做主照片

🥈 第2名：Photo X  
原因：一句话说明优点

🥉 第3名：Photo X  

然后继续列出所有照片排名。

--------------------------------

# 📸 Photo Analysis

对每张照片进行简洁但专业的分析：

Photo 1  
优点：  
-  
-  

问题：  
-  
-  

适合放在Profile的位置：  
例如：主照片 / 第二张 / 中间展示 / 不建议使用

改进建议：  
一句简单建议

然后继续分析 Photo 2, Photo 3 ...

--------------------------------

# 📱 Recommended Profile Order

推荐的Profile展示顺序：

Photo X → Photo X → Photo X → Photo X

策略说明：

简要解释这个顺序为什么能提升匹配率，例如：

- 第一张必须快速吸引注意
- 第二张展示真实生活
- 第三张增加个性
- 后面照片增加可信度

--------------------------------

# 💡 Final Advice

用一个简短段落总结：

- 哪张照片最重要
- 哪些照片应该删除
- 如何让整体Profile更有吸引力

语气要像真实约会顾问。

--------------------------------

规则：

语言：必须使用自然流畅的中文。

不要输出任何分析步骤说明。

不要输出提示词相关内容。

不要写"我现在开始分析"。

只输出最终结果。

整体内容要专业、清晰、有价值，让用户觉得这份分析物超所值。

--------------------------------

【重要】最终在markdown内容之后，必须另起一行输出一个JSON块，格式如下：

\`\`\`json
{
  "profileSequence": [
    { "imageIndex": 0, "role": "主照片", "reason": "原因" }
  ],
  "photoDetails": [
    { "imageIndex": 0, "score": 85, "pros": "优点", "cons": "问题", "action": "改进建议" }
  ]
}
\`\`\`

profileSequence 按推荐顺序列出所有照片，imageIndex 从0开始对应上传顺序。
photoDetails 包含每张照片，score 为0-100分。
`;

    const content: any[] = [{ type: 'text', text: userPrompt }];

    for (const img of images) {
      content.push({
        type: 'image',
        image: img.base64,
        mimeType: img.mimeType || 'image/jpeg',
      });
    }

    const result = await streamText({
      model: googleCustom('gemini-2.5-flash') as any,
      temperature: 0.7,
      maxTokens: 4000,
      maxRetries: 1,
      messages: [{ role: 'user', content }],
    });

    // 收集完整流式响应
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    // 提取 JSON 块
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      throw new Error('AI 未返回结构化数据');
    }
    const structured = JSON.parse(jsonMatch[1].trim());

    // 提取 markdown 部分（去掉最后的 json 块）
    const markdownText = fullText.replace(/```json[\s\S]*?```/, '').trim();

    return new Response(
      JSON.stringify({ ...structured, markdownText }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in photo-scorer API:', error);

    const err = error as any;

    return new Response(
      JSON.stringify({
        error: err.message || 'Internal Server Error',
        details: 'Check server logs',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}