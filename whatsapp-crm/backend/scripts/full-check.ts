import dotenv from 'dotenv';
import path from 'path';
import { config } from '../src/config';

dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

interface Result { name: string; ok: boolean; detail: string }

const results: Result[] = [];
const ok = (n: string, d: string) => results.push({ name: n, ok: true, detail: d });
const fail = (n: string, d: string) => results.push({ name: n, ok: false, detail: d });

function baseUrl(): string {
  return config.waha.baseUrl;
}

async function main() {
  console.log('\n=== Full ENV + WAHA Sync Check ===\n');

  // ── Env placeholders ──
  const placeholders: string[] = [];
  if (!process.env.WAHA_API_KEY || process.env.WAHA_API_KEY.includes('your-')) placeholders.push('WAHA_API_KEY');
  if (!process.env.GROQ_API_KEY?.startsWith('gsk_')) placeholders.push('GROQ_API_KEY');
  if (!process.env.GEMINI_API_KEY) placeholders.push('GEMINI_API_KEY');
  if (!process.env.SUPABASE_URL) placeholders.push('SUPABASE_URL');
  if (process.env.GOOGLE_DRIVE_FOLDER_ID?.includes('your-')) placeholders.push('GOOGLE_DRIVE_FOLDER_ID');

  if (placeholders.length) fail('Env placeholders', placeholders.join(', '));
  else ok('Env placeholders', 'All required keys are filled in');

  // ── Supabase tables ──
  const sbKey = process.env.SUPABASE_SERVICE_KEY!;
  const sbHdr = { apikey: sbKey, Authorization: `Bearer ${sbKey}` };
  const sbUrl = process.env.SUPABASE_URL!;

  for (const table of ['customer_chats', 'chat_insights', 'customer_profiles']) {
    try {
      const r = await fetch(`${sbUrl}/rest/v1/${table}?select=id&limit=1`, { headers: sbHdr });
      if (r.ok) ok(`Supabase: ${table}`, `reachable (${r.status})`);
      else fail(`Supabase: ${table}`, `HTTP ${r.status}`);
    } catch (e) {
      fail(`Supabase: ${table}`, String(e));
    }
  }

  // ── Groq ──
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 5, messages: [{ role: 'user', content: 'ok' }] }),
    });
    if (r.ok) ok('Groq API', 'valid');
    else fail('Groq API', `HTTP ${r.status}`);
  } catch (e) { fail('Groq API', String(e)); }

  // ── Gemini ──
  try {
    const key = process.env.GEMINI_API_KEY!;
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'ok' }] }], generationConfig: { maxOutputTokens: 5 } }) }
    );
    if (r.ok) ok('Gemini API', 'valid (gemini-2.5-flash)');
    else fail('Gemini API', `HTTP ${r.status}: ${(await r.text()).slice(0, 80)}`);
  } catch (e) { fail('Gemini API', String(e)); }

  // ── Google Sheets ──
  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      undefined,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID!, fields: 'properties.title' });
    ok('Google Sheets', `accessible: "${res.data.properties?.title}"`);
  } catch (e: unknown) {
    fail('Google Sheets', (e instanceof Error ? e.message : String(e)).slice(0, 120));
  }

  // ── Google Drive ──
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  if (folderId.includes('your-')) {
    fail('Google Drive', 'GOOGLE_DRIVE_FOLDER_ID still placeholder');
  } else {
    try {
      const { google } = await import('googleapis');
      const auth = new google.auth.JWT(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
        undefined,
        (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/drive.readonly']
      );
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.get({ fileId: folderId, fields: 'name' });
      ok('Google Drive', `folder: "${res.data.name}"`);
    } catch (e: unknown) {
      fail('Google Drive', (e instanceof Error ? e.message : String(e)).slice(0, 120));
    }
  }

  // ── WAHA connectivity ──
  const wahaBase = baseUrl();
  const wahaKey = process.env.WAHA_API_KEY!;
  const session = process.env.WAHA_SESSION!;
  const wahaHdr = { 'X-Api-Key': wahaKey };

  if (!wahaBase) {
    fail('WAHA server', 'WAHA_BASE_URL not set');
  } else {
    ok('WAHA config', `URL=${wahaBase}, session=${session}, key set`);

    let wahaReachable = false;

    for (const path of ['/api/health', '/api/server/status', `/api/sessions/${session}`]) {
      try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 15000);
        const r = await fetch(`${wahaBase}${path}`, { headers: wahaHdr, signal: c.signal });
        clearTimeout(t);
        const body = await r.text();
        if (r.ok) {
          wahaReachable = true;
          ok(`WAHA ${path}`, `HTTP ${r.status}`);
          if (path.includes('sessions')) {
            try {
              const data = JSON.parse(body);
              const status = data.status || data.state || JSON.stringify(data).slice(0, 100);
              ok('WAHA session status', String(status));

              // Check webhook config
              const webhooks = data.config?.webhooks || data.webhooks || [];
              if (Array.isArray(webhooks) && webhooks.length > 0) {
                const urls = webhooks.map((w: { url?: string; events?: string[] }) =>
                  `${w.url} [${(w.events || []).join(',')}]`
                ).join('; ');
                ok('WAHA webhooks configured', urls);
              } else {
                fail('WAHA webhooks', 'No webhooks found on session — backend will not receive messages');
              }
            } catch {
              ok('WAHA session', body.slice(0, 100));
            }
          }
        } else if (r.status === 401) {
          fail(`WAHA ${path}`, 'HTTP 401 — API key rejected');
        } else {
          fail(`WAHA ${path}`, `HTTP ${r.status}: ${body.slice(0, 80)}`);
        }
      } catch (e: unknown) {
        const err = e as { cause?: { code?: string }; message?: string };
        fail(`WAHA ${path}`, err.cause?.code || err.message || String(e));
      }
    }

    if (!wahaReachable) {
      fail('WAHA summary', 'Server unreachable from this machine — credentials cannot be verified remotely');
    }
  }

  // ── Local backend ──
  try {
    const r = await fetch('http://localhost:3001/health', { signal: AbortSignal.timeout(3000) });
    if (r.ok) ok('Local backend', 'running on port 3001');
    else fail('Local backend', `HTTP ${r.status}`);
  } catch {
    fail('Local backend', 'not running — start with: cd backend && npm run dev');
  }

  // ── Print results ──
  console.log('');
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.name}`);
    console.log(`  ${r.detail}\n`);
  }

  const failed = results.filter(r => !r.ok).length;
  console.log(failed === 0 ? 'All checks passed!' : `${failed} check(s) need attention.`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
