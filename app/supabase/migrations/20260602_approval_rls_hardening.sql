-- =====================================================================
-- Migration: Approval RLS hardening
-- Date:      2026-06-02
-- Purpose:   Enforce the approval rules SERVER-SIDE so the client-side
--            canActOnBill() check can no longer be bypassed with the
--            public anon key.
--
-- Closes the loophole where a token could be approved by anyone holding
-- the link (incl. the invoices mailbox). After this migration, an
-- approval_tokens row can only be inserted by a signed-in user, for their
-- OWN email, and only for a level their role is allowed to act on.
--
-- NOTE: the n8n webhook uses the Supabase SERVICE ROLE key, which bypasses
-- RLS by design — so all existing automation (status flips, mark-used,
-- finance email) keeps working unchanged.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read profiles without
-- tripping profiles' own RLS / causing recursion).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(is_active, true) FROM public.profiles WHERE id = auth.uid()
$$;

-- =====================================================================
-- profiles
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_app_role() = 'admin');

DROP POLICY IF EXISTS profiles_admin_write ON public.profiles;
CREATE POLICY profiles_admin_write ON public.profiles
  FOR ALL TO authenticated
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

-- =====================================================================
-- bills
-- =====================================================================
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Any active, authenticated staff member may read bills (dashboard lists).
DROP POLICY IF EXISTS bills_select_authenticated ON public.bills;
CREATE POLICY bills_select_authenticated ON public.bills
  FOR SELECT TO authenticated
  USING (public.current_user_active());

-- Only approver/admin roles may update a bill (records approver name etc.).
-- Detailed level-vs-status gating still lives in the app + webhook; this is
-- the coarse server-side gate that stops finance/deactivated/other users.
DROP POLICY IF EXISTS bills_update_approvers ON public.bills;
CREATE POLICY bills_update_approvers ON public.bills
  FOR UPDATE TO authenticated
  USING (public.current_user_active()
         AND public.current_app_role() IN ('l1','l2','admin'))
  WITH CHECK (public.current_user_active()
         AND public.current_app_role() IN ('l1','l2','admin'));

-- Bills are created by the n8n ingest workflow (service role). Only admins
-- may insert from a user session.
DROP POLICY IF EXISTS bills_insert_admin ON public.bills;
CREATE POLICY bills_insert_admin ON public.bills
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() = 'admin');

-- =====================================================================
-- approval_tokens  (the critical lock)
-- =====================================================================
ALTER TABLE public.approval_tokens ENABLE ROW LEVEL SECURITY;

-- A signed-in user may create a token ONLY:
--   * when active,
--   * for their OWN email (no impersonation), and
--   * for a level their role is permitted to act on.
-- Admin override is allowed (admins may create L1 and L2). This mirrors
-- canActOnBill() but is now enforced by the database.
DROP POLICY IF EXISTS approval_tokens_insert_role_scoped ON public.approval_tokens;
CREATE POLICY approval_tokens_insert_role_scoped ON public.approval_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_active()
    AND lower(actor_email) = lower(auth.jwt() ->> 'email')
    AND (
      (level = 'L1' AND public.current_app_role() IN ('l1','admin'))
      OR
      (level = 'L2' AND public.current_app_role() IN ('l2','admin'))
    )
  );

-- Tokens are validated/consumed by the webhook (service role). Authenticated
-- users get no SELECT/UPDATE/DELETE — prevents token harvesting or tampering.
-- (Admins may read for audit.)
DROP POLICY IF EXISTS approval_tokens_select_admin ON public.approval_tokens;
CREATE POLICY approval_tokens_select_admin ON public.approval_tokens
  FOR SELECT TO authenticated
  USING (public.current_app_role() = 'admin');

-- =====================================================================
-- Done. Verify with:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('profiles','bills','approval_tokens') ORDER BY 1,3;
-- =====================================================================
