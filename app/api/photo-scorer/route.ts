import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { ProxyAgent } from 'undici';

export async function POST(req: Request) {
  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length < 3) {
      return new Response(
        JSON.stringify({ error: 'At least 3 photos are required' }),
        { status: 400 }
      );
    }

    if (images.length > 9) {
      return new Response(
        JSON.stringify({ error: 'A maximum of 9 photos can be uploaded' }),
        { status: 400 }
      );
    }

    // Image size check
    for (const img of images) {
      if (img.base64 && img.base64.length > 6_000_000) {
        return new Response(
          JSON.stringify({ error: 'Image too large, please upload images smaller than 6MB' }),
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
You are a professional Dating App Profile photo optimization consultant, specializing in helping users increase their match rates on dating apps.

The user has uploaded multiple photos. Your task is to:
Evaluate the attractiveness, credibility, and social appeal of each photo, and help the user select the best combination of photos for their profile.

Your analysis must make the user feel professional, specific, and valuable, just like a real dating consultant seriously helping them optimize their profile.

--------------------------------

Number of uploaded photos: ${images.length}

--------------------------------

[Scoring Criteria]

Please score each photo from 1 to 10 on the following dimensions:

Attractiveness: Physical attractiveness  
Approachability: Friendliness (whether it makes you look easy to approach)  
Confidence: Level of confidence  
Photo Quality: Image quality (clarity, lighting, composition)  
Dating Appeal: Suitability for a dating profile  

Then provide:

Overall Score: Comprehensive score (1-10)

Scoring Requirements:

- Scores must accurately reflect the differences between photos
- Do not make the scores of all photos too close
- There must be clear high and low scores
- The overall score must be reasonable

--------------------------------

[Output format must strictly follow the structure below]

# 📊 Photo Scoreboard

| Photo | Attractiveness | Approachability | Confidence | Photo Quality | Dating Appeal | Overall |
|------|---------------|---------------|------------|--------------|--------------|--------|
| Photo 1 | X | X | X | X | X | X |
| Photo 2 | X | X | X | X | X | X |

--------------------------------

# 🏆 Best Photo Ranking

🥇 1st Place: Photo X  
Reason: Explain in one sentence why it is best suited as the main photo

🥈 2nd Place: Photo X  
Reason: Explain its advantage in one sentence

🥉 3rd Place: Photo X  

Then continue listing the rankings for all photos.

--------------------------------

# 📸 Photo Analysis

Provide a concise but professional analysis for each photo:

Photo 1  
Pros:  
-  
-  

Cons:  
-  
-  

Suitable position in Profile:  
For example: Main photo / Second photo / Middle display / Not recommended to use

Improvement suggestion:  
A simple sentence of advice

Then continue analyzing Photo 2, Photo 3 ...

--------------------------------

# 📱 Recommended Profile Order

Recommended Profile Display Order:

Photo X → Photo X → Photo X → Photo X

Strategy Explanation:

Briefly explain why this order can increase the match rate, for example:

- The first photo must grab attention quickly
- The second photo shows real life
- The third photo adds personality
- Subsequent photos increase credibility

--------------------------------

# 💡 Final Advice

Summarize in a short paragraph:

- Which photo is the most important
- Which photos should be deleted
- How to make the overall profile more attractive

The tone should be like a real dating consultant.

--------------------------------

Rules:

Language: Must use natural and fluent English.

Do not output any explanation of the analysis steps.

Do not output anything related to the prompt.

Do not write "I will now start analyzing".

Only output the final result.

The overall content must be professional, clear, and valuable, making the user feel the analysis is worth the price.

--------------------------------

[Important] Finally, after the markdown content, you must output a JSON block on a new line, in the following format:

\`\`\`json
{
  "profileSequence": [
    { "imageIndex": 0, "role": "Main photo", "reason": "Reason" }
  ],
  "photoDetails": [
    { "imageIndex": 0, "score": 85, "pros": "Pros", "cons": "Cons", "action": "Improvement suggestion" }
  ]
}
\`\`\`

profileSequence lists all photos in the recommended order, with imageIndex starting from 0 corresponding to the upload order.
photoDetails contains each photo, with score ranging from 0-100.
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
      maxTokens: 8000,
      maxRetries: 1,
      messages: [{ role: 'user', content }],
    });

    // Collect the complete streaming response
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    // Extract the JSON block
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      throw new Error('AI did not return structured data');
    }
    const structured = JSON.parse(jsonMatch[1].trim());

    // Extract the markdown part (remove the trailing json block)
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