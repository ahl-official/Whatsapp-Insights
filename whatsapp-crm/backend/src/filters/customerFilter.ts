import { callOpenRouter } from '../ai/openrouter';
import { callGemini } from '../ai/gemini';
import { prompts } from '../ai/prompts';

interface ClassificationResult {
  isCustomer: boolean;
  reason: string;
  classifier: 'openrouter' | 'gemini' | 'default';
}

export async function classifyChat(
  messages: string[],
  contactName: string
): Promise<ClassificationResult> {
  const transcript = messages.join('\n');
  const prompt = prompts.classifier(transcript, contactName);

  // Try OpenRouter first (primary)
  try {
    const result = await callOpenRouter(prompt, 300);
    return {
      isCustomer: result.isCustomer ?? true,
      reason:     result.reason ?? 'Classified by OpenRouter',
      classifier: 'openrouter',
    };
  } catch (err) {
    console.warn('[Classifier] OpenRouter failed, trying Gemini:', err);
  }

  // Gemini fallback
  try {
    const result = await callGemini(prompt, 300);
    return {
      isCustomer: result.isCustomer ?? true,
      reason:     result.reason ?? 'Classified by Gemini',
      classifier: 'gemini',
    };
  } catch (err) {
    console.error('[Classifier] Both AI providers failed:', err);
  }

  // Safe default — never silently drop a chat
  return {
    isCustomer: true,
    reason:     'Classification failed — defaulted to customer to avoid data loss',
    classifier: 'default',
  };
}
