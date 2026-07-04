import { supabasePost, supabasePatch } from './supabase';
import { config } from '../config';

// Private helper — service key bypasses RLS for backend pipeline reads
async function supabaseServiceGet(endpoint: string): Promise<any> {
  const res = await fetch(`${config.supabase.url}${endpoint}`, {
    headers: {
      'Content-Type':  'application/json',
      'apikey':        config.supabase.serviceKey,
      'Authorization': `Bearer ${config.supabase.serviceKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase service GET failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface ChatRecord {
  chat_id:       string;
  agent_name:    string;
  contact_name:  string;
  last_message:  string;
  transcript:    string;
  message_count: number;
  chat_date:     string;
}

export async function saveChat(chat: ChatRecord): Promise<void> {
  // Upsert on chat_id — reset insights_done so returning customers are re-processed
  // transcript_archived is not reset (not included in payload)
  await supabasePost(
    '/rest/v1/customer_chats?on_conflict=chat_id',
    { ...chat, insights_done: false },
    { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
  );
}

export async function updateChatTranscript(id: number, transcript: string, messageCount: number): Promise<void> {
  await supabasePatch(`/rest/v1/customer_chats?id=eq.${id}`, {
    transcript,
    message_count: messageCount,
  });
}

export async function markChatProcessed(id: number): Promise<void> {
  await supabasePatch(`/rest/v1/customer_chats?id=eq.${id}`, {
    insights_done: true,
  });
}

// New chats and returning customers (insights_done reset on each webhook upsert)
export async function fetchUnprocessedChats(limit = 50): Promise<any[]> {
  return supabaseServiceGet(
    `/rest/v1/customer_chats?insights_done=eq.false&transcript=not.is.null&order=chat_date.asc&limit=${limit}`
  );
}

export async function fetchChatsForArchive(): Promise<any[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);
  return supabaseServiceGet(
    `/rest/v1/customer_chats?insights_done=eq.true&transcript_archived=eq.false&chat_date=lt.${cutoff.toISOString()}&select=*`
  );
}
