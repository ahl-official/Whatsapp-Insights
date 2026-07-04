import { config } from '../config';
import { fetchChatsForArchive } from '../database/chats';
import { supabasePatch } from '../database/supabase';
import { uploadToDrive } from '../google/drive';

export async function runMonthlyArchive(): Promise<void> {
  if (!config.features.googleDriveArchive) {
    console.log('[Archive] Drive archive disabled via ENABLE_GOOGLE_DRIVE_ARCHIVE=false');
    return;
  }

  console.log('[Archive] Starting monthly archive...');
  const chats = await fetchChatsForArchive();

  if (chats.length === 0) {
    console.log('[Archive] No chats to archive');
    return;
  }

  const month    = new Date().toISOString().slice(0, 7);
  const fileName = `whatsapp-archive-${month}.json`;
  const content  = JSON.stringify(chats, null, 2);

  try {
    await uploadToDrive(fileName, content);
    console.log(`[Archive] Uploaded ${chats.length} chats to Drive: ${fileName}`);

    // Mark transcripts as archived in Supabase (they'll be nulled by DB cron)
    for (const chat of chats) {
      await supabasePatch(`/rest/v1/customer_chats?id=eq.${chat.id}`, {
        transcript_archived: true,
      });
    }

    console.log('[Archive] Monthly archive complete');
  } catch (err) {
    console.error('[Archive] Failed:', err);
  }
}
