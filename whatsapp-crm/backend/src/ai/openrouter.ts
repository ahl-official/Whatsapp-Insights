import { config } from '../config';
import { parseAIResponse, AIResponse } from './gemini';

export async function callOpenRouter(
  prompt: string,
  maxTokens = 300
): Promise<AIResponse> {
  if (!config.ai.openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const response = await fetch(`${config.ai.openRouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.ai.openRouterApiKey}`,
      'HTTP-Referer':  'https://whatsapp-crm-backend-production-46fb.up.railway.app',
      'X-Title':       'WhatsApp CRM',
    },
    body: JSON.stringify({
      model:       config.ai.openRouterModel,
      max_tokens:  maxTokens,
      temperature: 0.1,
      messages: [
        {
          role:    'system',
          content: 'You are a JSON-only responder. Output only valid JSON with no markdown, no backticks, no explanation.',
        },
        {
          role:    'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('OpenRouter returned empty response');
  }

  return parseAIResponse(text);
}
