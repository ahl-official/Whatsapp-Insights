import { config } from '../config';

export interface AIResponse {
  isCustomer?: boolean;
  reason?: string;
  customerIntent?: string;
  sentiment?: string;
  sentimentReason?: string;
  dealStage?: string;
  followUpAction?: string;
  followUpDeadline?: string;
  keySummary?: string;
  cumulativeSummary?: string;
  productsInterested?: string;
  lastPurchase?: string;
  keyConcerns?: string;
  overallSentiment?: string;
}

const MAX_LOG_SNIPPET = 500;

function safeLogSnippet(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= MAX_LOG_SNIPPET) return oneLine;
  return oneLine.slice(0, MAX_LOG_SNIPPET) + '...';
}

/** Extract substring from first `{` through last `}`. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

/** Shared JSON parser for Groq and Gemini responses. */
export function parseAIResponse(text: string): AIResponse {
  if (!text?.trim()) {
    throw new Error('AI response was empty');
  }

  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```\s*$/g, '').trim();

  const jsonStr = extractJsonObject(cleaned);
  if (!jsonStr) {
    console.error('[AI] No JSON object found in response:', safeLogSnippet(text));
    throw new Error(`AI response contained no JSON object. Raw snippet: ${safeLogSnippet(text)}`);
  }

  try {
    return JSON.parse(jsonStr) as AIResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AI] JSON parse failed:', message);
    console.error('[AI] Raw response snippet:', safeLogSnippet(text));
    console.error('[AI] Extracted JSON snippet:', safeLogSnippet(jsonStr));
    throw new Error(`AI response was not valid JSON (${message}). Raw snippet: ${safeLogSnippet(text)}`);
  }
}

export async function callGemini(
  prompt: string,
  maxOutputTokens = 1024
): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.geminiModel}:generateContent?key=${config.ai.geminiApiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    throw new Error('Gemini returned an empty response');
  }

  return parseAIResponse(raw);
}
