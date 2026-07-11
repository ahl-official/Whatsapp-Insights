import { config } from '../config';

function formatMessages(
  messages: unknown,
): string[] {
  return (Array.isArray(messages) ? messages : [])
    .filter((m: { body?: string }) => m.body?.trim())
    .map((m: { fromMe?: boolean; body: string }) =>
      `${m.fromMe ? 'Agent' : 'Customer'}: ${m.body.trim()}`
    )
    .reverse();
}

async function fetchMessagesFromPath(
  path: string,
  limit: number
): Promise<string[]> {
  const url = new URL(path, config.waha.baseUrl);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('sortBy', 'timestamp');
  url.searchParams.set('sortOrder', 'desc');
  url.searchParams.set('downloadMedia', 'false');

  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': config.waha.apiKey },
  });

  if (!res.ok) return [];
  return formatMessages(await res.json());
}

export async function fetchRecentMessages(
  chatId: string,
  limit: number = config.ai.classifierMsgCount
): Promise<string[]> {
  const session = config.waha.session;
  const encodedId = encodeURIComponent(chatId);

  // @lid chats: try lid messages endpoint first, then fall back to chats
  if (chatId.endsWith('@lid')) {
    const lidMessages = await fetchMessagesFromPath(
      `/api/${session}/lids/${encodedId}/messages`,
      limit
    );
    if (lidMessages.length > 0) return lidMessages;
  }

  return fetchMessagesFromPath(
    `/api/${session}/chats/${encodedId}/messages`,
    limit
  );
}

export async function fetchFullTranscript(chatId: string): Promise<string[]> {
  // Fetches up to 200 messages for insight extraction
  return fetchRecentMessages(chatId, 200);
}
