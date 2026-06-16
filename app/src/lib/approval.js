// src/lib/approval.js
// Helper to trigger L1/L2 approval/rejection from the dashboard.
//
// What this does:
//  1. Inserts a one-time row into approval_tokens (with actor info + reason).
//  2. Calls the existing n8n approval webhook with that token.
//  3. After the webhook returns, writes the actor's *name* into the bill
//     (l1_approved_by / l2_approved_by) and the rejection reason if any —
//     because the webhook only writes l1_approver_email / l2_approver_email
//     and not the human-readable name.
//
// Result: same downstream automation as an email-link click (status flip,
// L2 token generation, L2 approver email, vendor rejection email, etc.)
// AND the bill record shows the actual person who clicked.

import { supabase } from './supabase'

const APPROVAL_WEBHOOK_URL = 'https://mirragiohimanshu.app.n8n.cloud/webhook/approval'

function randomHexToken(bytes = 32) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Submit an approval/rejection decision to the n8n webhook.
 * @param {object} args
 * @param {string} args.billId    - bills.id (uuid)
 * @param {'L1'|'L2'} args.level
 * @param {'APPROVE'|'REJECT'} args.action
 * @param {object} args.profile   - { email, name } from AuthContext
 * @param {string} [args.reason]  - required when action === 'REJECT'
 * @returns {Promise<{ok:boolean, status?:number, error?:string}>}
 */
export async function submitApproval({ billId, level, action, profile, reason }) {
  if (!billId || !level || !action) return { ok: false, error: 'Missing required fields' }
  if (action === 'REJECT' && (!reason || !reason.trim())) {
    return { ok: false, error: 'Rejection reason is required' }
  }

  const token = randomHexToken()
  const actorEmail = profile?.email || null
  const actorName  = profile?.name  || profile?.email || 'Dashboard User'

  // 1. Insert a fresh one-time token row.
  const { error: tokErr } = await supabase.from('approval_tokens').insert({
    bill_id: billId,
    token,
    level,
    action,
    actor_email: actorEmail,
    actor_name: actorName,
    reason: action === 'REJECT' ? reason.trim() : null,
  })
  if (tokErr) return { ok: false, error: `Failed to create approval token: ${tokErr.message}` }

  // 2. Call the webhook. n8n responds with "Workflow got started." immediately;
  //    the actual DB updates happen async in the workflow.
  let webhookOk = false
  try {
    const resp = await fetch(`${APPROVAL_WEBHOOK_URL}?token=${token}`, { method: 'GET' })
    webhookOk = resp.ok
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: `Webhook returned ${resp.status}` }
    }
  } catch (e) {
    return { ok: false, error: `Webhook call failed: ${e.message || e}` }
  }

  // 3. Patch the bill with the human-readable approver name + (for reject) the
  //    rejection reason. We wait briefly so the webhook's status flip lands first
  //    — if we race it the webhook overwrites our values.
  await new Promise(r => setTimeout(r, 1200))

  const now = new Date().toISOString()
  const patch = { updated_at: now }
  if (level === 'L1' && action === 'APPROVE') {
    patch.l1_approved_by = actorName
    patch.l1_approver_email = actorEmail
    patch.l1_approved_at = now
  } else if (level === 'L1' && action === 'REJECT') {
    patch.l1_rejected_by = actorName
    patch.l1_rejected_at = now
    patch.l1_rejection_reason = reason.trim()
    patch.l1_approver_email = actorEmail
  } else if (level === 'L2' && action === 'APPROVE') {
    patch.l2_approved_by = actorName
    patch.l2_approver_email = actorEmail
    patch.l2_approved_at = now
  } else if (level === 'L2' && action === 'REJECT') {
    patch.l2_rejected_by = actorName
    patch.l2_rejected_at = now
    patch.l2_rejection_reason = reason.trim()
    patch.l2_approver_email = actorEmail
  }

  const { error: patchErr } = await supabase.from('bills').update(patch).eq('id', billId)
  if (patchErr) {
    // The webhook already ran successfully — we just couldn't write the name.
    // Surface a soft error; the bill status is still correct.
    return { ok: true, error: `Approved, but failed to record approver name: ${patchErr.message}` }
  }

  return { ok: true }
}

/**
 * Decide which approval level the bill needs based on its status.
 * Returns null if no approval is pending.
 */
export function pendingLevelFor(status) {
  if (status === 'PENDING_L1') return 'L1'
  if (status === 'PENDING_L2') return 'L2'
  return null
}

/**
 * Returns true if the given role can act on a bill in the given status.
 */
export function canActOnBill({ role, status }) {
  if (!role) return false
  const lvl = pendingLevelFor(status)
  if (!lvl) return false
  if (role === 'admin') return true
  if (role === 'l1' && lvl === 'L1') return true
  if (role === 'l2' && lvl === 'L2') return true
  return false
}
