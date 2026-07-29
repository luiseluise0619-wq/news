import { generateText as aiGenerateText, generateObject as aiGenerateObject, LanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

function getProvider(): LanguageModel {
  const providerName = process.env.LLM_PROVIDER || 'openai';

  if (providerName === 'gemini') {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.warn('GOOGLE_GENERATIVE_AI_API_KEY not set, falling back to openai if available');
    } else {
      return google('gemini-2.5-flash');
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set. Will throw error on generation unless mocked.');
  }

  return openai('gpt-4o-mini');
}

export async function generateText(prompt: string, system?: string): Promise<string> {
  const model = getProvider();

  try {
    const { text } = await aiGenerateText({
      model,
      prompt,
      system,
    });
    return text;
  } catch (error) {
    console.error('Error generating text:', error);
    // Fallback/dummy response
    return `[Fallback text due to AI error: ${(error as Error).message}]`;
  }
}

export async function generateObject<T>(prompt: string, schema: z.Schema<T>, system?: string): Promise<T | null> {
  const model = getProvider();

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
