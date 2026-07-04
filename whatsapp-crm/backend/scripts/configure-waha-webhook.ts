/**
 * Update WAHA session webhook — run: npx tsx scripts/configure-waha-webhook.ts [webhook-url]
 *
 * Appends ?secret= from WAHA_WEBHOOK_SECRET automatically.
 * Example: npx tsx scripts/configure-waha-webhook.ts http://127.0.0.1:3001/webhook
 */
import dotenv from 'dotenv';
import path from 'path';
import { buildWebhookUrl } from '../src/utils/webhookUrl';
import { config } from '../src/config';

dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

const rawUrl =
  process.argv[2] ||
  `http://127.0.0.1:${process.env.PORT || '3001'}/webhook`;

const secret = process.env.WAHA_WEBHOOK_SECRET;
const webhookUrl = secret ? buildWebhookUrl(rawUrl, secret) : rawUrl;

if (!secret || secret.includes('your-')) {
  console.warn('Warning: WAHA_WEBHOOK_SECRET not set — webhook URL will have no ?secret= param');
}

const base = config.waha.baseUrl;
const apiKey = config.waha.apiKey;
const session = config.waha.session;

function wahaApiUrl(apiPath: string): string {
  return new URL(apiPath, base).href;
}

async function main() {
  // Fetch current session config so we don't wipe other settings
  const getRes = await fetch(wahaApiUrl(`/api/sessions/${session}`), {
    headers: { 'X-Api-Key': apiKey },
  });
  if (!getRes.ok) {
    throw new Error(`Failed to fetch session: ${getRes.status} ${await getRes.text()}`);
  }

  const current = await getRes.json() as { config?: Record<string, unknown> };
  const existingConfig = current.config || {};

  const newConfig = {
    ...existingConfig,
    webhooks: [
      {
        url: webhookUrl,
        events: ['message'],
      },
    ],
    ignore: {
      groups: true,
      ...(existingConfig.ignore as object || {}),
    },
  };

  const putRes = await fetch(wahaApiUrl(`/api/sessions/${session}`), {
    method: 'PUT',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ config: newConfig }),
  });

  if (!putRes.ok) {
    throw new Error(`Failed to update session: ${putRes.status} ${await putRes.text()}`);
  }

  // Verify
  const verifyRes = await fetch(wahaApiUrl(`/api/sessions/${session}`), {
    headers: { 'X-Api-Key': apiKey },
  });
  const verified = await verifyRes.json() as {
    status?: string;
    config?: { webhooks?: Array<{ url: string; events: string[] }> };
  };

  console.log('\n✓ WAHA webhook updated successfully\n');
  console.log('Session status:', verified.status);
  console.log('Webhooks:');
  for (const wh of verified.config?.webhooks || []) {
    console.log(`  → ${wh.url}`);
    console.log(`    events: ${wh.events.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
