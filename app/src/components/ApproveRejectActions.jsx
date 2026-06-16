import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { submitApproval, canActOnBill, pendingLevelFor } from '../lib/approval'
import { Icon } from './Icon'

/**
 * Reusable Approve / Reject button pair for a bill.
 *
 * Props:
 *   - bill: { id, status, ... }
 *   - size: 'sm' | 'md' (default 'md')
 *   - onDone: (updatedBillPatch) => void — called after success
 *   - stopRowClick: boolean — when true, calls e.stopPropagation on buttons
 *                              (use this when inside a clickable table row)
 */
export function ApproveRejectActions({ bill, size = 'md', onDone, stopRowClick = false }) {
  const { role, profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const level = pendingLevelFor(bill?.status)
  const canAct = canActOnBill({ role, status: bill?.status })

  if (!canAct || !level) return null

  const click = (e, fn) => {
    if (stopRowClick) e?.stopPropagation?.()
    fn()
  }

  const handleApprove = async () => {
    setBusy(true); setErr('')
    const res = await submitApproval({ billId: bill.id, level, action: 'APPROVE', profile })
    setBusy(false)
    if (!res.ok) { setErr(res.error || 'Failed'); return }
    onDone?.({
      status: level === 'L1' ? 'PENDING_L2' : 'PENDING_PAYMENT',
      [`${level.toLowerCase()}_approved_by`]: profile?.name || profile?.email,
      [`${level.toLowerCase()}_approved_at`]: new Date().toISOString(),
    })
  }

  const handleReject = async () => {
    if (!reason.trim()) { setErr('Please provide a reason'); return }
    setBusy(true); setErr('')
    const res = await submitApproval({ billId: bill.id, level, action: 'REJECT', profile, reason })
    setBusy(false)
    if (!res.ok) { setErr(res.error || 'Failed'); return }
    setShowReject(false); setReason('')
    onDone?.({
      status: level === 'L1' ? 'REJECTED_L1' : 'REJECTED_L2',
      [`${level.toLowerCase()}_rejected_by`]: profile?.name || profile?.email,
      [`${level.toLowerCase()}_rejected_at`]: new Date().toISOString(),
      [`${level.toLowerCase()}_rejection_reason`]: reason.trim(),
    })
  }

  const pad = size === 'sm' ? '5px 10px' : '8px 14px'
  const fs  = size === 'sm' ? 11 : 13

  return (
    <>
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={(e) => click(e, handleApprove)}
          disabled={busy}
          style={{
            padding: pad,
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(34,197,94,0.4)',
            background: 'rgba(34,197,94,0.12)',
            color: '#15803d',
            fontWeight: 700,
            fontSize: fs,
            cursor: busy ? 'wait' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            opacity: busy ? 0.6 : 1,
          }}
          title={`${level} Approve`}
        >
          ✓ Approve
        </button>
        <button
          onClick={(e) => click(e, () => setShowReject(true))}
          disabled={busy}
          style={{
            padding: pad,
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--red)',
            fontWeight: 700,
            fontSize: fs,
            cursor: busy ? 'wait' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            opacity: busy ? 0.6 : 1,
          }}
          title={`${level} Reject`}
        >
          ✕ Reject
        </button>
        {err && <span style={{ fontSize: 11, color: 'var(--red)' }}>{err}</span>}
      </div>

      {showReject && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowReject(false) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
        >
          <div style={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:'var(--radius-lg)', width:440, animation:'fadeUp 0.2s ease both' }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:15, color:'var(--red)' }}>Reject {level} – Bill {bill.invoice_number || ''}</span>
              <button onClick={() => { setShowReject(false); setReason('') }} style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', padding:4 }}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <div style={{ padding:'18px 22px' }}>
              <label style={{ display:'flex', flexDirection:'column', gap:8, fontSize:12, color:'var(--text3)', fontWeight:500 }}>
                Rejection reason *
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="input-base"
                  rows={4}
                  placeholder="Explain why this bill is being rejected…"
                  style={{ fontSize: 13, resize: 'vertical' }}
                />
              </label>
              {err && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)' }}>{err}</div>}
            </div>
            <div style={{ padding:'12px 22px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button className="btn-ghost" onClick={() => { setShowReject(false); setReason('') }} disabled={busy}>Cancel</button>
              <button
                onClick={handleReject}
                disabled={busy || !reason.trim()}
                style={{ padding:'9px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--red)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', opacity: (busy||!reason.trim()) ? 0.5 : 1 }}
              >
                {busy ? 'Submitting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
