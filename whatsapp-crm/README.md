# WhatsApp CRM Intelligence System



Production-ready WhatsApp CRM that receives messages via WAHA webhooks, classifies customers with AI, extracts insights, syncs to Google Sheets, archives to Google Drive, and serves a web dashboard.



**Total infrastructure cost: $0** (free tiers for Groq, Gemini, Supabase, Vercel, Google)



---



## Architecture



```

WhatsApp → WAHA → Backend (webhook) → Supabase

                         ↓

              Cron: insights / Sheets / Drive

                         ↓

              Dashboard (reads Supabase via anon key)

```



1. **Webhook** — WAHA POSTs each message to `/webhook`; AI classifier filters customers; chat saved to Supabase.

2. **Insights pipeline** — Every 6 hours (or manual trigger), extracts sentiment, deal stage, follow-ups; updates customer profiles.

3. **Weekly Sheets** — Appends unsynced insights to a new tab in Google Sheets.

4. **Monthly archive** — Uploads old transcripts to Google Drive.

5. **Dashboard** — Next.js app with Overview, Agents, Customers, Search, Live Feed, and Ask AI.



---



## Prerequisites



- Node.js 18+

- WAHA instance (already running)

- Supabase account

- Groq API key ([console.groq.com](https://console.groq.com))

- Gemini API key ([aistudio.google.com](https://aistudio.google.com))

- Google Cloud service account with Sheets + Drive access

- PM2 (for production deployment)

- ngrok (for local dev only — tunnels WAHA webhooks to `localhost:3001`)



---



## 1. Supabase Setup



1. Create a new project at [supabase.com](https://supabase.com)

2. Open **SQL Editor** and run the entire contents of `supabase/schema.sql`

3. Run the entire contents of `supabase/rls_policies.sql` (anon read-only; backend writes via service key)

4. Optionally enable **pg_cron** extension and run the commented schedule block at the bottom of `schema.sql` for automatic transcript cleanup

5. Copy from **Project Settings → API**:

   - Project URL → `SUPABASE_URL`

   - `anon` key → `SUPABASE_ANON_KEY`

   - `service_role` key → `SUPABASE_SERVICE_KEY`



---



## 2. Google Service Account Setup



1. Go to [Google Cloud Console](https://console.cloud.google.com)

2. Create a project → **IAM → Service Accounts → Create**

3. Create a JSON key and download it

4. Enable **Google Sheets API** and **Google Drive API**

5. Create a Google Sheet and a Drive folder

6. Share both with the service account email as **Editor**

7. Copy:

   - Service account email → `GOOGLE_SERVICE_ACCOUNT_EMAIL`

   - Private key from JSON → `GOOGLE_PRIVATE_KEY` (keep `\n` escapes)

   - Sheet ID from URL → `GOOGLE_SHEETS_ID` (only the ID between `/d/` and `/edit`, not the full URL)

   - Folder ID from URL → `GOOGLE_DRIVE_FOLDER_ID`



---



## 3. Environment Variables



### Backend (`backend/.env`)



```bash

cd backend

cp .env.example .env

# Fill in all values — see .env.example for the full list

```



Key variables:



| Variable | Purpose |

|----------|---------|

| `WAHA_BASE_URL`, `WAHA_API_KEY`, `WAHA_SESSION` | WAHA API connection |

| `WAHA_WEBHOOK_SECRET` | Validates incoming webhooks (`?secret=` in URL) |

| `ADMIN_API_KEY` | Protects `/run-insights`, `/run-sheets-sync`, `/status` |

| `GROQ_API_KEY`, `GEMINI_API_KEY` | AI classifier + insights |

| `SUPABASE_*` | Database (service key for writes) |

| `GOOGLE_*` | Sheets sync + Drive archive |

| `MAX_TRANSCRIPT_CHARS` | Truncate long transcripts before AI (default `12000`) |



### Dashboard (`dashboard/.env.local`)



```bash

cd dashboard

cp .env.example .env.local

```



| Variable | Purpose |

|----------|---------|

| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |

| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Read-only dashboard access |

| `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD` | HTTP Basic Auth |

| `GROQ_API_KEY` | Ask AI feature (server-side only) |



---



## 4. Running Locally



### Backend



```bash

cd backend

npm install

npm run dev

```



Server starts on `http://localhost:3001`. Public health check: `GET /health`



### Dashboard



```bash

cd dashboard

npm install

npm run dev

```



Dashboard starts on `http://localhost:3000`. Browser will prompt for basic auth credentials.



### Local dev: ngrok tunnel (WAHA webhooks)



WAHA runs on a remote server and cannot reach `localhost` directly. Use ngrok to expose port 3001:



```bash

ngrok http 3001

```



Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.dev`), then configure WAHA:



```bash

cd backend

npx tsx scripts/configure-waha-webhook.ts https://YOUR-NGROK-URL/webhook

```



The script appends `?secret=` from `WAHA_WEBHOOK_SECRET` automatically.



**Note:** Free ngrok URLs change on restart — re-run the configure script after each ngrok restart. This is not needed in production (backend runs beside WAHA).



### Verify setup



```bash

cd backend

npx tsx scripts/check-setup.ts

```



---



## 5. WAHA Webhook Configuration



**Production** (backend on same server as WAHA):



```bash

npx tsx scripts/configure-waha-webhook.ts http://127.0.0.1:3001/webhook

```



Or manually:



```bash

curl -X PUT https://your-waha-server.com/api/sessions/YOUR_SESSION \

  -H "X-Api-Key: YOUR_WAHA_API_KEY" \

  -H "Content-Type: application/json" \

  -d '{

    "config": {

      "webhooks": [{

        "url": "http://127.0.0.1:3001/webhook?secret=YOUR_WAHA_WEBHOOK_SECRET",

        "events": ["message"]

      }],

      "ignore": { "groups": true }

    }

  }'

```



---



## 6. Security



| Layer | Mechanism |

|-------|-----------|

| **Webhook** | `WAHA_WEBHOOK_SECRET` — required via `?secret=` query param or `X-Webhook-Secret` header |

| **Admin endpoints** | `ADMIN_API_KEY` — required via `X-Admin-Key` header on `/run-insights`, `/run-sheets-sync`, `/status` |

| **Dashboard** | HTTP Basic Auth (`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`) |

| **Supabase RLS** | `anon` role is **read-only**; all writes use `SUPABASE_SERVICE_KEY` on the backend |

| **Production** | Set `NODE_ENV=production` — enforces `WAHA_WEBHOOK_SECRET` and `ADMIN_API_KEY` at startup |



Protected admin endpoints (all require `X-Admin-Key`):



```bash

curl http://localhost:3001/status -H "X-Admin-Key: YOUR_ADMIN_API_KEY"

curl -X POST http://localhost:3001/run-insights -H "X-Admin-Key: YOUR_ADMIN_API_KEY"

curl -X POST http://localhost:3001/run-sheets-sync -H "X-Admin-Key: YOUR_ADMIN_API_KEY"

```



---



## 7. Production Deployment (PM2)



On the same server as WAHA:



```bash

cd backend

npm install

cp .env.example .env   # first time only — fill in all values

npm run pm2:start      # builds TypeScript + starts via ecosystem.config.js

pm2 save

pm2 startup            # follow the printed command to enable boot on reboot

```



Or step by step:



```bash

npm run build

pm2 start ecosystem.config.js

```



**After code updates:**



```bash

npm run pm2:reload     # rebuild + zero-downtime reload

```



**Useful PM2 commands:**



| Command | Purpose |

|---------|---------|

| `npm run pm2:logs` | Tail application logs |

| `npm run pm2:restart` | Hard restart |

| `npm run pm2:stop` | Stop the process |



Config file: `backend/ecosystem.config.js` — sets `NODE_ENV=production`, logs under `backend/logs/`, auto-restart on crash, 512MB memory limit.



After deploy, configure the WAHA webhook to `http://127.0.0.1:3001/webhook?secret=...` (see section 5).



### Log Management



```bash

pm2 install pm2-logrotate

pm2 set pm2-logrotate:max_size 10M

pm2 set pm2-logrotate:retain 7

pm2 set pm2-logrotate:compress true

pm2 logs whatsapp-crm --lines 100

```



### Server Restart Behavior



- PM2 auto-starts the backend on OS reboot (after `pm2 startup`)

- Cron jobs re-register on each start

- Missed cron runs are not backfilled — next scheduled run picks up pending work

- WAHA resumes webhooks once backend is up



---



## 8. Dashboard Deployment (Vercel)



1. Push `dashboard/` to GitHub

2. Import project in [vercel.com](https://vercel.com)

3. Set root directory to `dashboard`

4. Add environment variables in Vercel project settings:

   - `NEXT_PUBLIC_SUPABASE_URL`

   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   - `DASHBOARD_USERNAME`

   - `DASHBOARD_PASSWORD`

   - `GROQ_API_KEY`

5. Deploy



---



## 9. Utility Scripts



Run from `backend/`:



| Script | Command | Purpose |

|--------|---------|---------|

| Setup check | `npx tsx scripts/check-setup.ts` | Validates env vars, Supabase, WAHA, Groq, Gemini, Google |

| Full check | `npx tsx scripts/full-check.ts` | Extended connectivity + table checks |

| Configure webhook | `npx tsx scripts/configure-waha-webhook.ts [url]` | Updates WAHA session webhook (appends secret) |

| Test Gemini | `npx tsx scripts/test-gemini.ts` | Verifies Gemini API key |



---



## 10. Feature Flags



Set to `false` in `backend/.env` to disable without code changes:



| Flag | Default | Effect |

|------|---------|--------|

| `ENABLE_GOOGLE_SHEETS` | `true` | Weekly Sheets sync |

| `ENABLE_GOOGLE_DRIVE_ARCHIVE` | `true` | Monthly Drive archive |

| `ENABLE_INSIGHTS_PIPELINE` | `true` | 6-hour insight extraction |

| `ENABLE_DASHBOARD` | `true` | Informational only |



Restart backend after changing flags: `pm2 restart whatsapp-crm`



---



## 11. Cron Schedule Reference



| Job | Default | Description |

|-----|---------|-------------|

| `INSIGHTS_CRON` | `0 */6 * * *` | Every 6 hours |

| `WEEKLY_SHEETS_CRON` | `30 3 * * 1` | Monday 9:00 AM IST |

| `MONTHLY_ARCHIVE_CRON` | `0 3 1 * *` | 1st of month, 3:00 AM |



All times use the server's local timezone unless noted. Weekly Sheets default is 3:30 AM UTC = 9:00 AM IST.



---



## 12. Troubleshooting



| Problem | Fix |

|---------|-----|

| `Missing required environment variable` | Check `backend/.env` has all required keys |

| WAHA webhooks not arriving | Verify public URL is reachable; check WAHA session config includes `?secret=` |

| Webhook returns 401 | `WAHA_WEBHOOK_SECRET` mismatch — re-run `configure-waha-webhook.ts` |

| Admin endpoint returns 401 | Add `X-Admin-Key` header matching `ADMIN_API_KEY` |

| Duplicate chats | Should not happen — `unique_chat_id` constraint + upsert handles retries |

| Insights from short transcripts | Pipeline fetches up to 200 messages from WAHA before extraction |

| Insights JSON parse errors | Long transcripts are truncated (`MAX_TRANSCRIPT_CHARS`); check backend logs for AI snippet |

| Google Sheets auth error | Share Sheet with service account email as Editor |

| Google Sheets "not found" | `GOOGLE_SHEETS_ID` must be the ID only, not the full URL with `/edit?gid=0` |

| Test Sheets manually | `POST /run-sheets-sync` with header `X-Admin-Key` |

| Google Drive upload fails | Share folder with service account; check `GOOGLE_DRIVE_FOLDER_ID` |

| Dashboard shows no data | Run `rls_policies.sql`; ensure anon has SELECT on tables and views |

| Groq rate limit | Pipeline waits 4 seconds between chats; reduce `INSIGHTS_BATCH_SIZE` |

| PM2 logs filling disk | Run `pm2 install pm2-logrotate` (see Log Management above) |



---



## Project Structure



```

whatsapp-crm/

├── backend/          # Express webhook server + cron jobs

│   ├── ecosystem.config.js  # PM2 production config

│   ├── src/          # Application source

│   └── scripts/      # Setup and utility scripts

├── dashboard/        # Next.js CRM dashboard (Vercel)

├── supabase/         # schema.sql + rls_policies.sql

└── README.md

```



---



## Development Workflow



### Branches



| Branch | Purpose |
|--------|---------|
| `main` | Production — auto-deploys backend (Railway) and dashboard (Vercel) when GitHub is connected |
| `dev` | Integration / staging — merge feature work here before promoting to `main` |



### Local development



```bash
# Backend (port 3001)
cd whatsapp-crm/backend
cp .env.example .env   # fill in secrets
npm install && npm run dev

# Dashboard (port 3000)
cd whatsapp-crm/dashboard
cp .env.example .env.local
npm install && npm run dev
```



Use ngrok only for local webhook testing. Production WAHA webhooks point at Railway.



### GitHub → deploy



After connecting the repo [ahl-official/Whatsapp-Insights](https://github.com/ahl-official/Whatsapp-Insights):



| Service | Root directory | Notes |
|---------|----------------|-------|
| **Vercel** (dashboard) | `whatsapp-crm/dashboard` | Settings → Git → connect repo |
| **Railway** (backend) | `whatsapp-crm/backend` | Watch paths: `whatsapp-crm/backend/**` |



Pushes to `main` trigger production deploys. Verify with Railway logs or `GET /health` on the backend URL.



### Typical flow



1. Branch from `dev`: `git checkout dev && git pull && git checkout -b feature/my-change`
2. Develop and test locally
3. Open PR into `dev`, then merge to `main` when ready for production



---


