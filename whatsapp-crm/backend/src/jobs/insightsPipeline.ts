import { config } from '../config';
import { fetchUnprocessedChats, markChatProcessed, updateChatTranscript } from '../database/chats';
import { getInsightByChatId, upsertInsight } from '../database/insights';
import { getProfile, upsertProfile } from '../database/profiles';
import { callGroq } from '../ai/groq';
import { callGemini, AIResponse } from '../ai/gemini';
import { prompts } from '../ai/prompts';
import { fetchFullTranscript } from '../waha/client';

const INSIGHTS_MAX_TOKENS = 2048;
const PROFILE_MAX_TOKENS = 1024;

function truncateTranscript(transcript: string): string {
  const max = config.ai.maxTranscriptChars;
  if (transcript.length <= max) return transcript;
  console.warn(`[Insights] Transcript truncated from ${transcript.length} to ${max} chars (keeping most recent)`);
  return transcript.slice(-max);
}

async function callAI(prompt: string, maxTokens: number): Promise<AIResponse> {
  try {
    return await callGroq(prompt, maxTokens);
  } catch (groqErr) {
    const groqMsg = groqErr instanceof Error ? groqErr.message : String(groqErr);
    console.warn(`[Insights] Groq failed, trying Gemini: ${groqMsg}`);
    return await callGemini(prompt, maxTokens);
  }
}

export async function runInsightsPipeline(): Promise<void> {
  if (!config.features.insightsPipeline) {
    console.log('[Insights] Pipeline disabled via feature flag');
    return;
  }

  console.log('[Insights] Starting pipeline...');
  const chats = await fetchUnprocessedChats(config.ai.insightsBatchSize);

  if (chats.length === 0) {
    console.log('[Insights] No unprocessed chats found');
    return;
  }

  console.log(`[Insights] Processing ${chats.length} chats...`);
  let success = 0;
  let failed  = 0;

  for (const chat of chats) {
    try {
      const fullMessages = await fetchFullTranscript(chat.chat_id);

      let transcript: string;
      if (fullMessages.length > 0) {
        transcript = fullMessages.join('\n');
        await updateChatTranscript(chat.id, fullMessages.join(' | '), fullMessages.length);
      } else {
        transcript = chat.transcript || '';
        console.warn(`[Insights] WAHA returned empty for ${chat.chat_id}, using DB transcript`);
      }

      if (!transcript.trim()) {
        console.warn(`[Insights] No transcript available for ${chat.chat_id}, skipping`);
        failed++;
        continue;
      }

      transcript = truncateTranscript(transcript);

      const prompt = prompts.insights(
        transcript,
        chat.contact_name || 'Unknown',
        chat.agent_name   || 'Unknown'
      );

      const result = await callAI(prompt, INSIGHTS_MAX_TOKENS);

      const existingInsight = await getInsightByChatId(chat.chat_id);
      const isFirstTimeProcessing = !existingInsight;

      await upsertInsight({
        chat_id:            chat.chat_id,
        agent_name:         chat.agent_name,
        contact_name:       chat.contact_name,
        chat_date:          chat.chat_date,
        customer_intent:    result.customerIntent || '',
        sentiment:          result.sentiment || 'neutral',
        sentiment_reason:   result.sentimentReason || '',
        deal_stage:         result.dealStage || 'cold',
        follow_up_action:   result.followUpAction || '',
        follow_up_deadline: result.followUpDeadline || '',
        key_summary:        result.keySummary || '',
      });

      await markChatProcessed(chat.id);
      success++;

      try {
        const existingProfile = await getProfile(chat.chat_id);

        const totalChats = isFirstTimeProcessing
          ? (existingProfile?.total_chats || 0) + 1
          : (existingProfile?.total_chats || 0);

        const profilePrompt = prompts.profileUpdate(
          existingProfile?.cumulative_summary || null,
          {
            customerIntent:  result.customerIntent || '',
            sentiment:       result.sentiment || 'neutral',
            dealStage:       result.dealStage || 'cold',
            followUpAction:  result.followUpAction || '',
            keySummary:      result.keySummary || '',
          },
          chat.contact_name || 'Unknown',
          totalChats
        );

        const profileUpdate = await callAI(profilePrompt, PROFILE_MAX_TOKENS);

        // Always use most recent agent — most relevant for follow-up routing
        const preferredAgent = chat.agent_name;

        await upsertProfile({
          chat_id:             chat.chat_id,
          contact_name:        chat.contact_name || existingProfile?.contact_name || 'Unknown',
          agent_name:          chat.agent_name,
          cumulative_summary:  profileUpdate.cumulativeSummary || '',
          current_deal_stage:  result.dealStage || 'cold',
          overall_sentiment:   profileUpdate.overallSentiment || result.sentiment || 'neutral',
          total_chats:         totalChats,
          hot_lead_count:      result.dealStage === 'hot'
                                 ? (existingProfile?.hot_lead_count || 0) + 1
                                 : (existingProfile?.hot_lead_count || 0),
          products_interested: profileUpdate.productsInterested || '',
          last_purchase:       profileUpdate.lastPurchase || existingProfile?.last_purchase || '',
          key_concerns:        profileUpdate.keyConcerns || '',
          preferred_agent:     preferredAgent,
          first_seen:          existingProfile?.first_seen || chat.chat_date,
          last_active:         chat.chat_date,
        });

        console.log(`[Insights] Profile updated for: ${chat.contact_name} (${chat.chat_id})`);

      } catch (profileErr) {
        const profileMsg = profileErr instanceof Error ? profileErr.message : String(profileErr);
        console.error(`[Insights] Profile update failed for ${chat.chat_id}: ${profileMsg}`);
      }

      await new Promise(r => setTimeout(r, 4000));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Insights] Failed for chat ${chat.chat_id}: ${msg}`);
      failed++;
    }
  }

  console.log(`[Insights] Done — ${success} succeeded, ${failed} failed`);
}
