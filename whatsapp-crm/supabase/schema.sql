-- ── RAW CHATS TABLE ──────────────────────────────────────────────────────
-- Stores incoming customer chats with full transcripts
-- Transcripts are deleted after 30 days once insights are extracted
-- The rest of the row stays as a lightweight record forever
CREATE TABLE IF NOT EXISTS customer_chats (
  id              BIGSERIAL PRIMARY KEY,
  chat_id         TEXT NOT NULL,
  agent_name      TEXT,
  contact_name    TEXT,
  last_message    TEXT,
  transcript      TEXT,
  message_count   INTEGER DEFAULT 0,
  chat_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  insights_done   BOOLEAN NOT NULL DEFAULT FALSE,
  transcript_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_chat_id UNIQUE (chat_id)
);

-- ── INSIGHTS TABLE ────────────────────────────────────────────────────────
-- Stores AI-extracted insights — kept forever, very small rows (~0.5KB each)
CREATE TABLE IF NOT EXISTS chat_insights (
  id                  BIGSERIAL PRIMARY KEY,
  chat_id             TEXT NOT NULL,
  agent_name          TEXT,
  contact_name        TEXT,
  chat_date           TIMESTAMPTZ,
  customer_intent     TEXT,
  sentiment           TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  sentiment_reason    TEXT,
  deal_stage          TEXT CHECK (deal_stage IN ('hot', 'warm', 'cold')),
  follow_up_action    TEXT,
  follow_up_deadline  TEXT,
  key_summary         TEXT,
  sheets_synced       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CUSTOMER PROFILES TABLE ───────────────────────────────────────────────
-- One row per unique customer. Updated every time new insights are extracted.
-- Provides long-term context across all interactions with a customer.
CREATE TABLE IF NOT EXISTS customer_profiles (
  id                  BIGSERIAL PRIMARY KEY,
  chat_id             TEXT NOT NULL,
  contact_name        TEXT,
  agent_name          TEXT,
  cumulative_summary  TEXT,
  current_deal_stage  TEXT CHECK (current_deal_stage IS NULL OR current_deal_stage IN ('hot', 'warm', 'cold')),
  overall_sentiment   TEXT CHECK (overall_sentiment IS NULL OR overall_sentiment IN ('positive', 'neutral', 'negative')),
  total_chats         INTEGER NOT NULL DEFAULT 0,
  hot_lead_count      INTEGER NOT NULL DEFAULT 0,
  products_interested TEXT,
  last_purchase       TEXT,
  key_concerns        TEXT,
  preferred_agent     TEXT,
  first_seen          TIMESTAMPTZ,
  last_active         TIMESTAMPTZ,
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_profile_chat_id UNIQUE (chat_id)
);

-- ── INDEXES ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chats_chat_id       ON customer_chats(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_insights_done ON customer_chats(insights_done);
CREATE INDEX IF NOT EXISTS idx_chats_chat_date     ON customer_chats(chat_date DESC);
CREATE INDEX IF NOT EXISTS idx_chats_archived      ON customer_chats(transcript_archived);

CREATE INDEX IF NOT EXISTS idx_insights_chat_id    ON chat_insights(chat_id);
CREATE INDEX IF NOT EXISTS idx_insights_deal_stage ON chat_insights(deal_stage);
CREATE INDEX IF NOT EXISTS idx_insights_sentiment  ON chat_insights(sentiment);
CREATE INDEX IF NOT EXISTS idx_insights_chat_date  ON chat_insights(chat_date DESC);
CREATE INDEX IF NOT EXISTS idx_insights_agent      ON chat_insights(agent_name);
CREATE INDEX IF NOT EXISTS idx_insights_synced     ON chat_insights(sheets_synced);

CREATE INDEX IF NOT EXISTS idx_profiles_chat_id     ON customer_profiles(chat_id);
CREATE INDEX IF NOT EXISTS idx_profiles_deal_stage  ON customer_profiles(current_deal_stage);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON customer_profiles(last_active DESC);

-- ── AUTO-DELETE TRANSCRIPTS AFTER 30 DAYS ────────────────────────────────
-- Replaces transcript with null once insights are done and it's been 30 days
-- The row itself stays — lightweight record of the chat forever
CREATE OR REPLACE FUNCTION delete_old_transcripts()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE customer_chats
  SET transcript = NULL,
      transcript_archived = TRUE
  WHERE insights_done = TRUE
    AND transcript IS NOT NULL
    AND chat_date < NOW() - INTERVAL '30 days';
$$;

-- ── OPTIONAL: SCHEDULE TRANSCRIPT CLEANUP (pg_cron) ──────────────────────
-- The delete_old_transcripts() function above is always created.
-- To run it automatically, enable pg_cron in Supabase first:
--   Dashboard → Database → Extensions → enable "pg_cron"
-- Then uncomment and run the block below in the SQL Editor:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- SELECT cron.schedule(
--   'delete-old-transcripts',
--   '30 20 * * *',   -- 2:00 AM IST daily (20:30 UTC)
--   'SELECT delete_old_transcripts()'
-- );
--
-- If re-running, unschedule first:
--   SELECT cron.unschedule('delete-old-transcripts');

-- ── USEFUL VIEWS FOR DASHBOARD ────────────────────────────────────────────
-- Hot leads view
CREATE OR REPLACE VIEW hot_leads AS
SELECT
  i.*,
  c.message_count
FROM chat_insights i
LEFT JOIN customer_chats c ON c.chat_id = i.chat_id
WHERE i.deal_stage = 'hot'
ORDER BY i.chat_date DESC;

-- Agent performance view
CREATE OR REPLACE VIEW agent_performance AS
SELECT
  agent_name,
  COUNT(*)                                           AS total_chats,
  COUNT(*) FILTER (WHERE deal_stage = 'hot')         AS hot_leads,
  COUNT(*) FILTER (WHERE deal_stage = 'warm')        AS warm_leads,
  COUNT(*) FILTER (WHERE deal_stage = 'cold')        AS cold_leads,
  COUNT(*) FILTER (WHERE sentiment = 'positive')     AS positive_chats,
  COUNT(*) FILTER (WHERE sentiment = 'negative')     AS negative_chats,
  ROUND(
    COUNT(*) FILTER (WHERE deal_stage = 'hot') * 100.0 / NULLIF(COUNT(*), 0), 1
  )                                                  AS hot_lead_rate
FROM chat_insights
GROUP BY agent_name
ORDER BY hot_leads DESC;

-- Unsynced insights (for weekly Sheets job)
CREATE OR REPLACE VIEW unsynced_insights AS
SELECT * FROM chat_insights
WHERE sheets_synced = FALSE
ORDER BY chat_date ASC;

