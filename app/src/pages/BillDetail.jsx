import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icon'
import { useAuth } from '../contexts/AuthContext'
import { submitApproval, pendingLevelFor } from '../lib/approval'

const TH = { padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.03em' }

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10, alignItems: 'center' }}>
      <span style={{ color: 'var(--text3)', fontSize: 12 }}>{label}</span>
      <span style={{ fontFamily: mono ? 'DM Mono, monospace' : undefined, color: 'var(--text2)', fontSize: 13 }}>{value || '—'}</span>
    </div>
  )
}

function CardHeader({ label, color = 'var(--primary)' }) {
  return (
    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.02em' }}>{label}</span>
    </div>
  )
}

export function BillDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, profile } = useAuth()
  const [bill, setBill] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payForm, setPayForm] = useState({ mode: 'NEFT', utr: '', paid_by: '', paid_at: new Date().toISOString().slice(0, 10) })
  const [receiptFile, setReceiptFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [paySuccess, setPaySuccess] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [stampedFile, setStampedFile] = useState(null)
  const [stampedUploading, setStampedUploading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bills')
        .select(`*, vendors(id,name,email,gstin,pan,contact_person,phone,bank_name,bank_account_no,bank_ifsc), contracts(id,service_description,max_amount,billing_cycle,payment_terms_days,valid_from,valid_to)`)
        .eq('id', id).single()
      setBill(data); setLoading(false)
    }
    load()
  }, [id])

  async function handleLogPayment() {
    if (!payForm.utr.trim() || !payForm.paid_by.trim()) return
    setSaving(true)

    let uploadedUrl = null, uploadedFilename = null
    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop()
      const path = `receipts/${id}_${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('receipts').upload(path, receiptFile, { contentType: receiptFile.type, upsert: true })
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
        uploadedUrl = urlData.publicUrl
        uploadedFilename = receiptFile.name
      }
    }

    const { error: billErr } = await supabase.from('bills').update({ status: 'PAID', updated_at: new Date().toISOString() }).eq('id', id)
    if (!billErr) {
      await supabase.from('payments').insert({
        bill_id: id, vendor_id: bill.vendor_id, payment_mode: payForm.mode,
        utr_or_cheque_number: payForm.utr, amount_paid: bill.amount,
        paid_at: payForm.paid_at, paid_by: payForm.paid_by,
        receipt_url: uploadedUrl, receipt_filename: uploadedFilename,
      })
      setBill(prev => ({ ...prev, status: 'PAID' }))
      setReceiptUrl(uploadedUrl); setPaySuccess(true)
    }
    setSaving(false)
  }

  async function handleApprove() {
    const level = pendingLevelFor(bill?.status)
    if (!level) { setActionError('Bill is not pending approval'); return }
    setActing(true); setActionError('')

    // Optional: upload a stamped invoice PDF alongside the approval.
    let stampedPatch = null
    if (stampedFile) {
      setStampedUploading(true)
      const ext = stampedFile.name.split('.').pop()
      const path = `stamped/${id}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, stampedFile, { contentType: stampedFile.type, upsert: true })
      setStampedUploading(false)
      if (upErr) { setActing(false); setActionError(`Stamped invoice upload failed: ${upErr.message}`); return }
      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
      stampedPatch = {
        stamped_invoice_url: urlData.publicUrl,
        stamped_invoice_filename: stampedFile.name,
        stamped_invoice_uploaded_by: profile?.name || profile?.email || 'Dashboard User',
        stamped_invoice_uploaded_at: new Date().toISOString(),
      }
    }

    const res = await submitApproval({ billId: id, level, action: 'APPROVE', profile })
    if (!res.ok) { setActing(false); setActionError(res.error || 'Approval failed'); return }

    // Persist the stamped invoice after submitApproval (which patches name fields
    // ~1.2s after the webhook) so our values are not overwritten.
    if (stampedPatch) {
      const { error: stErr } = await supabase.from('bills').update(stampedPatch).eq('id', id)
      if (stErr) { setActionError(`Approved, but stamped invoice link failed to save: ${stErr.message}`) }
    }

    setActing(false)
    // Reflect the change locally — webhook has flipped status server-side.
    const now = new Date().toISOString()
    const actor = profile?.name || profile?.email || 'System'
    const update = level === 'L1'
      ? { status: 'PENDING_L2', l1_approved_at: now, l1_approved_by: actor }
      : { status: 'PENDING_PAYMENT', l2_approved_at: now, l2_approved_by: actor }
    setBill(prev => ({ ...prev, ...update, ...(stampedPatch || {}) }))
    setStampedFile(null)
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    const level = pendingLevelFor(bill?.status)
    if (!level) { setActionError('Bill is not pending approval'); return }
    setActing(true); setActionError('')
    const res = await submitApproval({ billId: id, level, action: 'REJECT', profile, reason: rejectReason })
    setActing(false)
    if (!res.ok) { setActionError(res.error || 'Rejection failed'); return }
    const now = new Date().toISOString()
    const actor = profile?.name || profile?.email || 'System'
    const update = level === 'L1'
      ? { status: 'REJECTED_L1', l1_rejected_by: actor, l1_rejected_at: now, l1_rejection_reason: rejectReason.trim() }
      : { status: 'REJECTED_L2', l2_rejected_by: actor, l2_rejected_at: now, l2_rejection_reason: rejectReason.trim() }
    setBill(prev => ({ ...prev, ...update }))
    setShowRejectModal(false); setRejectReason('')
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
  if (!bill) return <div style={{ padding: 40, color: 'var(--red)', fontSize: 13 }}>Bill not found</div>

  const canApprove = bill && (
    (role === 'l1' && bill.status === 'PENDING_L1') ||
    (role === 'l2' && bill.status === 'PENDING_L2') ||
    (role === 'admin' && (bill.status === 'PENDING_L1' || bill.status === 'PENDING_L2'))
  )
  const canReject = bill && (
    (role === 'l1' && bill.status === 'PENDING_L1') ||
    (role === 'l2' && bill.status === 'PENDING_L2') ||
    (role === 'admin' && (bill.status === 'PENDING_L1' || bill.status === 'PENDING_L2'))
  )

  const v = bill.vendors
  const c = bill.contracts
  const contractPct = c?.max_amount ? Math.round((Number(bill.amount) / Number(c.max_amount)) * 100) : null
  const lineItems = Array.isArray(bill.line_items) ? bill.line_items : []
  const anomalyFlags = Array.isArray(bill.anomaly_flags) ? bill.anomaly_flags : []

  const timeline = [
    { label: 'Submitted',   date: bill.created_at,     done: true,                  by: v?.contact_person },
    { label: 'L1 Approval', date: bill.l1_approved_at, done: !!bill.l1_approved_at, by: bill.l1_approved_by, rejected: bill.status === 'REJECTED_L1', reason: bill.l1_rejection_reason },
    { label: 'L2 Approval', date: bill.l2_approved_at, done: !!bill.l2_approved_at, by: bill.l2_approved_by, rejected: bill.status === 'REJECTED_L2', reason: bill.l2_rejection_reason },
    { label: 'Payment',     date: null,                done: bill.status === 'PAID' || paySuccess },
  ]

  return (
    <>
      {/* Reject modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', width: 440, animation: 'fadeUp 0.2s ease both' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--red)' }}>Reject Bill</span>
              <button onClick={() => { setShowRejectModal(false); setRejectReason('') }} style={{ background: 'none', border: 'none', color: 'var(--text3)', lineHeight: 1 }}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                Rejection reason *
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="input-base"
                  rows={4}
                  style={{ fontSize: 13, resize: 'vertical' }}
                  placeholder="Explain why this bill is being rejected…"
                />
              </label>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn-ghost" onClick={() => { setShowRejectModal(false); setRejectReason('') }}>Cancel</button>
              <button
                onClick={handleReject}
                disabled={acting || !rejectReason.trim()}
                style={{ padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--red)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: acting || !rejectReason.trim() ? 0.5 : 1 }}
              >
                {acting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '32px 36px', width: '100%', maxWidth: 1060 }}>
        <button onClick={() => navigate('/bills')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: 0, cursor: 'pointer' }}>
          <Icon name="chevron_left" size={14} /> Back to Bills Queue
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>{bill.invoice_number || 'Untitled Bill'}</h1>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>{v?.name} · {fmtDate(bill.created_at)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {bill.bill_pdf_url ? (
              <a
                href={bill.bill_pdf_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 'var(--radius)', border: '1px solid rgba(59,130,246,0.4)',
                  background: 'rgba(59,130,246,0.08)', color: 'var(--primary)',
                  fontWeight: 700, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                <Icon name="bills" size={13} color="var(--primary)" /> View Invoice PDF
              </a>
            ) : (
              <span
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border2)',
                  background: 'var(--surface2)', color: 'var(--text3)',
                  fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', opacity: 0.6,
                }}
              >
                <Icon name="bills" size={13} color="var(--text3)" /> No PDF
              </span>
            )}
            {bill.stamped_invoice_url && (
              <a
                href={bill.stamped_invoice_url}
                target="_blank"
                rel="noreferrer"
                title={bill.stamped_invoice_filename || 'Stamped invoice'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 'var(--radius)', border: '1px solid rgba(34,197,94,0.4)',
                  background: 'var(--green-light)', color: 'var(--green)',
                  fontWeight: 700, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                <Icon name="bills" size={13} color="var(--green)" /> Stamped Invoice
              </a>
            )}
            <StatusBadge status={bill.status} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Anomaly flags */}
            {anomalyFlags.length > 0 && (
              <div style={{ background: 'var(--yellow-light)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 'var(--radius-lg)', padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, fontSize: 13, color: 'var(--yellow)' }}>
                  <Icon name="alert" size={14} color="var(--yellow)" /> AI Anomaly Flags
                </div>
                {anomalyFlags.map((f, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: i < anomalyFlags.length - 1 ? 6 : 0 }}>
                    <span style={{ color: 'var(--yellow)', flexShrink: 0 }}>⚠</span><span>{f}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Rejection reason */}
            {(bill.l1_rejection_reason || bill.l2_rejection_reason) && (
              <div style={{ background: 'var(--red-light)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-lg)', padding: '14px 18px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 6 }}>Rejection Reason</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{bill.l1_rejection_reason || bill.l2_rejection_reason}</div>
              </div>
            )}

            {/* GST Breakdown */}
            {(bill.taxable_amount || bill.cgst_amount || bill.sgst_amount) && (
              <div className="card">
                <CardHeader label="GST Breakdown" color="var(--lime)" />
                <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[['Taxable', bill.taxable_amount], ['CGST', bill.cgst_amount], ['SGST', bill.sgst_amount], ['IGST', bill.igst_amount]].map(([l, val]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{l}</span>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Line items */}
            <div className="card">
              <CardHeader label="Line Items" color="var(--primary)" />
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={TH}>Description</th>
                    <th style={{ ...TH, textAlign: 'center' }}>Qty</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0
                    ? <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No line items</td></tr>
                    : lineItems.map((li, i) => (
                      <tr key={i} style={{ borderBottom: i < lineItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '11px 16px', fontSize: 13 }}>{li.description}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>{li.quantity ?? 1}</td>
                        <td style={{ padding: '11px 16px', textAlign: 'right' }}><span className="mono" style={{ fontSize: 13 }}>{fmt(li.total ?? li.amount)}</span></td>
                      </tr>
                    ))
                  }
                  <tr style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13 }} colSpan={2}>Total</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}><span className="mono" style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{fmt(bill.amount)}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Contract validation */}
            {c && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 12 }}>Contract Validation</div>
                <InfoRow label="Max Amount" value={fmt(c.max_amount)} mono />
                <InfoRow label="This Invoice" value={`${fmt(bill.amount)} (${contractPct}%)`} mono />
                <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden', marginTop: 12, marginBottom: 8 }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(contractPct, 100)}%`,
                    background: contractPct > 90 ? 'linear-gradient(90deg, var(--yellow), var(--red))' : 'linear-gradient(90deg, var(--lime), var(--green))',
                    borderRadius: 3,
                    transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
                  }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Cycle: {c.billing_cycle || '—'} · Terms: {c.payment_terms_days || '—'} days
                </div>
              </div>
            )}

            {/* Log Payment */}
            {bill.status === 'PENDING_PAYMENT' && !paySuccess && (role === 'admin' || role === 'finance') && (
              <div className="card" style={{ borderColor: 'var(--primary)' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>Log Payment</span>
                </div>
                <div style={{ padding: '18px 18px 0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      ['mode', 'Payment Mode', 'select'],
                      ['paid_at', 'Payment Date', 'date'],
                      ['utr', 'UTR / Cheque No.', 'text'],
                      ['paid_by', 'Paid By', 'text'],
                    ].map(([key, label, type]) => (
                      <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                        {label}
                        {type === 'select'
                          ? <select value={payForm[key]} onChange={e => setPayForm(p => ({ ...p, [key]: e.target.value }))} className="input-base">
                              {['NEFT','RTGS','UPI','CHEQUE'].map(m => <option key={m}>{m}</option>)}
                            </select>
                          : <input type={type} value={payForm[key]} onChange={e => setPayForm(p => ({ ...p, [key]: e.target.value }))} placeholder={key === 'utr' ? 'e.g. UTR2026XXXXXXXXXX' : 'Your name'} className="input-base" />
                        }
                      </label>
                    ))}
                  </div>

                  {/* Receipt upload */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginBottom: 8 }}>
                      Payment Receipt <span style={{ opacity: 0.6, fontWeight: 400 }}>(PDF or image, optional)</span>
                    </div>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      border: `1px dashed ${receiptFile ? 'var(--green)' : 'var(--border2)'}`,
                      borderRadius: 'var(--radius)', padding: '10px 14px', cursor: 'pointer',
                      background: receiptFile ? 'var(--green-light)' : 'var(--surface2)',
                      transition: 'all 0.2s',
                    }}>
                      <Icon name="bills" size={14} color={receiptFile ? 'var(--green)' : 'var(--text3)'} />
                      <span style={{ fontSize: 13, color: receiptFile ? 'var(--green)' : 'var(--text3)', flex: 1 }}>
                        {receiptFile ? receiptFile.name : 'Attach receipt…'}
                      </span>
                      {receiptFile && (
                        <button type="button" onClick={e => { e.preventDefault(); setReceiptFile(null) }} style={{ background: 'none', border: 'none', color: 'var(--red)', padding: 0, lineHeight: 1 }}>
                          <Icon name="x" size={14} color="var(--red)" />
                        </button>
                      )}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={e => setReceiptFile(e.target.files[0] || null)} />
                    </label>
                  </div>

                  <div style={{ padding: '14px 0' }}>
                    <button
                      className="btn-primary"
                      onClick={handleLogPayment}
                      disabled={saving || !payForm.utr.trim() || !payForm.paid_by.trim()}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {saving ? (receiptFile ? 'Uploading receipt…' : 'Processing…') : 'Confirm Payment'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(paySuccess || bill.status === 'PAID') && (
              <div style={{ background: 'var(--green-light)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name="check" size={18} color="var(--green)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>Payment Recorded</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>Bill marked as paid in system.</div>
                </div>
                {receiptUrl && (
                  <a href={receiptUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--green)', fontWeight: 600, textDecoration: 'none', background: 'rgba(34,197,94,0.1)', borderRadius: 8, padding: '6px 12px', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <Icon name="external" size={12} color="var(--green)" /> View Receipt
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Action card — shown only to eligible approvers */}
            {(canApprove || canReject) && (
              <div className="card" style={{ borderColor: 'var(--primary)' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--orange-dim, rgba(29,78,216,0.08))' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Action Required
                  </span>
                </div>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
                    {bill.status === 'PENDING_L1' ? 'Awaiting L1 approval' : 'Awaiting L2 approval'}
                  </div>
                  {actionError && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--red)', fontSize: 12 }}>
                      {actionError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {canApprove && (
                      <button
                        className="btn-primary"
                        onClick={handleApprove}
                        disabled={acting}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        {acting ? 'Processing…' : 'Approve'}
                      </button>
                    )}
                    {canReject && (
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={acting}
                        style={{
                          flex: canApprove ? undefined : 1,
                          padding: '9px 18px',
                          borderRadius: 'var(--radius)',
                          border: '1px solid rgba(239,68,68,0.4)',
                          background: 'rgba(239,68,68,0.08)',
                          color: 'var(--red)',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        Reject
                      </button>
                    )}
                  </div>

                  {/* Optional stamped invoice — uploaded together with the approval */}
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>
                      Stamped Invoice <span style={{ opacity: 0.6, fontWeight: 400 }}>(PDF, optional)</span>
                    </div>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      border: `1px dashed ${stampedFile ? 'var(--primary)' : 'var(--border2)'}`,
                      borderRadius: 'var(--radius)', padding: '10px 14px', cursor: 'pointer',
                      background: stampedFile ? 'var(--orange-dim, rgba(29,78,216,0.08))' : 'var(--surface2)',
                      transition: 'all 0.2s',
                    }}>
                      <Icon name="bills" size={14} color={stampedFile ? 'var(--primary)' : 'var(--text3)'} />
                      <span style={{ fontSize: 13, color: stampedFile ? 'var(--primary)' : 'var(--text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stampedFile ? stampedFile.name : 'Attach stamped invoice…'}
                      </span>
                      {stampedFile && (
                        <button type="button" onClick={e => { e.preventDefault(); setStampedFile(null) }} style={{ background: 'none', border: 'none', color: 'var(--red)', padding: 0, lineHeight: 1, cursor: 'pointer' }}>
                          <Icon name="x" size={14} color="var(--red)" />
                        </button>
                      )}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={e => setStampedFile(e.target.files[0] || null)} />
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                      {stampedUploading ? 'Uploading…' : 'Optional. Attaches when you click Approve and is shared with finance.'}
                    </div>
                    {bill.stamped_invoice_url && (
                      <a href={bill.stamped_invoice_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                        <Icon name="external" size={12} color="var(--primary)" /> View current stamped invoice
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Vendor info */}
            <div className="card">
              <CardHeader label="Vendor" color="var(--lime)" />
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{v?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{v?.email}</div>
                <InfoRow label="GSTIN" value={v?.gstin} mono />
                <InfoRow label="PAN" value={v?.pan} mono />
                <InfoRow label="Contact" value={v?.contact_person} />
                <InfoRow label="Phone" value={v?.phone} mono />
                {v?.bank_name && (
                  <>
                    <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>Bank Details</div>
                    <InfoRow label="Bank" value={v.bank_name} />
                    <InfoRow label="Account" value={v.bank_account_no} mono />
                    <InfoRow label="IFSC" value={v.bank_ifsc} mono />
                  </>
                )}
              </div>
            </div>

            {/* Billing period */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 12 }}>Billing Period</div>
              <div className="mono" style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{fmtDate(bill.billing_period_start)}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0' }}>→</div>
              <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{fmtDate(bill.billing_period_end)}</div>
              {bill.invoice_date && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>Invoice date: {fmtDate(bill.invoice_date)}</div>}
              {bill.order_type && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 12, background: 'var(--surface3)', color: 'var(--text2)', borderRadius: 6, padding: '4px 10px', border: '1px solid var(--border2)' }}>{bill.order_type}</span>
                </div>
              )}
            </div>

            {/* Approval Timeline */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 16 }}>Approval Pipeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {timeline.map((t, i) => {
                  const dotColor = t.rejected ? 'var(--red)' : t.done ? 'var(--green)' : 'var(--border2)'
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0 }}>
                        <div style={{
                          width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                          background: dotColor,
                          border: t.done || t.rejected ? 'none' : '1px solid var(--border2)',
                          transition: 'all 0.3s',
                        }} />
                        {i < timeline.length - 1 && (
                          <div style={{ width: 1, height: 28, background: t.done ? 'var(--green)' : 'var(--border)', margin: '2px 0', opacity: t.done ? 0.4 : 0.3 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.rejected ? 'var(--red)' : t.done ? 'var(--green)' : 'var(--text3)' }}>
                          {t.label}{t.rejected ? ' · Rejected' : ''}
                        </div>
                        {t.date && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{fmtDate(t.date)}{t.by ? ` · ${t.by}` : ''}</div>}
                        {!t.date && !t.rejected && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Pending</div>}
                        {t.reason && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 3 }}>{t.reason}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Approver emails */}
            {(bill.l1_approver_email || bill.l2_approver_email) && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>Approver Emails</div>
                {bill.l1_approver_email && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}><span style={{ color: 'var(--text3)' }}>L1: </span>{bill.l1_approver_email}</div>}
                {bill.l2_approver_email && <div style={{ fontSize: 12, color: 'var(--text2)' }}><span style={{ color: 'var(--text3)' }}>L2: </span>{bill.l2_approver_email}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

