import { callGemini } from '../src/ai/gemini';

callGemini('Reply with only valid JSON: {"isCustomer":true,"reason":"test"}')
  .then((r) => console.log('Gemini 2.5-flash OK:', JSON.stringify(r)))
  .catch((e) => {
    console.log('FAIL:', e.message);
    process.exit(1);
  });
