import { google, sheets_v4 } from 'googleapis';
import { config } from '../config';

const HEADERS = [
  'Date', 'Contact', 'Agent', 'Customer Intent',
  'Sentiment', 'Deal Stage', 'Follow-Up Action',
  'Follow-Up Deadline', 'Summary',
];

function getAuth() {
  return new google.auth.JWT(
    config.google.serviceAccountEmail,
    undefined,
    config.google.privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}

/** Verify the configured spreadsheet exists and is accessible. */
export async function verifySpreadsheetAccess(): Promise<{ title: string }> {
  if (!config.google.sheetsId) {
    throw new Error('GOOGLE_SHEETS_ID is not set');
  }

  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res    = await sheets.spreadsheets.get({
    spreadsheetId: config.google.sheetsId,
    fields:        'properties.title',
  });

  return { title: res.data.properties?.title || 'untitled' };
}

async function tabExists(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string
): Promise<boolean> {
  const spreadsheet = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const titles = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
  return titles.includes(tabName);
}

export async function appendToSheet(tabName: string, insights: any[]): Promise<void> {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const exists = await tabExists(sheets, config.google.sheetsId, tabName);

  if (!exists) {
    // Create the tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.google.sheetsId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: tabName }
          }
        }]
      }
    });

    // Write headers on new tab
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.google.sheetsId,
      range:         `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [HEADERS]
      }
    });
  }

  // Append insight rows
  const rows = insights.map(i => [
    i.chat_date          ? new Date(i.chat_date).toLocaleDateString('en-IN') : '',
    i.contact_name       || '',
    i.agent_name         || '',
    i.customer_intent    || '',
    i.sentiment          || '',
    i.deal_stage         || '',
    i.follow_up_action   || '',
    i.follow_up_deadline || '',
    i.key_summary        || '',
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.google.sheetsId,
    range:         `${tabName}!A2`,
    valueInputOption: 'RAW',
    requestBody: { values: rows }
  });
}
