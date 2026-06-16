# Miraggio Vendor Contract & Bill Automation — Backend Context

> **Purpose of this repo.** This is the **full reference repo** for the Miraggio Vendor
> Payment System. It contains the complete dashboard source code (`app/`), the n8n
> automation exports (`n8n-workflows/`), and the database migrations (`supabase/`), plus
> this document explaining *what the system is*, *how it's wired together*, and *what each
> automation does*. Use it as the single source of truth for understanding and rebuilding
> the backend. (Your live dashboard deployment continues to track its existing repo — this
> repo is the consolidated copy + context.)

**Owner:** Himanshu Bhandari · Miraggio Lifestyles Pvt. Ltd.
**Status:** Live in production · Last updated June 2026

---

## 1. What this system does

Miraggio works with a network of vendors — fabric suppliers, label printers, stitching
units, dye houses, packaging partners — each billing on different cycles with different
contract terms. This system automates the entire vendor payment pipeline:

```
Vendor emails invoice PDF
        │
        ▼
  [n8n] Email trigger picks it up
        │
        ▼
  [n8n] PDF text extraction
        │
        ▼
  [Claude AI] Extract bill + contract fields (invoice no., amounts,
              line items, billing period) into structured data
        │
        ▼
  [n8n] Contract validation — amount vs. contract max, billing-cycle
        compliance, date-range validity → anomaly flags
        │
        ▼
  [Supabase] Bill inserted into `bills` with flags + PDF URL
        │
        ▼
  [n8n] L1 approval request → reviewer notified (dashboard deep link)
        │
        ▼
  [Dashboard] L1 approves/rejects → L2 approves/rejects (attributed + timestamped)
        │
        ▼
  [Dashboard] Payment logged (single or bulk CSV upload)
        │
        ▼
  [Supabase webhook → n8n] Payment confirmation email sent to vendor (UTR, amount, period)
```

Goal: **zero manual data entry for standard invoices**, with a full audit trail.

---

## 2. Architecture at a glance

The system is three interconnected layers:

| Layer | Technology | Role |
|-------|-----------|------|
| **Web app (dashboard)** | React 19 + Vite + Tailwind 4 + React Router 7 | Operator UI — bills queue, vendors, contracts, payments, approvals, users. Source in [`app/`](./app). |
| **Automation** | n8n workflows | Email intake, PDF extraction, AI parsing, contract validation, approval webhook, payment-confirmation emails. |
| **Backend** | Supabase (Postgres + Auth + RLS + Storage + DB Webhooks) | Source of truth. Tables, row-level security, PDF storage bucket, and webhooks that fire n8n. |
| **AI** | Claude | Reads invoice + contract PDFs and returns structured fields. |
| **Email** | Outlook (vendor inbox + outbound) | Invoice intake and vendor notifications. |
| **Hosting** | VPS | Hosts the n8n instance. |

### Dashboard modules (in the app repo)
- **Dashboard** — overview / KPIs.
- **Bills / Bill Detail** — live bill queue with L1/L2 approval actions, rejection notes, anomaly highlights.
- **Approvals** — review queue for approvers.
- **Vendors / Vendor Detail / Vendor Ledger** — vendor master (contract validity, GSTIN, PAN, billing cycle) and per-vendor ledger.
- **Contracts** — contract registry (active / expiring / pending).
- **Payments** — payment log + bulk CSV upload.
- **Users** — user/role management.

Auth is handled by Supabase Auth; routes are protected and deactivated accounts are blocked at the app level, with roles enforced server-side via RLS (see §5).

---

## 3. The automations (n8n)

These are the production workflows. JSON exports live alongside the project; import them
into n8n and point them at the shared Supabase + Outlook credentials.

### 3.1 Vendor Bill Fetch — PROD (SECURED email)
- **Trigger:** new email with a PDF attachment in the vendor inbox.
- **Steps:** extract PDF text → Claude parses the invoice (and contract, if present) →
  validate against the active contract → insert the bill into Supabase with anomaly flags
  and a stored PDF URL → send the **L1 approval request** email.
- **Secured change:** the L1 email no longer carries APPROVE/REJECT buttons. It carries a
  single **dashboard deep link** to `/bills/{bill_id}`. Approval happens only in the
  signed-in dashboard.

### 3.2 Claude — Extract Bill + Contract (AI Agent) / Multi-PDF
- Claude AI agent that turns raw PDF text into structured fields: invoice number, amounts,
  line items, billing period start/end — plus contract terms when a contract PDF is
  supplied. The Multi-PDF variant handles batches of attachments in one run.

### 3.3 Miraggio — L1 & L2 Approval Webhook (SECURED)
- **Webhook path:** `/webhook/approval` (only one workflow may own this path at a time).
- `Validate Token` reads the **real** approver (`actor_email` / `actor_name`) from the
  token row — which is written **only by the authenticated dashboard**. Tokens with no
  actor are rejected with reason `UNATTRIBUTED`, so old emailed bearer links no longer work.
- On approval it PATCHes the bill status and writes the human-readable `l1_approved_by` /
  `l2_approved_by` (and rejection reason) directly — no reliance on a dashboard race.
- L2 is a **"Review & Approve on Dashboard"** notification (deep link), not buttons.

### 3.4 Miraggio — Vendor Payment Confirmation Email
- Fires after a payment is logged. For each payment it emails the vendor a receipt with
  **UTR, amount paid, payment mode, and billing period**.
