# Secured Approval Rollout — what changed & how to apply

**Date:** 2026-06-02
**Goal:** Close the loophole where clicking an emailed APPROVE link approved a
bill *as someone else* (e.g. clicking from the invoices mailbox recorded the
approval as "mandeep"). Approval power moves out of email and into the
signed-in dashboard, and is now enforced by the database.

## Root cause (for the record)
- `Validate Token` hardcoded the approver by level: L1 → mandeep, L2 → Deepak.
  It never learned who actually clicked.
- Email APPROVE/REJECT links were bearer tokens — possession = approval.
  Anyone with the link (or the sending mailbox) could approve.
- Role checks lived only in the React app (`canActOnBill`); the public anon
  key could write to `bills` / `approval_tokens` directly, bypassing them.

## The three deliverables

### 1. `Miraggio — L1 & L2 Approval Webhook (SECURED).json`  (import into n8n)
- `Validate Token` now reads the **real** approver from the token row
  (`actor_email` / `actor_name`, written only by the authenticated dashboard)
  and **rejects any token with no actor** (reason `UNATTRIBUTED`). Old emailed
  bearer links therefore stop working.
- Bill status PATCHes now also write the human-readable `l1_approved_by` /
  `l2_approved_by` and rejection reason — no more relying on the dashboard's
  1.2s post-patch race.
- Removed `Generate L2 Tokens` + `Insert L2 Tokens`. The L2 email is now a
  **"Review & Approve on Dashboard"** notification (deep link), not buttons.

### 2. `Vendor Bill Fetch — PROD (SECURED email).json`  (import into n8n)
- The L1 approval email's APPROVE/REJECT buttons are replaced with a single
  dashboard deep link → `/bills/{bill_id}`. (The token-generation node is left
  in place but its links are now inert.)

### 3. `supabase/migrations/20260602_approval_rls_hardening.sql`  (apply to DB)
- Enables RLS on `profiles`, `bills`, `approval_tokens`.
- A signed-in user can create an `approval_tokens` row **only for their own
  email** and **only for a level their role allows** (admin may do both).
- This is the server-side version of `canActOnBill` — the anon key alone can
  no longer approve anything.

## Apply order
1. **Apply the SQL migration** to Supabase first (SQL editor or `supabase db push`).
   Verify: `SELECT tablename, policyname, cmd FROM pg_policies
   WHERE tablename IN ('profiles','bills','approval_tokens');`
2. **Import both workflow JSONs** into n8n (they import as new, inactive workflows).
3. Point the new webhook workflow at the **same path** `/webhook/approval` and
   the **same Supabase + Outlook credentials** as the originals.
4. **Deactivate the two old workflows, then activate the two new ones**
   (only one workflow may own the `/webhook/approval` path at a time).
5. Smoke test: ingest a test bill → open the dashboard deep link → approve as an
   L1 user → confirm the bill shows that user's name and advances to PENDING_L2.

## Notes / follow-ups (not blocking)
- The dashboard's post-approval name patch in `lib/approval.js` is now
  redundant (the webhook records the name) but harmless — can be simplified later.
- `BillDetail.jsx` has a direct status-update path that doesn't go through the
  webhook; worth aligning so every approval runs the same automation.
- Verify the `profiles` table has the `role` values used here: `l1`, `l2`,
  `admin`, `finance`.
