import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    _supabase = createClient(url, key, {
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    });
  }
  return _supabase;
}

export interface ChatInsight {
  id: number;
  chat_id: string;
  agent_name: string | null;
  contact_name: string | null;
  chat_date: string | null;
  customer_intent: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  sentiment_reason: string | null;
  deal_stage: 'hot' | 'warm' | 'cold' | null;
  follow_up_action: string | null;
  follow_up_deadline: string | null;
  key_summary: string | null;
  created_at: string;
}

export interface HotLead extends ChatInsight {
  message_count: number | null;
}

export interface AgentPerformance {
  agent_name: string | null;
  total_chats: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  positive_chats: number;
  negative_chats: number;
  hot_lead_rate: number;
}

function startOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export async function getWeeklyChatCount(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('chat_insights')
    .select('*', { count: 'exact', head: true })
    .gte('chat_date', startOfWeek());

  if (error) throw error;
  return count ?? 0;
}

export async function getHotLeadsCount(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('hot_leads')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count ?? 0;
}

export async function getSentimentBreakdown(): Promise<Record<string, number>> {
  const { data, error } = await getSupabase()
    .from('chat_insights')
    .select('sentiment');

  if (error) throw error;

  const breakdown: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const row of data ?? []) {
    if (row.sentiment && row.sentiment in breakdown) {
      breakdown[row.sentiment]++;
    }
  }
  return breakdown;
}

export async function getUrgentFollowUps(): Promise<ChatInsight[]> {
  const { data, error } = await getSupabase()
    .from('chat_insights')
    .select('*')
    .eq('follow_up_deadline', 'urgent (today)')
    .order('chat_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getRecentHotLeads(limit = 20): Promise<HotLead[]> {
  const { data, error } = await getSupabase()
    .from('hot_leads')
    .select('*')
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getAgentPerformance(): Promise<AgentPerformance[]> {
  const { data, error } = await getSupabase()
    .from('agent_performance')
    .select('*');

  if (error) throw error;
  return data ?? [];
}

export interface SearchFilters {
  query?: string;
  contact?: string;
  agent?: string;
  dealStage?: string;
  sentiment?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function searchInsights(filters: SearchFilters): Promise<ChatInsight[]> {
  let query = getSupabase()
    .from('chat_insights')
    .select('*')
    .order('chat_date', { ascending: false });

  if (filters.query) {
    query = query.ilike('key_summary', `%${filters.query}%`);
  }
  if (filters.contact) {
    query = query.ilike('contact_name', `%${filters.contact}%`);
  }
  if (filters.agent) {
    query = query.ilike('agent_name', `%${filters.agent}%`);
  }
  if (filters.dealStage) {
    query = query.eq('deal_stage', filters.dealStage);
  }
  if (filters.sentiment) {
    query = query.eq('sentiment', filters.sentiment);
  }
  if (filters.dateFrom) {
    query = query.gte('chat_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('chat_date', filters.dateTo);
  }

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data ?? [];
}

export interface CustomerProfile {
  id: number;
  chat_id: string;
  contact_name: string | null;
  agent_name: string | null;
  cumulative_summary: string | null;
  current_deal_stage: 'hot' | 'warm' | 'cold' | null;
  overall_sentiment: 'positive' | 'neutral' | 'negative' | null;
  total_chats: number;
  hot_lead_count: number;
  products_interested: string | null;
  last_purchase: string | null;
  key_concerns: string | null;
  preferred_agent: string | null;
  first_seen: string | null;
  last_active: string | null;
  last_updated: string;
  created_at: string;
}

export async function fetchAllProfiles(limit = 100): Promise<CustomerProfile[]> {
  const { data, error } = await getSupabase()
    .from('customer_profiles')
    .select('*')
    .order('last_active', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function searchProfiles(query: string): Promise<CustomerProfile[]> {
  const { data, error } = await getSupabase()
    .from('customer_profiles')
    .select('*')
    .or(`contact_name.ilike.%${query}%,products_interested.ilike.%${query}%,cumulative_summary.ilike.%${query}%`)
    .order('last_active', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getProfileByChatId(chatId: string): Promise<CustomerProfile | null> {
  const { data, error } = await getSupabase()
    .from('customer_profiles')
    .select('*')
    .eq('chat_id', chatId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface CustomerChat {
  chat_id: string;
  contact_name: string | null;
  agent_name: string | null;
  last_message: string | null;
  transcript: string | null;
  message_count: number | null;
  chat_date: string;
}

const CHAT_DETAIL_COLUMNS =
  'chat_id, contact_name, agent_name, last_message, transcript, message_count, chat_date';

export async function getLatestChatWithTranscript(): Promise<CustomerChat | null> {
  const { data, error } = await getSupabase()
    .from('customer_chats')
    .select(CHAT_DETAIL_COLUMNS)
    .order('chat_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function searchChatsWithTranscript(query: string): Promise<CustomerChat[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await getSupabase()
    .from('customer_chats')
    .select(CHAT_DETAIL_COLUMNS)
    .or(`contact_name.ilike.%${q}%,chat_id.ilike.%${q}%,last_message.ilike.%${q}%`)
    .order('chat_date', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data ?? [];
}

export async function getChatDetailsByChatId(chatId: string): Promise<CustomerChat | null> {
  const { data, error } = await getSupabase()
    .from('customer_chats')
    .select(CHAT_DETAIL_COLUMNS)
    .eq('chat_id', chatId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getChatInsightsByChatId(chatId: string): Promise<ChatInsight | null> {
  const { data, error } = await getSupabase()
    .from('chat_insights')
    .select('*')
    .eq('chat_id', chatId)
    .order('chat_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCustomerProfileByChatId(chatId: string): Promise<CustomerProfile | null> {
  return getProfileByChatId(chatId);
}
