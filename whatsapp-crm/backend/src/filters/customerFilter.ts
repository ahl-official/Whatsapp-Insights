import { callGroq } from '../ai/groq';
import { callGemini } from '../ai/gemini';
import { prompts } from '../ai/prompts';

interface ClassificationResult {
  isCustomer: boolean;
  reason: string;
  classifier: 'groq' | 'gemini' | 'default';
}

export async function classifyChat(
  messages: string[],
  contactName: string
): Promise<ClassificationResult> {
  const transcript = messages.join('\n');
  const prompt = prompts.classifier(transcript, contactName);

  // Try Groq first
  try {
    const result = await callGroq(prompt, 300);
    return {
      isCustomer: result.isCustomer ?? true,
      reason:     result.reason ?? 'Classified by Groq',
      classifier: 'groq',
    };
  } catch (err) {
    console.warn('[Classifier] Groq failed, trying Gemini:', err);
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
