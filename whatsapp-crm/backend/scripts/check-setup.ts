/**
 * One-off connectivity check — run: npx tsx scripts/check-setup.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { config } from '../src/config';

dotenv.config({ path: path.join(__dirname, '../.env') });

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function pass(name: string, detail: string) {
  results.push({ name, ok: true, detail });
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
}

function isPlaceholder(val: string | undefined, placeholders: string[]): boolean {
  if (!val) return true;
  return placeholders.some((p) => val === p || val.includes('your-'));
}

async function checkEnv() {
  const issues: string[] = [];
  if (isPlaceholder(process.env.WAHA_API_KEY, ['your-waha-api-key'])) issues.push('WAHA_API_KEY');
  if (isPlaceholder(process.env.WAHA_WEBHOOK_SECRET, ['your-random-secret-here'])) issues.push('WAHA_WEBHOOK_SECRET');
  if (isPlaceholder(process.env.ADMIN_API_KEY, ['your-random-admin-key-here'])) issues.push('ADMIN_API_KEY');
  if (isPlaceholder(process.env.GOOGLE_DRIVE_FOLDER_ID, ['your-drive-folder-id'])) issues.push('GOOGLE_DRIVE_FOLDER_ID');
  if (isPlaceholder(process.env.GOOGLE_SHEETS_ID, ['your-google-sheet-id'])) issues.push('GOOGLE_SHEETS_ID');
  if (!process.env.GROQ_API_KEY?.startsWith('gsk_')) issues.push('GROQ_API_KEY format looks wrong');
  if (!process.env.GEMINI_API_KEY?.trim()) issues.push('GEMINI_API_KEY is missing');

  if (issues.length === 0) pass('Environment variables', 'All required keys appear filled in');
  else fail('Environment variables', `Still need fixing: ${issues.join(', ')}`);
}

async function checkSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  try {
    const res = await fetch(`${url}/rest/v1/customer_chats?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok) pass('Supabase', `Connected — customer_chats table reachable (${res.status})`);
    else fail('Supabase', `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  } catch (e) {
    fail('Supabase', String(e));
  }
}

async function checkWaha() {
  const key = config.waha.apiKey;
  const session = config.waha.session;
  if (isPlaceholder(key, ['your-waha-api-key'])) {
    fail('WAHA', 'WAHA_API_KEY is still the placeholder — update it in .env');
    return;
  }
  try {
    const url = new URL(`/api/sessions/${session}`, config.waha.baseUrl).href;
    const res = await fetch(url, {
      headers: { 'X-Api-Key': key },
    });
    if (res.ok) {
      const data = await res.json() as { status?: string; name?: string };
      pass('WAHA', `Session "${session}" status: ${data.status ?? 'connected'}`);
    } else fail('WAHA', `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  } catch (e) {
    fail('WAHA', String(e));
  }
}

async function checkGroq() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with only: ok' }],
      }),
    });
    if (res.ok) pass('Groq API', 'API key valid — test completion succeeded');
    else fail('Groq API', `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  } catch (e) {
    fail('Groq API', String(e));
  }
}

async function checkGemini() {
  const key = process.env.GEMINI_API_KEY!;
  if (!key.startsWith('AIza') && !key.startsWith('AQ.')) {
    fail('Gemini API', 'Key format unrecognized — use a Google AI Studio API key');
    return;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with only: ok' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    if (res.ok) pass('Gemini API', 'API key valid — test completion succeeded');
    else fail('Gemini API', `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  } catch (e) {
    fail('Gemini API', String(e));
  }
}

async function checkGoogleSheets() {
  const sheetsIdRaw = process.env.GOOGLE_SHEETS_ID || '';
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

  if (isPlaceholder(sheetsIdRaw, ['your-google-sheet-id'])) {
    fail('Google Sheets', 'GOOGLE_SHEETS_ID is still the placeholder');
    return;
  }

  const { normalizeSpreadsheetId, formatGoogleSheetsError } = await import('../src/google/normalize');
  const sheetsId = normalizeSpreadsheetId(sheetsIdRaw);

  if (sheetsId !== sheetsIdRaw.trim()) {
    console.log(`  (normalized GOOGLE_SHEETS_ID → ${sheetsId})`);
  }

  const { google } = await import('googleapis');
  try {
    const auth = new google.auth.JWT(
      serviceEmail,
      undefined,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({
      spreadsheetId: sheetsId,
      fields: 'properties.title',
    });
    pass('Google Sheets', `Spreadsheet accessible: "${res.data.properties?.title}" (id: ${sheetsId})`);
  } catch (e: unknown) {
    fail('Google Sheets', formatGoogleSheetsError(e, serviceEmail));
  }
}

async function checkGoogleDrive() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  if (isPlaceholder(folderId, ['your-drive-folder-id'])) {
    fail('Google Drive', 'GOOGLE_DRIVE_FOLDER_ID is still the placeholder');
    return;
  }
  const { google } = await import('googleapis');
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      undefined,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive.readonly']
    );
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.get({ fileId: folderId, fields: 'name' });
    pass('Google Drive', `Folder accessible: "${res.data.name}"`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail('Google Drive', msg.slice(0, 200));
  }
}

async function main() {
  console.log('\n=== WhatsApp CRM Setup Check ===\n');
  await checkEnv();
  await checkSupabase();
  await checkWaha();
  await checkGroq();
  await checkGemini();
  await checkGoogleSheets();
  await checkGoogleDrive();

  console.log('');
  for (const r of results) {
    const icon = r.ok ? '✓' : '✗';
    console.log(`${icon} ${r.name}`);
    console.log(`  ${r.detail}\n`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0 ? 'All checks passed!' : `${failed} check(s) failed — fix the items above.`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