- Driven by a Supabase **DB Webhook** on `INSERT` into `payment_notifications` (see §4),
  so bulk uploads automatically notify every vendor in the batch.

> **Why the "SECURED" rewrite happened (2026-06-02):** the original emailed APPROVE links
> were bearer tokens — possession equalled approval, and the approver was hardcoded by
> level (L1→one person, L2→another) rather than the person who actually clicked. Role
> checks also lived only in the React app, so the public anon key could write to `bills` /
> `approval_tokens` directly. The rewrite moved approval into the authenticated dashboard
> and enforced it in the database with RLS.

---

## 4. Data model (Supabase)

Core tables referenced by the automations (full schema in the SQL files):

**`payment_notifications`** — queue between the app and n8n. The app inserts one row per
payment; a Supabase DB Webhook fires n8n on `INSERT`; n8n emails the vendor and updates
`status` (`pending` → `sent` / `failed`).

Key columns: `payment_id`, `vendor_id`, `bill_id`, `vendor_email`, `vendor_name`,
`invoice_number`, `amount_paid`, `utr`, `payment_mode`, `paid_at`, `payment_approved_at`,
`paid_by`, `billing_period_start`, `billing_period_end`, `status`, `sent_at`.

**`bulk_upload_logs`** — one row per bulk-upload session for audit: `uploaded_by`,
`filename`, `total_rows`, `successful_rows`, `payment_ids[]`, `uploaded_at`.

**`payments`** — payment records (includes `payment_approved_at`).

**`bills`** — invoices with status, anomaly flags, `l1_approved_by` / `l2_approved_by`,
rejection reason, and the stored PDF URL.

**`vendors`** — vendor master (contract validity, GSTIN, PAN, billing cycle).

**`approval_tokens`** — per-approval tokens; written only by the authenticated dashboard
with the real actor, validated by the approval webhook.

**`profiles`** — users and roles (`l1`, `l2`, `admin`, `finance`).

**Storage:** a `bills` bucket (public read, service-role write) holds invoice PDFs; the
direct URL is stored on the bill row.

### Supabase DB Webhook
```
Table:  payment_notifications
Event:  INSERT
Method: POST
URL:    https://<n8n-instance>/webhook/miraggio-bulk-payment-notification
```

---

## 5. Security model (RLS hardening)

Enforced in the database, not just the UI:
- RLS enabled on `profiles`, `bills`, `approval_tokens`.
- A signed-in user may create an `approval_tokens` row **only for their own email** and
  **only for a level their role permits** (admin may do both). This is the server-side
  equivalent of the app's `canActOnBill` check.
- n8n uses the **service role** (full access); authenticated app users get scoped
  read/insert. The anon key alone can no longer approve anything.

Apply order when deploying changes: **(1)** apply the SQL migration, **(2)** import the
workflow JSONs as new inactive workflows, **(3)** point them at the same `/webhook/approval`
path and shared credentials, **(4)** deactivate old workflows then activate the new ones,
**(5)** smoke-test an end-to-end approval.

---

## 6. Outcomes

- A vendor emails an invoice → Claude reads it → the bill appears in the approver's queue
  with anomaly flags, line items, and contract context — within seconds, automatically.
- Live anomaly detection (e.g. a bill exceeding a vendor's contract maximum is flagged and
  can be rejected at L1, preventing unauthorized payment).
- Single approver interface with full context, replacing file/email hunting.
- Automatic bulk payment receipts to every vendor in a batch.
- Every approval, rejection, and payment is timestamped and attributed — full audit trail.
- PDF invoices archived with direct URL links in the database.

---

## 7. Repo layout

```
miraggio-billing-context/
├─ README.md                  ← this document
├─ app/                       ← React dashboard source (Vite project)
│  ├─ src/
│  │  ├─ pages/               Dashboard, Bills, BillDetail, Approvals, Vendors,
│  │  │                       VendorDetail, VendorLedger, Contracts, Payments, Users, Login
│  │  ├─ components/          MicroSidebar, ApproveRejectActions, BulkPaymentUpload, …
│  │  ├─ contexts/            AuthContext.jsx
│  │  └─ lib/                 supabase.js, approval.js, utils.js
│  ├─ supabase/migrations/    app-side DB migrations (incl. 20260602 RLS hardening)
│  ├─ package.json, vite.config.js, vercel.json, eslint.config.js
├─ n8n-workflows/             ← automation exports (import into n8n)
│  ├─ Vendor Bill Fetch — PROD (SECURED email).json
│  ├─ Miraggio — L1 & L2 Approval Webhook (SECURED).json
│  ├─ Claude — Extract Bill + Contract (AI Agent).json
│  ├─ Claude — Extract Bill + Contract (Multi-PDF).json
│  ├─ Miraggio — Vendor Payment Confirmation Email.json
│  ├─ multiple bill fetch prod.json   (+ earlier non-secured versions)
│  └─ SECURED_approval_ROLLOUT.md
└─ supabase/                  ← standalone SQL migrations
   ├─ bulk_payment_tables.sql
   └─ bill_pdf_sync_migration.sql
```

### Running the dashboard locally
```bash
cd app
npm install
# create app/.env with your Supabase URL + anon key (never commit it)
npm run dev
```
`node_modules/`, `dist/`, and `.env` are intentionally **not** committed (see `.gitignore`).
Reinstall dependencies with `npm install` from `package.json` / `package-lock.json`.

---

*Miraggio Lifestyles Pvt. Ltd. — Confidential. Built in-house with React, n8n, Claude, and Supabase.*
