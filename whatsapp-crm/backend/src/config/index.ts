import dotenv from 'dotenv';
dotenv.config();

import { normalizeSpreadsheetId } from '../google/normalize';

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export const config = {
  // WAHA
  waha: {
    baseUrl:       normalizeBaseUrl(process.env.WAHA_BASE_URL!),
    apiKey:        process.env.WAHA_API_KEY!,
    session:       process.env.WAHA_SESSION!,
    webhookSecret: process.env.WAHA_WEBHOOK_SECRET!,
    agentNameMap: (() => {
      try {
        return JSON.parse(process.env.AGENT_NAME_MAP || '{}') as Record<string, string>;
      } catch {
        console.warn('[Config] AGENT_NAME_MAP is not valid JSON — using empty map');
        return {} as Record<string, string>;
      }
    })(),
  },

  // AI
  ai: {
    openRouterApiKey:     process.env.OPENROUTER_API_KEY || '',
    openRouterModel:      process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct',
    openRouterBaseUrl:    process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    geminiApiKey:         process.env.GEMINI_API_KEY!,
    geminiModel:          process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    classifierMsgCount:   parseInt(process.env.CLASSIFIER_MESSAGE_COUNT || '8'),
    insightsBatchSize:    parseInt(process.env.INSIGHTS_BATCH_SIZE || '50'),
    maxTranscriptChars:   parseInt(process.env.MAX_TRANSCRIPT_CHARS || '12000'),
  },

  // Supabase
  supabase: {
    url:        process.env.SUPABASE_URL!,
    anonKey:    process.env.SUPABASE_ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
  },

  // Google (only required when Sheets or Drive features are enabled)
  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey:          (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    sheetsId:            normalizeSpreadsheetId(process.env.GOOGLE_SHEETS_ID || ''),
    driveFolderId:       process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  },

  // Feature flags — all toggleable via .env, no code changes needed
  features: {
    googleSheets:       process.env.ENABLE_GOOGLE_SHEETS !== 'false',
    googleDriveArchive: process.env.ENABLE_GOOGLE_DRIVE_ARCHIVE !== 'false',
    insightsPipeline:   process.env.ENABLE_INSIGHTS_PIPELINE !== 'false',
    dashboard:          process.env.ENABLE_DASHBOARD !== 'false',
  },

  // Cron schedules
  cron: {
    insights:       process.env.INSIGHTS_CRON || '0 */6 * * *',
    weeklySheets:   process.env.WEEKLY_SHEETS_CRON || '30 3 * * 1',
    monthlyArchive: process.env.MONTHLY_ARCHIVE_CRON || '0 3 1 * *',
  },

  // Server
  port:        parseInt(process.env.PORT || '3001'),
  isDev:       process.env.NODE_ENV !== 'production',
  adminApiKey: process.env.ADMIN_API_KEY || '',

  // Business context
  business: {
    type:     process.env.BUSINESS_TYPE || 'sales',
    language: process.env.BUSINESS_LANGUAGE || 'hinglish',
  },
};

// Validate required vars on startup — crash early with a clear message
const required = [
  'WAHA_BASE_URL', 'WAHA_API_KEY', 'WAHA_SESSION',
  'OPENROUTER_API_KEY', 'GEMINI_API_KEY',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (process.env.NODE_ENV === 'production') {
  const prodSecurity = ['WAHA_WEBHOOK_SECRET', 'ADMIN_API_KEY'] as const;
  for (const key of prodSecurity) {
    const val = process.env[key];
    if (!val || val.includes('your-')) {
      throw new Error(`Missing required environment variable in production: ${key}`);
    }
  }
}
