/** Build webhook URL with ?secret= for WAHA (WAHA does not send custom headers). */
export function buildWebhookUrl(baseUrl: string, secret?: string): string {
  const url = new URL(baseUrl);
  if (secret) {
    url.searchParams.set('secret', secret);
  }
  return url.toString();
}
