import { config } from '../config';

export const prompts = {

  // ── CUSTOMER CLASSIFIER ──────────────────────────────────────────────
  classifier: (transcript: string, contactName: string): string => `
You are a chat classifier for an Indian ${config.business.type} CRM team.
The conversations are in English, Hindi, or Hinglish (mix of both).

Decide if this WhatsApp conversation is with a CUSTOMER or a PERSONAL/INTERNAL contact.

CUSTOMER signals — classify as customer if you see:
- Questions about products, pricing, availability, stock
- Requests for quotes, demos, samples, or catalogs
- Discussion of orders, deliveries, invoices, or payments
- Hinglish sales phrases: "price kya hai", "kab milega", "demo chahiye",
  "kitna doge", "order karna hai", "available hai kya", "rate batao"
- After-sales queries, complaints about a purchase, warranty questions

NOT a customer — classify as personal/internal if you see:
- Casual personal conversation (family, friends, social plans)
- Internal team messages (shifts, attendance, office logistics)
- Spam, automated promotional blasts, OTP messages
- Very short ambiguous chats with zero commercial intent
- Generic greetings with no follow-up content

Contact name: ${contactName}

Conversation transcript (most recent ${config.ai.classifierMsgCount} messages):
---
${transcript}
---

Reply with ONLY a valid JSON object. No markdown, no backticks, no explanation:
{"isCustomer": true, "reason": "one short sentence explaining why"}
`,

  // ── INSIGHT EXTRACTOR ────────────────────────────────────────────────
  insights: (transcript: string, contactName: string, agentName: string): string => `
You are a CRM analyst for an Indian ${config.business.type} team.
Analyse this WhatsApp customer conversation (may be in English, Hindi, or Hinglish)
and extract structured sales insights.

Contact name: ${contactName}
Agent name: ${agentName}

Full conversation transcript:
---
${transcript}
---

Deal stage guide:
- hot  = strong buying intent — asked for invoice, final price, payment details, or said yes
- warm = interested but not committed — asked multiple questions, requested demo or sample
- cold = early stage — vague inquiry, just browsing, no strong buying signal yet

Follow-up deadline guide:
- "urgent (today)"       = customer is waiting, hot lead, needs immediate action
- "soon (2-3 days)"      = warm lead, follow up this week
- "later (this week)"    = cold lead, low urgency
- "no follow-up needed"  = resolved, spam, or personal chat

Reply with ONLY a valid JSON object. No markdown, no backticks, no explanation:
{
  "customerIntent":    "What the customer wants to buy or is asking about (1 sentence)",
  "sentiment":         "positive" | "neutral" | "negative",
  "sentimentReason":   "Why you assigned this sentiment (1 sentence)",
  "dealStage":         "hot" | "warm" | "cold",
  "followUpAction":    "Specific action the agent should take next (1 sentence)",
  "followUpDeadline":  "urgent (today)" | "soon (2-3 days)" | "later (this week)" | "no follow-up needed",
  "keySummary":        "2-3 sentence summary of the entire conversation and outcome"
}
`,

  // ── CUSTOMER PROFILE UPDATER ─────────────────────────────────────────
  profileUpdate: (
    previousSummary: string | null,
    newInsight: {
      customerIntent:    string;
      sentiment:         string;
      dealStage:         string;
      followUpAction:    string;
      keySummary:        string;
    },
    contactName: string,
    totalChats: number
  ): string => `
You are a CRM analyst maintaining a long-term customer profile for an Indian ${config.business.type} team.

Customer name: ${contactName}
Total interactions so far: ${totalChats}

${previousSummary
  ? `Previous cumulative summary:\n"${previousSummary}"`
  : `This is the first interaction with this customer.`
}

New interaction insight:
- Intent: ${newInsight.customerIntent}
- Sentiment: ${newInsight.sentiment}
- Deal stage: ${newInsight.dealStage}
- Follow-up needed: ${newInsight.followUpAction}
- Summary: ${newInsight.keySummary}

Your job is to update the customer profile by combining the previous context with the new interaction.

Reply with ONLY a valid JSON object. No markdown, no backticks, no explanation:
{
  "cumulativeSummary":   "A clear narrative of the full customer relationship history — who they are, what they want, how engaged they are, any key events (orders, complaints, demos). Write in present tense as if briefing a new agent. Be thorough and detailed.",
  "productsInterested":  "Comma-separated list of all products or categories they have shown interest in across all interactions",
  "lastPurchase":        "Most recent confirmed purchase if any, or null if no purchase yet",
  "keyConcerns":         "Any recurring concerns, preferences, or patterns noticed — e.g. price sensitivity, preferred payment method, delivery requirements",
  "overallSentiment":    "positive" | "neutral" | "negative" based on the general trend across all interactions
}
`,

};
