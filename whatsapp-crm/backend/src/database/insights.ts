import { supabasePost, supabasePatch } from './supabase';
import { config } from '../config';

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

export interface InsightRecord {
  chat_id:            string;
  agent_name:         string;
  contact_name:       string;
  chat_date:          string;
  customer_intent:    string;
  sentiment:          string;
  sentiment_reason:   string;
  deal_stage:         string;
  follow_up_action:   string;
  follow_up_deadline: string;
  key_summary:        string;
}

export async function saveInsight(insight: InsightRecord): Promise<void> {
  await supabasePost('/rest/v1/chat_insights', insight);
}

export async function upsertInsight(insight: InsightRecord): Promise<void> {
  await supabasePost(
    '/rest/v1/chat_insights?on_conflict=chat_id',
    insight,
    { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
  );
}

export async function getInsightByChatId(chatId: string): Promise<any | null> {
  try {
    const results = await supabaseServiceGet(
      `/rest/v1/chat_insights?chat_id=eq.${encodeURIComponent(chatId)}&limit=1`
    );
    return Array.isArray(results) && results.length > 0 ? results[0] : null;
  } catch {
    return null;
  }
}

export async function markInsightSynced(id: number): Promise<void> {
  await supabasePatch(`/rest/v1/chat_insights?id=eq.${id}`, {
    sheets_synced: true,
  });
}

export async function fetchUnsyncedInsights(): Promise<any[]> {
  return supabaseServiceGet(
    '/rest/v1/chat_insights?sheets_synced=eq.false&order=chat_date.asc'
  );
}

export async function markAllInsightsSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await supabasePatch(
    `/rest/v1/chat_insights?id=in.(${ids.join(',')})`,
    { sheets_synced: true }
  );
}
