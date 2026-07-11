import { Router, Request, Response } from 'express';
import { isGroupOrBroadcast } from '../filters/groupFilter';
import { classifyChat } from '../filters/customerFilter';
import { fetchRecentMessages } from '../waha/client';
import { saveChat } from '../database/chats';
import { config } from '../config';
import { isWebhookAuthorized } from '../middleware/auth';

export const wahaRouter = Router();

wahaRouter.post('/webhook', async (req: Request, res: Response) => {
  if (!isWebhookAuthorized(req)) {
    console.warn('[Webhook] Rejected — invalid or missing webhook secret');
    res.status(401).json({ status: 'unauthorized' });
    return;
  }

  // Respond 200 immediately so WAHA doesn't retry valid deliveries
  res.status(200).json({ status: 'received' });

  let chatId: string | undefined;

  try {
    const payload = req.body;
    const event       = payload?.event ?? 'unknown';
    chatId            = payload?.payload?.from || payload?.payload?.chatId;
    let contactName   = payload?.payload?.pushName || 'Unknown';
    const lastMessage = payload?.payload?.body || '';

    console.log(
      `[Webhook] Incoming: pushName="${contactName}" from="${chatId ?? 'unknown'}" event="${event}"`
    );

    // Only process incoming message events
    if (payload.event !== 'message') {
      console.log(`[Webhook] Skipped — not a message event: ${event}`);
      return;
    }

    const sessionName = payload?.session || config.waha.session;
    const agentId = config.waha.agentNameMap[sessionName] || sessionName;

    if (!chatId) {
      console.log('[Webhook] Skipped — missing chatId');
      return;
    }

    // Try to resolve contact name for @lid format IDs
    if ((!contactName || contactName === 'Unknown') && chatId.endsWith('@lid')) {
      try {
        const lidUrl = new URL(
          `/api/${sessionName}/lids/${encodeURIComponent(chatId)}`,
          config.waha.baseUrl
        );
        const lidRes = await fetch(lidUrl.toString(), {
          headers: { 'X-Api-Key': config.waha.apiKey },
        });
        if (lidRes.ok) {
          const lidData = (await lidRes.json()) as { pn?: string };
          if (lidData?.pn) {
            // pn contains the full phone number e.g. "919372584918@c.us"
            // Extract just the number part without @c.us
            const phone = String(lidData.pn).replace('@c.us', '');
            contactName = phone;
            console.log(`[Webhook] Resolved @lid: ${chatId} → ${contactName}`);
          }
        }
      } catch {
        // Keep Unknown if resolution fails
      }
    }

    if ((!contactName || contactName === 'Unknown') && payload?.payload?._notifyName) {
      contactName = payload.payload._notifyName;
    }

    // ── Filter 1: Drop groups and broadcasts ──────────────────────────
    if (isGroupOrBroadcast(chatId)) {
      console.log(`[Filter] Group/broadcast skipped: ${chatId}`);
      return;
    }

    // ── Filter 2: AI customer classification ──────────────────────────
    console.log(`[Filter] Fetching message history for: ${chatId} (${contactName})`);
    let messages = await fetchRecentMessages(chatId);
    console.log(`[Filter] WAHA returned ${messages.length} messages for: ${chatId}`);

    if (messages.length === 0) {
      // New contact — WAHA has no history yet
      if (lastMessage && lastMessage.trim().length > 0) {
        console.log(
          `[Filter] New contact — using payload message for classification: ${chatId} (${contactName})`
        );
        messages = [`Customer: ${lastMessage.trim()}`];
      } else {
        console.log(
          `[Filter] Skipped — new contact with no message body: ${chatId} (${contactName})`
        );
        return;
      }
    }

    const classification = await classifyChat(messages, contactName);
    console.log(`[Filter] Classifying: ${chatId} (${contactName}) via ${classification.classifier}`);

    if (!classification.isCustomer) {
      console.log(
        `[Filter] ⏭️  Personal/skipped: ${contactName} (${chatId}) — ${classification.reason} [via ${classification.classifier}]`
      );
      return;
    }

    console.log(
      `[Filter] ✅ Customer confirmed: ${contactName} (${chatId}) — ${classification.reason} [via ${classification.classifier}]`
    );

    // ── Store in Supabase (upsert on chat_id) ─────────────────────────
    const transcriptToSave =
      messages.length > 0 ? messages.join(' | ') : `Customer: ${lastMessage}`;

    await saveChat({
      chat_id:       chatId,
      agent_name:    agentId,
      contact_name:  contactName,
      last_message:  lastMessage,
      transcript:    transcriptToSave,
      message_count: messages.length || 1,
      chat_date:     new Date().toISOString(),
    });

    console.log(`[Webhook] ✅ Saved customer chat: ${contactName} (${chatId})`);

  } catch (err: any) {
    console.error(
      `[Webhook] ❌ Error processing message for ${chatId ?? 'unknown'}: ${err?.message ?? err}`
    );
  }
});
