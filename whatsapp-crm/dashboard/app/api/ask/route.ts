import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an AI CRM analyst for AHL — an Indian hair replacement company.
You have access to real sales data and answer questions about agents, customers, leads, and performance.

RESPONSE RULES:
- Always start with a direct one-line answer to the question
- Use bullet points for lists — never write long paragraphs
- Bold important numbers and names using **bold**
- Always mention specific names, numbers, and percentages from the data
- If data is empty say so clearly in one sentence
- Keep responses concise — max 150 words of text
- Flag hot leads and urgent items prominently with 🔴
- Use ✅ for positive trends and ⚠️ for concerns

CHART RULES:
- Include a chart whenever comparing agents, products, sentiment, or deal stages
- For questions with "who", "most", "top", "compare", "breakdown", or "interested" — always include a chart
- Always end the response with the chart JSON if a chart is relevant
- Use these colors: hot=#ef4444, warm=#f97316, cold=#6b7280, positive=#22c55e, neutral=#f59e0b, negative=#ef4444
- type must be either "bar" or "pie" (pick one — never write "bar|pie" inside the JSON)
- Chart format (valid JSON only, no markdown fences):
<chart>{"type":"bar","title":"Hot Leads by Agent","data":[{"label":"Ninsi","value":5,"color":"#ef4444"},{"label":"Zoya","value":3,"color":"#f97316"}]}</chart>

CONTEXT:
- Business: AHL — hair replacement sales team in India
- Language: English with some Hinglish from customers
- Agents: AHL AI Team (Testing), Ninsi, Zoya, Rahul CRM, Mehjabeen CRM, Tejal, AHL Appointment`;

const CONVERSATION_PROMPT = `You are answering a question about a specific WhatsApp customer conversation.
You HAVE access to the chat transcript, insights, and customer profile provided in the data.
Do NOT say you lack access to conversation history when a transcript is included.
If the transcript is null or missing, say the transcript is unavailable and answer using saved insights and profile only.
If transcriptNote is present, mention that the answer is based on the available/recent portion of the transcript.

Structure your answer with these sections (omit empty sections):
Conversation Summary:
Customer Need:
Agent Response:
Sentiment:
Deal Stage:
Follow-up Needed:
Key Notes:

Base Sentiment and Deal Stage on insights data when available; use the transcript for the summary and what was said.`;

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();

    const { question, data, dataType, history } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
    }

    const isConversation = dataType === 'conversation';
    const systemPrompt = isConversation
      ? `${SYSTEM_PROMPT}\n\n${CONVERSATION_PROMPT}`
      : SYSTEM_PROMPT;

    const userMessage = isConversation
      ? `Question: ${question}

This is a conversation-specific question. Use the WhatsApp transcript when provided.

Data:
${JSON.stringify(data, null, 2)}`
      : `Question: ${question}

Data type: ${dataType}
Data:
${JSON.stringify(data, null, 2)}`;

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (Array.isArray(history)) {
      for (const msg of history as HistoryMessage[]) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://dashboard-rose-iota-52.vercel.app',
        'X-Title': 'WhatsApp CRM Dashboard',
      },
      body: JSON.stringify({
        model: (process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct').trim(),
        max_tokens: 1500,
        temperature: 0.3,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Ask] OpenRouter HTTP error:', response.status, errBody.slice(0, 300));
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content ?? 'No response generated.';

    return NextResponse.json({ answer });
  } catch (err) {
    console.error('[Ask] Unhandled error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
