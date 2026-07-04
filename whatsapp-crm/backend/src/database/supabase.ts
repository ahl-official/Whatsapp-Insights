import { config } from '../config';

// Two clients — anon for reads, service for writes/deletes
export function supabaseHeaders(useServiceKey = false) {
  const key = useServiceKey ? config.supabase.serviceKey : config.supabase.anonKey;
  return {
    'Content-Type':  'application/json',
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
  };
}

export async function supabaseGet(endpoint: string): Promise<any[]> {
  const res = await fetch(`${config.supabase.url}${endpoint}`, {
    headers: supabaseHeaders(),
  });
  if (!res.ok) throw new Error(`Supabase GET failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<any[]>;
}

export async function supabasePost(endpoint: string, body: object, extraHeaders: Record<string, string> = {}): Promise<void> {
  const res = await fetch(`${config.supabase.url}${endpoint}`, {
    method:  'POST',
    headers: { ...supabaseHeaders(true), 'Prefer': 'return=minimal', ...extraHeaders },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST failed: ${res.status} ${await res.text()}`);
}

export async function supabasePatch(endpoint: string, body: object): Promise<void> {
  const res = await fetch(`${config.supabase.url}${endpoint}`, {
    method:  'PATCH',
    headers: { ...supabaseHeaders(true), 'Prefer': 'return=minimal' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH failed: ${res.status} ${await res.text()}`);
}
