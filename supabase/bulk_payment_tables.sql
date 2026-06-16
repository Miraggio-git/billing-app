-- ============================================================
-- Bulk Payment Upload — New Supabase Tables
-- Run these in Supabase → SQL Editor
-- ============================================================

-- 1. payment_notifications
--    Acts as a queue between the app and n8n.
--    App inserts one row per bulk payment → n8n watches for
--    new rows via Supabase DB Webhook → sends vendor email →
--    updates status to 'sent'.
-- ------------------------------------------------------------
create table if not exists payment_notifications (
  id                   uuid        default gen_random_uuid() primary key,
  payment_id           uuid        references payments(id) on delete cascade,
  vendor_id            uuid        references vendors(id),
  bill_id              uuid        references bills(id),
  vendor_email         text,
  vendor_name          text,
  invoice_number       text,
  amount_paid          numeric(12, 2),
  utr                  text,
  payment_mode         text,
  paid_at              timestamptz,
  payment_approved_at  timestamptz,
  paid_by              text,
  billing_period_start date,
  billing_period_end   date,
  status               text        not null default 'pending',  -- pending | sent | failed
  sent_at              timestamptz,
  created_at           timestamptz default now()
);

-- Index for n8n polling / webhook filtering
create index if not exists idx_payment_notifications_status
  on payment_notifications (status, created_at desc);

-- Enable Row Level Security (optional but recommended)
alter table payment_notifications enable row level security;

-- Allow the service role full access (used by n8n)
create policy "service role full access" on payment_notifications
  for all using (true);

-- Allow authenticated users to insert & read their own notifications
create policy "authenticated insert" on payment_notifications
  for insert to authenticated with check (true);

create policy "authenticated read" on payment_notifications
  for select to authenticated using (true);


-- ============================================================
-- 2. bulk_upload_logs
--    One row per bulk upload session for full audit trail.
-- ------------------------------------------------------------
create table if not exists bulk_upload_logs (
  id               uuid        default gen_random_uuid() primary key,
  uploaded_by      text        not null,
  filename         text,
  total_rows       int,
  successful_rows  int,
  payment_ids      uuid[],                   -- IDs of payments created in this batch
  uploaded_at      timestamptz default now()
);

-- Enable Row Level Security
alter table bulk_upload_logs enable row level security;

create policy "authenticated read" on bulk_upload_logs
  for select to authenticated using (true);

create policy "authenticated insert" on bulk_upload_logs
  for insert to authenticated with check (true);


-- ============================================================
-- 3. Add payment_approved_at to payments table (if not already present)
--    Run this if your payments table doesn't have this column yet.
-- ------------------------------------------------------------
alter table payments
  add column if not exists payment_approved_at timestamptz;


-- ============================================================
-- 4. Supabase Database Webhook (set up manually in dashboard)
--
--    Supabase → Integrations → Database Webhooks → New webhook
--
--    Name:    Bulk Payment Notification
--    Table:   payment_notifications
--    Events:  INSERT
--    Method:  POST
--    URL:     https://your-n8n-instance.com/webhook/miraggio-bulk-payment-notification
--
--    This fires n8n automatically every time the app inserts
--    a new notification row, completing the email flow.
-- ============================================================
