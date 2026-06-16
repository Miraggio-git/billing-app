import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmt, fmtDate } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icon'

const FIELDS = [
  ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['contact_person', 'Contact Person'],
  ['gstin', 'GSTIN'], ['pan', 'PAN'], ['vendor_code', 'Vendor Code'],
]
const BANK_FIELDS = [
  ['bank_name', 'Bank Name'], ['bank_account_no', 'Account No.'], ['bank_ifsc', 'IFSC Code'], ['bank_account_name', 'Account Holder'],
]
const MONO_FIELDS = new Set(['gstin', 'pan', 'vendor_code', 'bank_account_no', 'bank_ifsc'])
const TH = { padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.03em' }

function agreementStatusStyle(status) {
  const s = (status || '').toUpperCase()
  if (s === 'ACTIVE') return { background: 'var(--green-bg, #d1fae5)', color: 'var(--green, #059669)', border: '1px solid var(--green-border, #6ee7b7)' }
  if (s === 'PENDING') return { background: 'var(--yellow-bg, #fef9c3)', color: 'var(--yellow, #b45309)', border: '1px solid var(--yellow-border, #fde047)' }
  if (s === 'EXPIRED' || s === 'INACTIVE') return { background: 'var(--red-bg, #fee2e2)', color: 'var(--red, #dc2626)', border: '1px solid var(--red-border, #fca5a5)' }
  return { background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }
}

export function VendorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role } = useAuth()
  const [vendor, setVendor] = useState(null)
  const [bills, setBills] = useState([])
  const [agreements, setAgreements] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [vRes, bRes, aRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).single(),
        supabase.from('bills').select('id,invoice_number,amount,status,billing_period_start,billing_period_end,created_at').eq('vendor_id', id).order('created_at', { ascending: false }),
        supabase.from('agreements').select('*').eq('vendor_id', id).order('created_at', { ascending: false }),
      ])
      setVendor(vRes.data); setForm(vRes.data || {}); setBills(bRes.data || []); setAgreements(aRes.data || []); setLoading(false)
    }
    load()
  }, [id])

  async function handleSave() {
    setSaving(true); setError('')
    const { error: err } = await supabase.from('vendors').update({ ...form, updated_at: new Date().toISOString() }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    setVendor(form); setEditing(false); setSaving(false)
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
  if (!vendor) return <div style={{ padding: 40, color: 'var(--red)', fontSize: 13 }}>Vendor not found</div>

  const totalBilled = bills.reduce((s, b) => s + Number(b.amount), 0)
  const totalPaid = bills.filter(b => b.status === 'PAID').reduce((s, b) => s + Number(b.amount), 0)

  return (
    <div style={{ padding: '32px 36px', width: '100%', maxWidth: 1000 }}>
      <button onClick={() => navigate('/vendors')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: 0, cursor: 'pointer' }}>
        <Icon name="chevron_left" size={14} /> Back to Vendors
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>{vendor.name}</h1>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{vendor.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <StatusBadge status={vendor.status} type="vendor" />
          {!editing && role === 'admin' && (
            <button className="btn-ghost" onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="edit" size={13} /> Edit
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Details card */}
          <div className="card">
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Contact &amp; Tax Info</span>
              {editing && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" onClick={() => { setEditing(false); setForm(vendor) }}>Cancel</button>
                  <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              )}
            </div>
            <div style={{ padding: '18px 20px' }}>
              {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {FIELDS.map(([key, label]) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.02em' }}>{label}</div>
                    {editing
                      ? <input value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className="input-base" style={{ fontSize: 13 }} />
                      : <div style={{ fontSize: 13, fontFamily: MONO_FIELDS.has(key) ? 'DM Mono, monospace' : undefined, color: 'var(--text)' }}>{vendor[key] || '—'}</div>
                    }
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>Status</div>
                  {editing
                    ? <select value={form.status || 'PENDING'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="input-base" style={{ fontSize: 13 }}>
                        {['ACTIVE', 'PENDING', 'INACTIVE'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    : <StatusBadge status={vendor.status} type="vendor" />
                  }
                </div>
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 14 }}>Bank Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {BANK_FIELDS.map(([key, label]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
                      {editing
                        ? <input value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className="input-base" style={{ fontSize: 13 }} />
                        : <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{vendor[key] || '—'}</div>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bill history */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Bill History · {bills.length} records</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {['Invoice', 'Amount', 'Period', 'Status'].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No bills yet</td></tr>
                ) : bills.map((b, i) => (
                  <tr key={b.id} className="table-row-hover" style={{ borderBottom: i < bills.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }} onClick={() => navigate(`/bills/${b.id}`)}>
                    <td style={{ padding: '10px 16px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{b.invoice_number || '—'}</span></td>
                    <td style={{ padding: '10px 16px' }}><span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{fmt(b.amount)}</span></td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text3)' }}>{fmtDate(b.billing_period_start)} → {fmtDate(b.billing_period_end)}</td>
                    <td style={{ padding: '10px 16px' }}><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Agreements */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Agreements · {agreements.length} records</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {['Title / Description', 'Valid Period', 'Amount', 'Status'].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {agreements.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No agreements linked to this vendor</td></tr>
                ) : agreements.map((a, i) => {
                  const title = a.title || a.name || a.service_description || a.description || '—'
                  const startDate = a.start_date || a.valid_from
                  const endDate = a.end_date || a.valid_to
                  const validPeriod = startDate || endDate ? `${fmtDate(startDate)} → ${fmtDate(endDate)}` : '—'
                  const amount = (a.amount != null || a.max_amount != null) ? fmt(a.amount ?? a.max_amount) : '—'
                  const statusStyle = agreementStatusStyle(a.status)
                  return (
                    <tr key={a.id || i} className="table-row-hover" style={{ borderBottom: i < agreements.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{title}</div>
                        {a.created_at && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{fmtDate(a.created_at)}</div>}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text3)' }}>{validPeriod}</td>
                      <td style={{ padding: '10px 16px' }}><span className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{amount}</span></td>
                      <td style={{ padding: '10px 16px' }}>
                        {a.status ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.03em', ...statusStyle }}>
                            {a.status.toUpperCase()}
                          </span>
                        ) : <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary panel */}
        <div>
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 18 }}>Financial Summary</div>
            {[
              ['Total Bills', String(bills.length), 'var(--text)'],
              ['Total Billed', fmt(totalBilled), 'var(--text)'],
              ['Total Paid', fmt(totalPaid), 'var(--green)'],
              ['Outstanding', fmt(totalBilled - totalPaid), totalBilled - totalPaid > 0 ? 'var(--primary)' : 'var(--green)'],
              ['Agreements', String(agreements.length), 'var(--text)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 14, color }}>{val}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Registered {fmtDate(vendor.created_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

