BEGIN;

-- ==============================================================================
-- TrailVerse Security Hardening: Row Level Security (RLS) - DENY-ALL MIGRATION
-- Date: November 2, 2026
-- Scope: All 10 application tables in public schema
-- Architecture: Backend-only access model via FastAPI (Postgres service_role)
--               All direct table, sequence, and function access for anon and
--               authenticated roles is revoked. RLS enabled with NO policies
--               (default-deny).
-- ==============================================================================

-- 1. Clean up / Drop all legacy policies idempotently
DROP POLICY IF EXISTS "Public users can view safe profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

DROP POLICY IF EXISTS "Anyone can view treks" ON public.treks;

DROP POLICY IF EXISTS "Anyone can view trek groups" ON public.trek_groups;
DROP POLICY IF EXISTS "Authenticated users can create trek groups" ON public.trek_groups;
DROP POLICY IF EXISTS "Hosts can update their own groups" ON public.trek_groups;

DROP POLICY IF EXISTS "Anyone can view user trek history" ON public.user_treks;
DROP POLICY IF EXISTS "Users can log their own treks" ON public.user_treks;

DROP POLICY IF EXISTS "Anyone can view trek group members" ON public.trek_group_members;
DROP POLICY IF EXISTS "Authenticated users can join groups" ON public.trek_group_members;

DROP POLICY IF EXISTS "Anyone can view group messages" ON public.trek_group_messages;
DROP POLICY IF EXISTS "Authenticated members can post messages" ON public.trek_group_messages;

DROP POLICY IF EXISTS "Anyone can view group queries" ON public.trek_group_queries;
DROP POLICY IF EXISTS "Authenticated members can post queries" ON public.trek_group_queries;

DROP POLICY IF EXISTS "Anyone can view query replies" ON public.trek_group_query_replies;
DROP POLICY IF EXISTS "Authenticated members can post replies" ON public.trek_group_query_replies;

DROP POLICY IF EXISTS "Anyone can view badges" ON public.badges;
DROP POLICY IF EXISTS "Anyone can view user badges" ON public.user_badges;

-- 2. Enable Row Level Security on all 10 application tables
-- Note: FORCE ROW LEVEL SECURITY is intentionally omitted so that the service_role
-- (which holds BYPASSRLS) can continue operating unimpeded via the FastAPI backend.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trek_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_treks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trek_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trek_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trek_group_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trek_group_query_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- 3. Table-level REVOKE: Revoke all privileges on all 10 tables from anon and authenticated
REVOKE ALL ON TABLE public.users FROM anon, authenticated;
REVOKE ALL ON TABLE public.treks FROM anon, authenticated;
REVOKE ALL ON TABLE public.trek_groups FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_treks FROM anon, authenticated;
REVOKE ALL ON TABLE public.trek_group_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.trek_group_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.trek_group_queries FROM anon, authenticated;
REVOKE ALL ON TABLE public.trek_group_query_replies FROM anon, authenticated;
REVOKE ALL ON TABLE public.badges FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_badges FROM anon, authenticated;

-- 4. Revoke privileges on all existing sequences and functions in schema public
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 5. Alter default privileges so future tables, sequences, and functions remain denied
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;
