import { config } from '../config';
import { parseAIResponse, AIResponse } from './gemini';

export async function callGroq(
  prompt: string,
  maxTokens = 1024
): Promise<AIResponse> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       'llama-3.1-8b-instant',
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
    throw new Error(`Groq API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('Groq returned an empty response');
  }

  return parseAIResponse(raw);
}
