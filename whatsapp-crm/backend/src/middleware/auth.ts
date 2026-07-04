import { timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isPlaceholderSecret(value: string): boolean {
  return !value || value === 'your-random-secret-here' || value.includes('your-');
}

/** WAHA webhook auth — secret via ?secret= query param or X-Webhook-Secret header. */
export function isWebhookAuthorized(req: Request): boolean {
  const secret = config.waha.webhookSecret;

  if (isPlaceholderSecret(secret)) {
    if (config.isDev) {
      console.warn('[Webhook] WAHA_WEBHOOK_SECRET not configured — allowing in development only');
      return true;
    }
    console.error('[Webhook] WAHA_WEBHOOK_SECRET is required in production');
    return false;
  }

  const querySecret =
    typeof req.query.secret === 'string' ? req.query.secret : '';
  const headerRaw = req.headers['x-webhook-secret'];
  const headerSecret = typeof headerRaw === 'string' ? headerRaw : '';

  return safeEqual(querySecret, secret) || safeEqual(headerSecret, secret);
}

/** Protects /run-insights and /status — requires X-Admin-Key header. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = config.adminApiKey;

  if (isPlaceholderSecret(expected)) {
    if (config.isDev) {
      console.warn('[Admin] ADMIN_API_KEY not configured — allowing in development only');
      next();
      return;
    }
    res.status(503).json({
      status: 'error',
      message: 'ADMIN_API_KEY is not configured on the server',
    });
    return;
  }

  const provided = req.headers['x-admin-key'];
  if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
    res.status(401).json({ status: 'unauthorized' });
    return;
  }

  next();
}
