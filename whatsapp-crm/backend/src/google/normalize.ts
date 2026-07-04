/** Extract spreadsheet ID from env value (ID only, or full Google Sheets URL). */
export function normalizeSpreadsheetId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl) return fromUrl[1];

  const idOnly = trimmed.match(/^([a-zA-Z0-9-_]+)/);
  return idOnly ? idOnly[1] : trimmed;
}

export function formatGoogleSheetsError(err: unknown, serviceAccountEmail?: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  const email = serviceAccountEmail || 'your service account email';

  if (/not found|404|Requested entity was not found/i.test(msg)) {
    return (
      `Spreadsheet not found. Use only the ID from the Sheet URL ` +
      `(e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms), not the full link. ` +
      `Share the sheet with ${email} as Editor.`
    );
  }

  if (/permission|403|forbidden/i.test(msg)) {
    return `Permission denied. Share the Google Sheet with ${email} as Editor.`;
  }

  return msg.slice(0, 300);
}
