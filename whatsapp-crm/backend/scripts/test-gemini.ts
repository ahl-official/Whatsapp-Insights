import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const key = process.env.GEMINI_API_KEY?.trim();
if (!key) {
  console.log('FAIL: GEMINI_API_KEY is not set');
  process.exit(1);
}

const prefix = key.slice(0, 4);
console.log(`Key prefix: ${prefix}... (length: ${key.length})`);

async function tryEndpoint(label: string, url: string, options: RequestInit) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    if (res.ok) {
      console.log(`\n✓ ${label}`);
      console.log(`  HTTP ${res.status} — key works with this endpoint`);
      const parsed = JSON.parse(text);
      const reply = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) console.log(`  Response: ${reply.slice(0, 80)}`);
      return true;
    }
    console.log(`\n✗ ${label}`);
    console.log(`  HTTP ${res.status}: ${text.slice(0, 200)}`);
    return false;
  } catch (e) {
    console.log(`\n✗ ${label}`);
    console.log(`  Error: ${e}`);
    return false;
  }
}

async function main() {
  console.log('\n=== Gemini API Key Test ===\n');

  const tests = [
    tryEndpoint(
      'Query param auth — gemini-1.5-flash',
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with only the word: ok' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    ),
    tryEndpoint(
      'Query param auth — gemini-2.0-flash',
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with only the word: ok' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    ),
    tryEndpoint(
      'Bearer header auth — gemini-1.5-flash',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with only the word: ok' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    ),
    tryEndpoint(
      'x-goog-api-key header — gemini-1.5-flash',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with only the word: ok' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    ),
  ];

  const results = await Promise.all(tests);
  const anyOk = results.some(Boolean);

  console.log('\n--- Summary ---');
  if (anyOk) {
    console.log('At least one method worked — your key is valid.');
  } else {
    console.log('Key did not work with any standard Gemini endpoint.');
    console.log('Expected: a key from https://aistudio.google.com/apikey starting with AIza');
    console.log('Your key starts with "AQ." which is not a standard Google AI Studio API key format.');
  }
}

main();
