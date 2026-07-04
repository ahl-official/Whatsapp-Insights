import { config } from '../config';

export async function fetchRecentMessages(
  chatId: string,
  limit: number = config.ai.classifierMsgCount
): Promise<string[]> {
  const url = new URL(
    `/api/${config.waha.session}/chats/${encodeURIComponent(chatId)}/messages`,
    config.waha.baseUrl
  );
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('sortBy', 'timestamp');
  url.searchParams.set('sortOrder', 'desc');
  url.searchParams.set('downloadMedia', 'false');

  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': config.waha.apiKey },
  });

  if (!res.ok) return [];

  const messages = await res.json();
  return (Array.isArray(messages) ? messages : [])
    .filter((m: { body?: string }) => m.body?.trim())
    .map((m: { fromMe?: boolean; body: string }) => `${m.fromMe ? 'Agent' : 'Customer'}: ${m.body.trim()}`)
    .reverse();
}

export async function fetchFullTranscript(chatId: string): Promise<string[]> {
  // Fetches up to 200 messages for insight extraction
  return fetchRecentMessages(chatId, 200);
}
