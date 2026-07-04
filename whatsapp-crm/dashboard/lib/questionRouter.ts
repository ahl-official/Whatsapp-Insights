import { createClient } from '@supabase/supabase-js';
import {
  getChatDetailsByChatId,
  getChatInsightsByChatId,
  getCustomerProfileByChatId,
  getLatestChatWithTranscript,
  searchChatsWithTranscript,
  type CustomerChat,
  type ChatInsight,
  type CustomerProfile,
} from '@/lib/supabase';
import { trimTranscript } from '@/lib/transcript';

export type DataType =
  | 'agents'
  | 'customers'
  | 'deals'
  | 'sentiment'
  | 'followups'
  | 'recent'
  | 'overview'
  | 'conversation';

export interface ConversationMatch {
  chat_id: string;
  contact_name: string | null;
  agent_name: string | null;
  chat_date: string | null;
}

export interface ConversationPackage {
  mode: 'single' | 'clarification' | 'not_found';
  chat?: CustomerChat & { transcript: string | null };
  insights?: ChatInsight | null;
  profile?: CustomerProfile | null;
  transcriptTrimmed?: boolean;
  transcriptNote?: string;
  matches?: ConversationMatch[];
}

export interface RoutedData {
  dataType: DataType;
  data: unknown;
  isEmpty: boolean;
  directAnswer?: string;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url, key, {
    global: {
      fetch: (url, options = {}) =>
        fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

function matches(question: string, keywords: string[]): boolean {
  const q = question.toLowerCase();
  return keywords.some((kw) => q.includes(kw));
}

const CONVERSATION_KEYWORDS = [
  'conversation',
  'exact chat',
  'chat history',
  'what happened',
  'what went on',
  'agent and customer',
  'agent and the customer',
  'transcript',
  'latest chat',
  'latest customer conversation',
  'customer said',
  'agent said',
  'tell me about the chat',
  'chat with',
  'what did they say',
  'what was said',
  'between agent and',
  'exact conversation',
  'whatsapp chat',
  'message history',
];

function isConversationQuestion(question: string): boolean {
  const q = question.toLowerCase();

  if (matches(q, CONVERSATION_KEYWORDS)) {
    return true;
  }

  const hasPhone = /\d{10,15}/.test(q);
  const hasChatContext = /chat|conversation|talk|message|whatsapp|transcript/.test(q);
  if (hasPhone && hasChatContext) {
    return true;
  }

  if (/follow[- ]?up/.test(q) && /this customer|the customer|for this/.test(q)) {
    return true;
  }

  return false;
}

function extractChatIdFromQuestion(question: string): string | null {
  const fullId = question.match(/\d{10,15}@[a-z.]+/i);
  if (fullId) return fullId[0];

  const bareNumber = question.match(/\b(\d{10,15})\b/);
  if (bareNumber) {
    return `${bareNumber[1]}@c.us`;
  }

  return null;
}

function wantsLatestChat(question: string): boolean {
  const q = question.toLowerCase();
  return (
    /latest\s+(customer\s+)?(chat|conversation)/.test(q) ||
    /summarize\s+(the\s+)?latest/.test(q) ||
    /agent\s+and\s+(the\s+)?customer/.test(q) ||
    /exact conversation between/.test(q)
  );
}

function extractSearchTermFromQuestion(question: string): string | null {
  const patterns = [
    /(?:chat|conversation)\s+with\s+([^?.,]+)/i,
    /(?:about|for)\s+([A-Za-z][A-Za-z0-9\s]{1,40}?)(?:\?|$|,|\.)/i,
    /customer\s+([A-Za-z][A-Za-z0-9\s]{1,40}?)(?:\?|$|,|\.)/i,
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match?.[1]) {
      const term = match[1].trim();
      if (term.length >= 2 && !/^(the|this|a|an)$/i.test(term)) {
        return term;
      }
    }
  }

  return null;
}

async function buildConversationPackage(chat: CustomerChat): Promise<ConversationPackage> {
  const [insights, profile] = await Promise.all([
    getChatInsightsByChatId(chat.chat_id),
    getCustomerProfileByChatId(chat.chat_id),
  ]);

  const { text, trimmed, note } = trimTranscript(chat.transcript);

  return {
    mode: 'single',
    chat: { ...chat, transcript: text },
    insights,
    profile,
    transcriptTrimmed: trimmed,
    transcriptNote: note,
  };
}

async function fetchConversationData(question: string): Promise<RoutedData> {
  const chatId = extractChatIdFromQuestion(question);
  if (chatId) {
    let chat = await getChatDetailsByChatId(chatId);
    if (!chat) {
      const bare = chatId.replace(/@.*/, '');
      const matches = await searchChatsWithTranscript(bare);
      if (matches.length === 1) {
        chat = matches[0];
      } else if (matches.length > 1) {
        const list = matches
          .map(
            (m, i) =>
              `${i + 1}. ${m.contact_name ?? 'Unknown'} (${m.chat_id}) — agent: ${m.agent_name ?? 'unknown'}`
          )
          .join('\n');
        return {
          dataType: 'conversation',
          data: {
            mode: 'clarification',
            matches: matches.map((m) => ({
              chat_id: m.chat_id,
              contact_name: m.contact_name,
              agent_name: m.agent_name,
              chat_date: m.chat_date,
            })),
          } satisfies ConversationPackage,
          isEmpty: false,
          directAnswer: `Multiple chats match ${bare}. Please specify which one:\n\n${list}`,
        };
      }
    }
    if (!chat) {
      return {
        dataType: 'conversation',
        data: { mode: 'not_found' } satisfies ConversationPackage,
        isEmpty: true,
        directAnswer: `No customer chat found for ${chatId}. Try searching by contact name instead.`,
      };
    }
    const data = await buildConversationPackage(chat);
    return { dataType: 'conversation', data, isEmpty: false };
  }

  if (wantsLatestChat(question)) {
    const chat = await getLatestChatWithTranscript();
    if (!chat) {
      return {
        dataType: 'conversation',
        data: { mode: 'not_found' } satisfies ConversationPackage,
        isEmpty: true,
        directAnswer: 'No customer chats found in the CRM yet.',
      };
    }
    const data = await buildConversationPackage(chat);
    return { dataType: 'conversation', data, isEmpty: false };
  }

  const searchTerm = extractSearchTermFromQuestion(question);
  if (searchTerm) {
    const matches = await searchChatsWithTranscript(searchTerm);
    if (matches.length === 0) {
      return {
        dataType: 'conversation',
        data: { mode: 'not_found' } satisfies ConversationPackage,
        isEmpty: true,
        directAnswer: `No customer chat found matching "${searchTerm}".`,
      };
    }
    if (matches.length > 1) {
      const list = matches
        .map(
          (m, i) =>
            `${i + 1}. ${m.contact_name ?? 'Unknown'} (${m.chat_id}) — agent: ${m.agent_name ?? 'unknown'}, date: ${m.chat_date ? new Date(m.chat_date).toLocaleDateString() : 'unknown'}`
        )
        .join('\n');
      return {
        dataType: 'conversation',
        data: {
          mode: 'clarification',
          matches: matches.map((m) => ({
            chat_id: m.chat_id,
            contact_name: m.contact_name,
            agent_name: m.agent_name,
            chat_date: m.chat_date,
          })),
        } satisfies ConversationPackage,
        isEmpty: false,
        directAnswer: `Multiple customers match "${searchTerm}". Please specify which one:\n\n${list}`,
      };
    }
    const data = await buildConversationPackage(matches[0]);
    return { dataType: 'conversation', data, isEmpty: false };
  }

  const chat = await getLatestChatWithTranscript();
  if (!chat) {
    return {
      dataType: 'conversation',
      data: { mode: 'not_found' } satisfies ConversationPackage,
      isEmpty: true,
      directAnswer: 'No customer chats found in the CRM yet.',
    };
  }
  const data = await buildConversationPackage(chat);
  return { dataType: 'conversation', data, isEmpty: false };
}

export function detectDataType(question: string): DataType {
  if (isConversationQuestion(question)) {
    return 'conversation';
  }
  if (matches(question, ['follow', 'followup', 'follow-up', 'urgent', 'pending'])) {
    return 'followups';
  }
  if (
    matches(question, [
      'sentiment',
      'happy',
      'unhappy',
      'positive',
      'negative',
      'mood',
      'feeling',
    ])
  ) {
    return 'sentiment';
  }
  if (matches(question, ['hot', 'warm', 'cold', 'lead', 'deal', 'stage', 'pipeline'])) {
    return 'deals';
  }
  if (
    matches(question, [
      'agent',
      'employee',
      'staff',
      'team',
      'best',
      'worst',
      'performance',
    ])
  ) {
    return 'agents';
  }
  if (
    matches(question, [
      'customer',
      'client',
      'contact',
      'profile',
      'who',
      'who bought',
      'buying',
    ])
  ) {
    return 'customers';
  }
  if (matches(question, ['week', 'today', 'recent', 'latest', 'this week'])) {
    return 'recent';
  }
  if (matches(question, ['summary', 'overview', 'report', 'all', 'everything', 'general'])) {
    return 'overview';
  }
  return 'overview';
}

function groupCount(
  rows: Record<string, unknown>[],
  field: string
): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row[field] ?? 'unknown');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).map(([label, count]) => ({ label, count }));
}

function isDataEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    return Object.values(obj).every((v) => {
      if (Array.isArray(v)) return v.length === 0;
      if (v && typeof v === 'object') return isDataEmpty(v);
      return false;
    });
  }
  return false;
}

async function fetchDealStageCounts() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_insights')
    .select('deal_stage');
  if (error) throw error;
  return groupCount(data ?? [], 'deal_stage');
}

async function fetchSentimentCounts() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_insights')
    .select('sentiment');
  if (error) throw error;
  return groupCount(data ?? [], 'sentiment');
}

export async function fetchDataForQuestion(question: string): Promise<RoutedData> {
  const dataType = detectDataType(question);

  if (dataType === 'conversation') {
    return fetchConversationData(question);
  }

  const supabase = getSupabase();

  switch (dataType) {
    case 'agents': {
      const { data, error } = await supabase.from('agent_performance').select('*');
      if (error) throw error;
      return { dataType, data: data ?? [], isEmpty: !data?.length };
    }
    case 'customers': {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .order('last_active', { ascending: false })
        .limit(50);
      if (error) throw error;
      return { dataType, data: data ?? [], isEmpty: !data?.length };
    }
    case 'deals': {
      const counts = await fetchDealStageCounts();
      return { dataType, data: counts, isEmpty: counts.length === 0 };
    }
    case 'sentiment': {
      const counts = await fetchSentimentCounts();
      return { dataType, data: counts, isEmpty: counts.length === 0 };
    }
    case 'followups': {
      const { data, error } = await supabase
        .from('chat_insights')
        .select('*')
        .eq('follow_up_deadline', 'urgent (today)')
        .order('chat_date', { ascending: false });
      if (error) throw error;
      return { dataType, data: data ?? [], isEmpty: !data?.length };
    }
    case 'recent': {
      const { data, error } = await supabase
        .from('chat_insights')
        .select('*')
        .order('chat_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return { dataType, data: data ?? [], isEmpty: !data?.length };
    }
    case 'overview': {
      const [agents, dealStages, sentiments] = await Promise.all([
        supabase.from('agent_performance').select('*'),
        fetchDealStageCounts(),
        fetchSentimentCounts(),
      ]);
      if (agents.error) throw agents.error;
      const data = {
        agents: agents.data ?? [],
        dealStages,
        sentiments,
      };
      return { dataType, data, isEmpty: isDataEmpty(data) };
    }
    default:
      return { dataType: 'overview', data: {}, isEmpty: true };
  }
}
