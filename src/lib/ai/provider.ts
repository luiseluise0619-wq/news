import { generateText as aiGenerateText, generateObject as aiGenerateObject, LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

// Accept the common env-var spellings people actually use, not just the exact
// name each SDK expects by default. A Gemini key set as GEMINI_API_KEY would
// otherwise be ignored and the app would silently fall back to mock output.
const geminiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

const openaiKey = process.env.OPENAI_API_KEY;

function getProvider(): LanguageModel | null {
  const hasGemini = !!geminiKey;
  const hasOpenAI = !!openaiKey;

  // Respect an explicit choice, but otherwise auto-detect from whichever key
  // is present. This avoids the common trap where a Gemini key is set but
  // LLM_PROVIDER is not, silently falling back to mock ("테스트 모드") output.
  const providerName =
    process.env.LLM_PROVIDER || (hasGemini ? 'gemini' : 'openai');

  if (providerName === 'gemini') {
    if (!hasGemini) {
      console.warn('LLM_PROVIDER=gemini but no Gemini API key found (GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY)');
      return null;
    }
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return google('gemini-2.5-flash');
  }

  if (!hasOpenAI) {
    console.warn('No LLM API key found — set GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) for Gemini, or OPENAI_API_KEY for OpenAI');
    return null;
  }

  const openai = createOpenAI({ apiKey: openaiKey });
  return openai('gpt-4o-mini');
}

export async function generateText(prompt: string, system?: string): Promise<string> {
  const model = getProvider();

  if (!model) {
    console.log("Using MOCK generateText because no API key is provided.");
    return `[AI API 키가 설정되지 않아 임시 생성된 텍스트입니다.]\n\n이 텍스트는 Vercel 환경변수에 OPENAI_API_KEY 또는 GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았을 때 표시됩니다.`;
  }

  try {
    const { text } = await aiGenerateText({
      model,
      prompt,
      system,
    });
    return text;
  } catch (error) {
    console.error('Error generating text:', error);
    return `[Fallback text due to AI error: ${(error as Error).message}]`;
  }
}

export async function generateObject<T>(prompt: string, schema: z.Schema<T>, system?: string): Promise<T | null> {
  const model = getProvider();

  if (!model) {
    console.log("Using MOCK generateObject because no API key is provided.");
    // Determine what to mock based on prompt
    if (prompt.includes('Group the following')) {
      // Mock clustering
      try {
        const jsonStr = prompt.split('Articles:\n')[1].split('\n\nReturn')[0];
        const articles = JSON.parse(jsonStr);
        const clusters = [];
        // Group every 2 articles
        for (let i = 0; i < articles.length; i += 2) {
          clusters.push({
            theme: `[테스트 뉴스 클러스터] ${articles[i].title}`,
            articleIds: articles.slice(i, i+2).map((a: any) => a.id)
          });
        }
        return { clusters } as any;
      } catch (e) {
        return { clusters: [] } as any;
      }
    }

    if (prompt.includes('Evaluate the importance')) {
      return { score: Math.floor(Math.random() * 5) + 5 } as any; // 5~9
    }

    if (prompt.includes('Summarize the following')) {
      return {
        what: "테스트 모드: 여러 기사에서 주요 사건이 보고되었습니다.",
        why: "테스트 모드: 이 사건은 향후 산업 및 사회에 여러 영향을 미칠 것으로 분석됩니다.",
        future: "테스트 모드: 추가적인 뉴스 업데이트를 통해 후속 상황을 지켜보아야 합니다."
      } as any;
    }

    if (prompt.includes('Extract paper details')) {
      return {
        coreFinding: "테스트 모드: 새로운 방법론이 기존 모델보다 우수함을 증명했습니다.",
        importance: "테스트 모드: 학계에 새로운 연구 방향을 제시합니다.",
        limitations: "명시되지 않음",
        importanceScore: 8,
        field: "AI/컴퓨터공학",
        authors: "Test Author et al.",
        institution: "Test University"
      } as any;
    }

    return null;
  }

  try {
    const { object } = await aiGenerateObject({
      model,
      prompt,
      system,
      schema,
    });
    return object;
  } catch (error) {
    console.error('Error generating object:', error);
    return null;
  }
}
