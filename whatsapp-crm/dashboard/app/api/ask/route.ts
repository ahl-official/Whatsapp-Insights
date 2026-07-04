import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an AI assistant for AHL's WhatsApp CRM team in India.
You have access to real CRM data and answer questions about sales performance,
customer interactions, agent performance, and deal pipelines.

Rules:
- Answer in clear, direct business English
- Be specific — use actual names, numbers, and percentages from the data
- If the data is empty, say so clearly and explain why
- Keep answers concise but complete — no unnecessary padding
- For comparisons, always state who is best and who needs improvement
- Flag urgent items (hot leads, pending follow-ups) prominently
- When mentioning agents, be respectful but honest about performance gaps
- If a chart would help, end your response with a JSON block for chart data
- Use conversation history for follow-up questions when relevant

Chart JSON format (only include if a chart genuinely helps):
<chart>
{
  "type": "bar" | "pie",
  "title": "Chart title",
  "data": [
    { "label": "Agent Name", "value": 24, "color": "#6366f1" }
  ]
}
</chart>

Use these colors for deal stages:
- hot: #ef4444
- warm: #f97316
- cold: #6b7280
- positive: #22c55e
- neutral: #f59e0b
- negative: #ef4444`;

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
    const { question, data, dataType, history } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
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

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: isConversation ? 1500 : 1000,
        temperature: 0.3,
        messages,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content ?? 'No response generated.';

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
