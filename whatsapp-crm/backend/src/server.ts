import express from 'express';
import cron from 'node-cron';
import { config } from './config';
import { wahaRouter } from './webhooks/wahaHandler';
import { runInsightsPipeline } from './jobs/insightsPipeline';
import { runWeeklySheets } from './jobs/weeklySheets';
import { runMonthlyArchive } from './jobs/monthlyArchive';
import { verifySpreadsheetAccess } from './google/sheets';
import { formatGoogleSheetsError } from './google/normalize';
import { supabaseHeaders } from './database/supabase';
import { requireAdmin } from './middleware/auth';

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/', wahaRouter);

app.get('/health', (_req, res) => {
  res.json({
    status:   'ok',
    features: config.features,
    time:     new Date().toISOString(),
  });
});

async function supabaseCount(table: string): Promise<number> {
  const res = await fetch(`${config.supabase.url}/rest/v1/${table}?select=id`, {
    headers: { ...supabaseHeaders(true), Prefer: 'count=exact', Range: '0-0' },
  });
  if (!res.ok) throw new Error(`Supabase count failed for ${table}: ${res.status}`);
  const range = res.headers.get('content-range');
  if (!range) return 0;
  const total = range.split('/')[1];
  return parseInt(total, 10) || 0;
}

// Manual insights trigger — for testing without waiting 6 hours
app.post('/run-insights', requireAdmin, async (_req, res) => {
  console.log('[Manual] Insights pipeline triggered manually');
  res.json({
    status:  'started',
    message: 'Insights pipeline triggered — check terminal for progress',
  });
  runInsightsPipeline().catch(console.error);
});

app.get('/run-insights', requireAdmin, async (_req, res) => {
  console.log('[Manual] Insights pipeline triggered via GET');
  res.json({
    status:  'started',
    message: 'Insights pipeline triggered — check terminal for progress',
  });
  runInsightsPipeline().catch(console.error);
});

app.post('/run-sheets-sync', requireAdmin, async (_req, res) => {
  console.log('[Manual] Weekly Sheets sync triggered manually');
  res.json({
    status:  'started',
    message: 'Sheets sync triggered — check terminal for progress',
  });
  runWeeklySheets().catch(console.error);
});

app.get('/status', requireAdmin, async (_req, res) => {
  try {
    const [chats, insights, profiles] = await Promise.all([
      supabaseCount('customer_chats'),
      supabaseCount('chat_insights'),
      supabaseCount('customer_profiles'),
    ]);

    res.json({
      status: 'ok',
      database: {
        customer_chats:    chats,
        chat_insights:     insights,
        customer_profiles: profiles,
      },
      features: config.features,
      uptime:   Math.floor(process.uptime()) + 's',
      time:     new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── Scheduled Jobs ────────────────────────────────────────────────────────
// Insights pipeline — every 6 hours by default
cron.schedule(config.cron.insights, () => {
  console.log('[Cron] Running insights pipeline...');
  runInsightsPipeline().catch(console.error);
});

// Weekly Sheets sync — Monday 9:00 AM IST (3:30 AM UTC)
cron.schedule(config.cron.weeklySheets, () => {
  console.log('[Cron] Running weekly Sheets sync...');
  runWeeklySheets().catch(console.error);
});

// Monthly Drive archive — 1st of every month at 3am
cron.schedule(config.cron.monthlyArchive, () => {
  console.log('[Cron] Running monthly Drive archive...');
  runMonthlyArchive().catch(console.error);
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   WhatsApp CRM Backend                  ║
║   Port:     ${String(config.port).padEnd(27)}║
║   Sheets:   ${(config.features.googleSheets ? 'enabled' : 'disabled').padEnd(27)}║
║   Archive:  ${(config.features.googleDriveArchive ? 'enabled' : 'disabled').padEnd(27)}║
║   Insights: ${(config.features.insightsPipeline ? 'enabled' : 'disabled').padEnd(27)}║
╚══════════════════════════════════════════╝
  `);
  console.log(`[Server] Logs: ~/.pm2/logs/whatsapp-crm-*.log`);

  if (config.features.googleSheets) {
    verifySpreadsheetAccess()
      .then(({ title }) => console.log(`[Sheets] Connected: "${title}" (id: ${config.google.sheetsId})`))
      .catch((err) => {
        console.error(
          '[Sheets] Startup validation failed:',
          formatGoogleSheetsError(err, config.google.serviceAccountEmail)
        );
      });
  }
});
