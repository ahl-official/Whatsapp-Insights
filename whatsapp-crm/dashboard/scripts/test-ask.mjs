import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local');
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const BASE = 'http://localhost:3000';
const AUTH = Buffer.from(`${env.DASHBOARD_USERNAME}:${env.DASHBOARD_PASSWORD}`).toString('base64');

const QUESTIONS = [
  'Give me an overview of everything',
  'Who is our best agent?',
  'Show me all hot leads',
  'What are customers asking about most?',
  'Which follow-ups are urgent?',
  'How is team sentiment this week?',
];

function detectDataType(question) {
  const q = question.toLowerCase();
  const matches = (kws) => kws.some((kw) => q.includes(kw));
  if (matches(['follow', 'followup', 'follow-up', 'urgent', 'pending'])) return 'followups';
  if (matches(['sentiment', 'happy', 'unhappy', 'positive', 'negative', 'mood', 'feeling'])) return 'sentiment';
  if (matches(['hot', 'warm', 'cold', 'lead', 'deal', 'stage', 'pipeline'])) return 'deals';
  if (matches(['agent', 'employee', 'staff', 'team', 'who', 'best', 'worst', 'performance'])) return 'agents';
  if (matches(['customer', 'client', 'contact', 'profile', 'who bought', 'buying'])) return 'customers';
  if (matches(['week', 'today', 'recent', 'latest', 'this week'])) return 'recent';
  if (matches(['summary', 'overview', 'report', 'all', 'everything', 'general'])) return 'overview';
  return 'overview';
}

async function fetchData(dataType) {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const groupCount = (rows, field) => {
    const counts = {};
    for (const row of rows) {
      const key = String(row[field] ?? 'unknown');
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).map(([label, count]) => ({ label, count }));
  };

  switch (dataType) {
    case 'agents': {
      const { data, error } = await supabase.from('agent_performance').select('*');
      if (error) throw error;
      return { data: data ?? [], isEmpty: !data?.length };
    }
    case 'deals': {
      const { data, error } = await supabase.from('chat_insights').select('deal_stage');
      if (error) throw error;
      const counts = groupCount(data ?? [], 'deal_stage');
      return { data: counts, isEmpty: counts.length === 0 };
    }
    case 'sentiment': {
      const { data, error } = await supabase.from('chat_insights').select('sentiment');
      if (error) throw error;
      const counts = groupCount(data ?? [], 'sentiment');
      return { data: counts, isEmpty: counts.length === 0 };
    }
    case 'followups': {
      const { data, error } = await supabase
        .from('chat_insights')
        .select('*')
        .eq('follow_up_deadline', 'urgent (today)');
      if (error) throw error;
      return { data: data ?? [], isEmpty: !data?.length };
    }
    case 'recent': {
      const { data, error } = await supabase
        .from('chat_insights')
        .select('*')
        .order('chat_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return { data: data ?? [], isEmpty: !data?.length };
    }
    case 'overview': {
      const [agents, insights] = await Promise.all([
        supabase.from('agent_performance').select('*'),
        supabase.from('chat_insights').select('deal_stage, sentiment'),
      ]);
      if (agents.error) throw agents.error;
      if (insights.error) throw insights.error;
      const data = {
        agents: agents.data ?? [],
        dealStages: groupCount(insights.data ?? [], 'deal_stage'),
        sentiments: groupCount(insights.data ?? [], 'sentiment'),
      };
      const isEmpty =
        !data.agents.length && !data.dealStages.length && !data.sentiments.length;
      return { data, isEmpty };
    }
    default:
      return { data: {}, isEmpty: true };
  }
}

async function main() {
  const results = [];
  let passed = 0;
  let failed = 0;

  console.log('=== /ask Integration Tests ===\n');

  // Auth: /ask without credentials
  const noAuth = await fetch(`${BASE}/ask`);
  if (noAuth.status === 401) {
    console.log('✓ /ask returns 401 without auth');
    passed++;
  } else {
    console.log(`✗ /ask expected 401, got ${noAuth.status}`);
    failed++;
  }

  // Auth: /ask with credentials
  const withAuth = await fetch(`${BASE}/ask`, {
    headers: { Authorization: `Basic ${AUTH}` },
  });
  if (withAuth.status === 200) {
    console.log('✓ /ask returns 200 with auth');
    passed++;
  } else {
    console.log(`✗ /ask expected 200, got ${withAuth.status}`);
    failed++;
  }

  // Auth: /api/ask without credentials
  const apiNoAuth = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'test', data: [], dataType: 'overview' }),
  });
  if (apiNoAuth.status === 401) {
    console.log('✓ /api/ask returns 401 without auth');
    passed++;
  } else {
    console.log(`✗ /api/ask expected 401, got ${apiNoAuth.status}`);
    failed++;
  }

  console.log('\n--- Question tests ---\n');

  for (const question of QUESTIONS) {
    const dataType = detectDataType(question);
    let status = 'PASS';
    let detail = '';

    try {
      const { data, isEmpty } = await fetchData(dataType);

      if (isEmpty) {
        detail = `dataType=${dataType} | empty DB → would show empty-state (no Groq call)`;
      } else {
        const res = await fetch(`${BASE}/api/ask`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${AUTH}`,
          },
          body: JSON.stringify({ question, data, dataType, history: [] }),
        });

        if (!res.ok) {
          status = 'FAIL';
          detail = `API ${res.status}: ${await res.text()}`;
          failed++;
        } else {
          const { answer, error } = await res.json();
          if (error) {
            status = 'FAIL';
            detail = error;
            failed++;
          } else {
            const preview = (answer ?? '').slice(0, 120).replace(/\n/g, ' ');
            const hasChart = answer?.includes('<chart>');
            detail = `dataType=${dataType} | rows=${JSON.stringify(data).length}b | chart=${hasChart} | "${preview}..."`;
            passed++;
          }
        }
      }

      if (isEmpty) passed++;

      results.push({ question, dataType, status, detail });
      console.log(`${status === 'PASS' ? '✓' : '✗'} "${question}"`);
      console.log(`  ${detail}\n`);
    } catch (err) {
      failed++;
      results.push({ question, dataType, status: 'FAIL', detail: err.message });
      console.log(`✗ "${question}"`);
      console.log(`  Error: ${err.message}\n`);
    }
  }

  console.log('=== Summary ===');
  console.log(`Passed: ${passed} | Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
