import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY!.trim();

async function testModel(model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with only: ok' }] }],
      generationConfig: { maxOutputTokens: 5 },
    }),
  });
  const text = await res.text();
  console.log(`${model}: HTTP ${res.status}`);
  console.log(text.slice(0, 300));
  console.log('---');
  return res.status;
}

async function main() {
  const listRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
  );
  console.log(`List models: HTTP ${listRes.status}`);
  if (listRes.ok) {
    const data = await listRes.json() as { models?: Array<{ name: string }> };
    console.log('Available:', data.models?.slice(0, 6).map(m => m.name.replace('models/', '')).join(', '));
  } else {
    console.log((await listRes.text()).slice(0, 200));
  }
  console.log('---');

  for (const model of ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-8b']) {
    await testModel(model);
  }
}

main();
