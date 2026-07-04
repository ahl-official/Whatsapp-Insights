import { config } from '../config';

import { fetchUnsyncedInsights, markAllInsightsSynced } from '../database/insights';

import { appendToSheet } from '../google/sheets';



export async function runWeeklySheets(): Promise<void> {

  if (!config.features.googleSheets) {

    console.log('[Sheets] Disabled via feature flag');

    return;

  }



  console.log('[Sheets] Starting weekly sync...');

  const insights = await fetchUnsyncedInsights();



  if (insights.length === 0) {

    console.log('[Sheets] No unsynced insights to write');

    return;

  }



  const weekLabel = getWeekLabel();

  console.log(`[Sheets] Writing ${insights.length} rows to tab: ${weekLabel}`);



  try {

    // Step 1 — Write ALL rows to Sheets first

    await appendToSheet(weekLabel, insights);

    console.log(`[Sheets] ✅ Written ${insights.length} rows to ${weekLabel}`);



    // Step 2 — Bulk mark ALL as synced only after successful write

    // One request instead of one per row — prevents partial sync on crash

    const ids = insights.map((i: any) => i.id as number);

    await markAllInsightsSynced(ids);

    console.log(`[Sheets] ✅ Marked ${ids.length} insights as synced`);



  } catch (err) {

    // If sheet write fails nothing is marked synced — safe to retry

    console.error('[Sheets] ❌ Sync failed — no insights marked synced:', err);

    throw err;

  }

}



function getWeekLabel(): string {

  const now   = new Date();

  const year  = now.getFullYear();

  const week  = getWeekNumber(now);

  return `Week ${year}-W${String(week).padStart(2, '0')}`;

}



function getWeekNumber(date: Date): number {

  const d     = new Date(date);

  d.setHours(0, 0, 0, 0);

  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);

  const week1 = new Date(d.getFullYear(), 0, 4);

  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

}

