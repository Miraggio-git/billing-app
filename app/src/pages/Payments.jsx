import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import { Icon } from '../components/Icon'
import { BulkPaymentUpload } from '../components/BulkPaymentUpload'

const MODE_CFG = {
  NEFT:   { bg: 'var(--lime-dim)',    color: 'var(--lime)',   border: 'rgba(163,230,53,0.25)' },
  RTGS:   { bg: 'var(--green-light)', color: 'var(--green)',  border: 'rgba(34,197,94,0.25)' },
  UPI:    { bg: 'var(--orange-dim)',  color: 'var(--primary)', border: 'rgba(29,78,216,0.25)' },
  CHEQUE: { bg: 'var(--yellow-light)',color: 'var(--yellow)', border: 'rgba(234,179,8,0.25)' },
}

const TH = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }

export function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('id,payment_mode,utr_or_cheque_number,amount_paid,paid_at,paid_by,receipt_url,receipt_filename,created_at,vendors(name),bills(invoice_number,stamped_invoice_url,stamped_invoice_filename)')
      .order('paid_at', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid), 0)
  const filtered = payments.filter(p => {
    const matchMode = modeFilter === 'ALL' || p.payment_mode === modeFilter
    const q = search.toLowerCase()
    return matchMode && (!q || (p.vendors?.name || '').toLowerCase().includes(q) || (p.utr_or_cheque_number || '').toLowerCase().includes(q) || (p.bills?.invoice_number || '').toLowerCase().includes(q))
  })

  return (
    <div style={{ padding: '32px 36px', width: '100%' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>Payments</h1>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>
            {payments.length} transactions ·{' '}
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(totalPaid)} total</span>
          </div>
        </div>
        <BulkPaymentUpload onSuccess={load} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '8px 14px', flex: 1, maxWidth: 300 }}>
          <Icon name="search" size={14} color="var(--text3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor, UTR, invoice…" style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, color: 'var(--text)', fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4 }}>
          {['ALL', 'NEFT', 'RTGS', 'UPI', 'CHEQUE'].map(m => {
            const isActive = modeFilter === m
            const mc = MODE_CFG[m]
            return (
              <button key={m} onClick={() => setModeFilter(m)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                background: isActive ? (mc?.bg || 'var(--surface3)') : 'transparent',
                color: isActive ? (mc?.color || 'var(--text)') : 'var(--text3)',
              }}>{m}</button>
            )
          })}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 52, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {['Vendor', 'Invoice', 'Amount', 'Mode', 'UTR / Cheque', 'Paid By', 'Date', 'Receipt', 'Stamped Invoice'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const mc = MODE_CFG[p.payment_mode] || { bg: 'var(--surface3)', color: 'var(--text2)', border: 'var(--border2)' }
                return (
                  <tr key={p.id} className="table-row-hover" style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '13px 16px', fontWeight: 500, fontSize: 13 }}>{p.vendors?.name || '—'}</td>
                    <td style={{ padding: '13px 16px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{p.bills?.invoice_number || '—'}</span></td>
                    <td style={{ padding: '13px 16px' }}><span className="mono" style={{ fontWeight: 700, fontSize: 13, color: 'var(--green)' }}>{fmt(p.amount_paid)}</span></td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ background: mc.bg, color: mc.color, border: `1px solid ${mc.border}`, borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{p.payment_mode}</span>
                    </td>
                    <td style={{ padding: '13px 16px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{p.utr_or_cheque_number || '—'}</span></td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text2)' }}>{p.paid_by || '—'}</td>
                    <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtDate(p.paid_at)}</td>
                    <td style={{ padding: '13px 16px' }}>
                      {p.receipt_url ? (
                        <a href={p.receipt_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                          <Icon name="external" size={13} color="var(--primary)" /> View
                        </a>
                      ) : <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {p.bills?.stamped_invoice_url ? (
                        <a href={p.bills.stamped_invoice_url} target="_blank" rel="noreferrer" title={p.bills.stamped_invoice_filename || 'Stamped invoice'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}>
                          <Icon name="external" size={13} color="var(--green)" /> View
                        </a>
                      ) : <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 52, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No payment records</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

