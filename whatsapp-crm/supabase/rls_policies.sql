-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────
-- Run this file AFTER schema.sql in the Supabase SQL Editor.
--
-- Security model:
--   anon  → SELECT only (dashboard reads via NEXT_PUBLIC_SUPABASE_ANON_KEY)
--   service_role → full access (backend writes via SUPABASE_SERVICE_KEY, bypasses RLS)
--
-- The dashboard never inserts/updates/deletes. All writes go through the backend.

-- ── CHECK EXISTING POLICIES ───────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('customer_chats', 'chat_insights', 'customer_profiles')
ORDER BY tablename, policyname;

-- ── customer_chats ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon can read chats" ON customer_chats;
DROP POLICY IF EXISTS "anon can write chats" ON customer_chats;

CREATE POLICY "anon can read chats"
ON customer_chats
FOR SELECT
TO anon
USING (true);

-- ── chat_insights ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon can read insights" ON chat_insights;
DROP POLICY IF EXISTS "anon can write insights" ON chat_insights;

CREATE POLICY "anon can read insights"
ON chat_insights
FOR SELECT
TO anon
USING (true);

-- ── customer_profiles ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon can read profiles" ON customer_profiles;
DROP POLICY IF EXISTS "anon can write profiles" ON customer_profiles;

CREATE POLICY "anon can read profiles"
ON customer_profiles
FOR SELECT
TO anon
USING (true);

-- ── ENABLE RLS ON ALL TABLES ──────────────────────────────────────────────
ALTER TABLE customer_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- ── REVOKE ANON WRITE (defense in depth) ───────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON customer_chats FROM anon;
REVOKE INSERT, UPDATE, DELETE ON chat_insights FROM anon;
REVOKE INSERT, UPDATE, DELETE ON customer_profiles FROM anon;

-- ── GRANT ANON READ ON TABLES ─────────────────────────────────────────────
GRANT SELECT ON customer_chats TO anon;
GRANT SELECT ON chat_insights TO anon;
GRANT SELECT ON customer_profiles TO anon;

-- ── GRANT ANON READ ON VIEWS ──────────────────────────────────────────────
GRANT SELECT ON hot_leads TO anon;
GRANT SELECT ON agent_performance TO anon;
GRANT SELECT ON unsynced_insights TO anon;

-- ── CONFIRM POLICIES WERE CREATED ─────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('customer_chats', 'chat_insights', 'customer_profiles')
ORDER BY tablename, policyname;
