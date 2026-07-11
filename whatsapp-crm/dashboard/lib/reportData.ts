import { createClient } from '@supabase/supabase-js';

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

export interface ReportInsight {
  id: number;
  chat_id: string;
  contact_name: string | null;
  chat_date: string | null;
  customer_intent: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  sentiment_reason: string | null;
  deal_stage: 'hot' | 'warm' | 'cold' | null;
  follow_up_action: string | null;
  follow_up_deadline: string | null;
  key_summary: string | null;
  agent_name: string | null;
}

export interface FollowUpCompliance {
  complied: number;
  missed: number;
  rate: number;
}

export interface DealStageRow {
  stage: string;
  count: number;
  percent: number;
}

export interface ReportStats {
  totalChats: number;
  hotLeads: number;
  followUpsOnTime: number;
  positivePercent: number;
  dealStages: DealStageRow[];
  mostCommonIntent: string;
  compliance: FollowUpCompliance;
  performanceNotes: string[];
}

export interface AgentScore {
  total: number;
  sentiment: number;
  followUp: number;
  hotLeadConversion: number;
  responseQuality: number;
  grade: string;
  label: string;
  color: string;
}

/** Performance score 0–100 across sentiment, follow-up, hot leads, and response quality. */
export function calculateScore(insights: ReportInsight[]): AgentScore {
  if (!insights || insights.length === 0) {
    return {
      total: 0,
      sentiment: 0,
      followUp: 0,
      hotLeadConversion: 0,
      responseQuality: 0,
      grade: 'N/A',
      label: 'No Data',
      color: '#6b7280',
    };
  }

  const total = insights.length;

  const positive = insights.filter((i) => i.sentiment === 'positive').length;
  const neutral = insights.filter((i) => i.sentiment === 'neutral').length;
  const sentimentPoints = ((positive * 1.0 + neutral * 0.5) / total) * 25;

  const noFollowup = insights.filter(
    (i) => i.follow_up_deadline === 'no follow-up needed'
  ).length;
  const urgent = insights.filter(
    (i) => i.follow_up_deadline === 'urgent (today)'
  ).length;
  const soon = insights.filter(
    (i) => i.follow_up_deadline === 'soon (2-3 days)'
  ).length;
  const later = insights.filter(
    (i) => i.follow_up_deadline === 'later (this week)'
  ).length;
  const followUpPoints =
    ((noFollowup * 1.0 + urgent * 0.0 + soon * 0.7 + later * 0.9) / total) * 25;

  const hot = insights.filter((i) => i.deal_stage === 'hot').length;
  const warm = insights.filter((i) => i.deal_stage === 'warm').length;
  const conversionPoints = ((hot * 1.0 + warm * 0.5) / total) * 25;

  const qualityChats = insights.filter(
    (i) =>
      i.customer_intent &&
      i.customer_intent !== 'Could not extract' &&
      i.customer_intent.length > 20 &&
      i.key_summary &&
      i.key_summary.length > 50
  ).length;
  const qualityPoints = (qualityChats / total) * 25;

  const totalScore = Math.round(
    sentimentPoints + followUpPoints + conversionPoints + qualityPoints
  );

  let grade: string;
  let label: string;
  let color: string;

  if (totalScore >= 85) {
    grade = 'A';
    label = 'Excellent';
    color = '#22c55e';
  } else if (totalScore >= 70) {
    grade = 'B';
    label = 'Good';
    color = '#6366f1';
  } else if (totalScore >= 55) {
    grade = 'C';
    label = 'Average';
    color = '#f59e0b';
  } else if (totalScore >= 40) {
    grade = 'D';
    label = 'Needs Improvement';
    color = '#f97316';
  } else {
    grade = 'F';
    label = 'Poor';
    color = '#ef4444';
  }

  return {
    total: totalScore,
    sentiment: Math.round(sentimentPoints * 10) / 10,
    followUp: Math.round(followUpPoints * 10) / 10,
    hotLeadConversion: Math.round(conversionPoints * 10) / 10,
    responseQuality: Math.round(qualityPoints * 10) / 10,
    grade,
    label,
    color,
  };
}

/** Follow-up compliance: AI-estimated per product rules. */
export function isFollowedUp(insight: ReportInsight): boolean {
  if (insight.follow_up_deadline === 'no follow-up needed') return true;
  if (insight.follow_up_deadline === 'urgent (today)') return false;
  return true;
}

export async function fetchAgentNames(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('agent_performance')
    .select('agent_name');

  if (error) throw error;

  const names = (data ?? [])
    .map((row) => row.agent_name)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));

  return [...new Set(names)];
}

export async function fetchAgentInsights(
  agentName: string,
  fromDate: string,
  toDate: string
): Promise<ReportInsight[]> {
  const supabase = getSupabase();

  // Inclusive end-of-day for toDate
  const toInclusive = toDate.includes('T') ? toDate : `${toDate}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from('chat_insights')
    .select(
      `
      id,
      chat_id,
      contact_name,
      chat_date,
      customer_intent,
      sentiment,
      sentiment_reason,
      deal_stage,
      follow_up_action,
      follow_up_deadline,
      key_summary,
      agent_name
    `
    )
    .eq('agent_name', agentName)
    .gte('chat_date', fromDate)
    .lte('chat_date', toInclusive)
    .order('chat_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ReportInsight[];
}

export function calculateFollowUpCompliance(insights: ReportInsight[]): FollowUpCompliance {
  if (insights.length === 0) {
    return { complied: 0, missed: 0, rate: 0 };
  }

  let complied = 0;
  let missed = 0;

  for (const insight of insights) {
    if (isFollowedUp(insight)) complied += 1;
    else missed += 1;
  }

  const rate = Math.round((complied / insights.length) * 100);
  return { complied, missed, rate };
}

export function getMostCommonIntent(insights: ReportInsight[]): string {
  const counts: Record<string, number> = {};
  for (const insight of insights) {
    const intent = insight.customer_intent?.trim();
    if (!intent) continue;
    counts[intent] = (counts[intent] ?? 0) + 1;
  }

  const entries = Object.entries(counts);
  if (entries.length === 0) return 'N/A';

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function buildReportStats(insights: ReportInsight[]): ReportStats {
  const totalChats = insights.length;
  const hotLeads = insights.filter((i) => i.deal_stage === 'hot').length;
  const compliance = calculateFollowUpCompliance(insights);
  const positiveCount = insights.filter((i) => i.sentiment === 'positive').length;
  const positivePercent =
    totalChats === 0 ? 0 : Math.round((positiveCount / totalChats) * 100);

  const stageOrder = ['hot', 'warm', 'cold'] as const;
  const stageCounts: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
  for (const insight of insights) {
    const stage = insight.deal_stage ?? 'cold';
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
  }

  const dealStages: DealStageRow[] = stageOrder.map((stage) => ({
    stage: stage.charAt(0).toUpperCase() + stage.slice(1),
    count: stageCounts[stage] ?? 0,
    percent: totalChats === 0 ? 0 : Math.round(((stageCounts[stage] ?? 0) / totalChats) * 100),
  }));

  const mostCommonIntent = getMostCommonIntent(insights);

  const performanceNotes = [
    `Agent handled ${totalChats} chats in this period with ${positivePercent}% positive sentiment.`,
    `${hotLeads} hot leads were generated. Follow-up compliance rate: ${compliance.rate}%.`,
    `Most common customer intent: ${mostCommonIntent}.`,
  ];

  return {
    totalChats,
    hotLeads,
    followUpsOnTime: compliance.complied,
    positivePercent,
    dealStages,
    mostCommonIntent,
    compliance,
    performanceNotes,
  };
}
