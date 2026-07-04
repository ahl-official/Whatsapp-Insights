import { supabasePost, supabaseGet } from './supabase';
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

export interface ProfileRecord {
  id?:                  number;
  chat_id:             string;
  contact_name:        string;
  agent_name:          string;
  cumulative_summary:  string;
  current_deal_stage:  string;
  overall_sentiment:   string;
  total_chats:         number;
  hot_lead_count:      number;
  products_interested: string;
  last_purchase:       string;
  key_concerns:        string;
  preferred_agent:     string;
  first_seen:          string;
  last_active:         string;
  last_updated:        string;
}

// Fetch existing profile for a customer (returns null if not found)
export async function getProfile(chatId: string): Promise<ProfileRecord | null> {
  try {
    const results = await supabaseServiceGet(
      `/rest/v1/customer_profiles?chat_id=eq.${encodeURIComponent(chatId)}&limit=1`
    );
    return Array.isArray(results) && results.length > 0 ? results[0] : null;
  } catch {
    return null;
  }
}

// Upsert profile — creates if not exists, updates if exists
export async function upsertProfile(profile: Partial<ProfileRecord> & { chat_id: string }): Promise<void> {
  await supabasePost(
    '/rest/v1/customer_profiles?on_conflict=chat_id',
    {
      ...profile,
      last_updated: new Date().toISOString(),
    },
    { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
  );
}

// Fetch all profiles for dashboard
export async function fetchAllProfiles(limit = 100): Promise<ProfileRecord[]> {
  return supabaseGet(
    `/rest/v1/customer_profiles?order=last_active.desc&limit=${limit}`
  );
}

// Fetch hot customer profiles
export async function fetchHotProfiles(): Promise<ProfileRecord[]> {
  return supabaseGet(
    `/rest/v1/customer_profiles?current_deal_stage=eq.hot&order=last_active.desc`
  );
}

// Search profiles by contact name or products
export async function searchProfiles(query: string): Promise<ProfileRecord[]> {
  const q = encodeURIComponent(query);
  return supabaseGet(
    `/rest/v1/customer_profiles?or=(contact_name.ilike.*${q}*,products_interested.ilike.*${q}*,cumulative_summary.ilike.*${q}*)&order=last_active.desc`
  );
}
