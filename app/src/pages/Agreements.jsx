import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, daysUntil } from '../lib/utils'
import { Icon } from '../components/Icon'

const TH = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }

function AgreementStatusTag({ status, end_date, valid_to }) {
  const expiry = end_date || valid_to
  if (status) {
    const s = status.toUpperCase()
    if (s === 'ACTIVE') return <span style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Active</span>
    if (s === 'EXPIRED') return <span style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Expired</span>
    if (s === 'PENDING') return <span style={{ background: 'var(--yellow-light)', color: 'var(--yellow)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Pending</span>
    if (s === 'INACTIVE') return <span style={{ background: 'var(--surface3)', color: 'var(--text3)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Inactive</span>
  }
  if (expiry) {
    const days = daysUntil(expiry)
    if (days < 0) return <span style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Expired</span>
    if (days <= 30) return <span style={{ background: 'var(--yellow-light)', color: 'var(--yellow)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Exp in {days}d</span>
    return <span style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Active</span>
  }
  return <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
}

const EMPTY_FORM = { vendor_id: '', title: '', description: '', start_date: '', end_date: '', amount: '', status: 'ACTIVE' }

export function Agreements() {
  const navigate = useNavigate()
  const [agreements, setAgreements] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [aRes, vRes] = await Promise.all([
      supabase.from('agreements').select('*, vendors(id,name,email)').order('created_at', { ascending: false }),
      supabase.from('vendors').select('id,name').order('name'),
    ])
    setAgreements(aRes.data || [])
    setVendors(vRes.data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.vendor_id) { setFormError('Please select a vendor'); return }
    if (!form.title?.trim() && !form.description?.trim()) { setFormError('Please enter a title or description'); return }
    setSaving(true); setFormError('')
    const payload = {
      vendor_id: form.vendor_id,
      status: form.status || 'ACTIVE',
    }
    if (form.title?.trim()) payload.title = form.title.trim()
    if (form.description?.trim()) payload.description = form.description.trim()
    if (form.start_date) payload.start_date = form.start_date
    if (form.end_date) payload.end_date = form.end_date
    if (form.amount) payload.amount = Number(form.amount)
    const { error: err } = await supabase.from('agreements').insert(payload)
    if (err) { setFormError(err.message + (err.hint ? ' — ' + err.hint : '')); setSaving(false); return }
    setShowForm(false); setForm(EMPTY_FORM); await load(); setSaving(false)
  }

  const filtered = agreements.filter(a => {
    const q = search.toLowerCase()
    const name = (a.vendors?.name || '').toLowerCase()
    const title = (a.title || a.name || a.description || '').toLowerCase()
    return !q || name.includes(q) || title.includes(q)
  })

  return (
    <div style={{ padding: '32px 36px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>Agreements</h1>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>{agreements.length} agreements on file</div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Icon name="plus" size={14} color="#fff" /> Add Agreement
        </button>
      </div>

      {/* Add Agreement Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', width: 520, maxHeight: '88vh', overflowY: 'auto', animation: 'fadeUp 0.2s ease both' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>New Agreement</span>
              <button onClick={() => { setShowForm(false); setFormError('') }} style={{ background: 'none', border: 'none', color: 'var(--text3)', lineHeight: 1 }}><Icon name="x" size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                Vendor *
                <select value={form.vendor_id} onChange={e => setForm(p => ({ ...p, vendor_id: e.target.value }))} className="input-base" style={{ fontSize: 13 }}>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                Title
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="input-base" style={{ fontSize: 13 }} placeholder="e.g. Annual Service Agreement" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                Description
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input-base" rows={3} style={{ fontSize: 13, resize: 'vertical' }} placeholder="Agreement details…" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                  Start Date
                  <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className="input-base" style={{ fontSize: 13 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                  End Date
                  <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className="input-base" style={{ fontSize: 13 }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                  Amount (₹)
                  <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="input-base" style={{ fontSize: 13 }} placeholder="0" />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>
                  Status
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="input-base" style={{ fontSize: 13 }}>
                    {['ACTIVE', 'PENDING', 'INACTIVE', 'EXPIRED'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>
            </div>
            {formError && (
              <div style={{ padding: '0 24px 12px', color: 'var(--red)', fontSize: 12, background: 'var(--red-light)', margin: '0 24px 12px', borderRadius: 8 }}>
                {formError}
              </div>
            )}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setFormError('') }}>Cancel</button>
              <button className="btn-primary" onClick={handleAdd} disabled={saving || !form.vendor_id}>{saving ? 'Saving…' : 'Create Agreement'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '8px 14px', maxWidth: 300 }}>
          <Icon name="search" size={14} color="var(--text3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor or title…" style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, color: 'var(--text)', fontSize: 13 }} />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 52, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {['Vendor', 'Title / Description', 'Amount', 'Valid Period', 'Status', 'Created'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id} className="table-row-hover" style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }} onClick={() => a.vendors?.id && navigate(`/vendors/${a.vendors.id}`)}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{a.vendors?.name || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{a.vendors?.email}</div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text2)', maxWidth: 220 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.title || a.name || a.description || a.service_description || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                      {(a.amount || a.max_amount) ? fmt(a.amount || a.max_amount) : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {(a.start_date || a.valid_from) ? fmtDate(a.start_date || a.valid_from) : '—'}
                    <span style={{ margin: '0 4px', opacity: 0.5 }}>→</span>
                    {(a.end_date || a.valid_to) ? fmtDate(a.end_date || a.valid_to) : '—'}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <AgreementStatusTag status={a.status} end_date={a.end_date} valid_to={a.valid_to} />
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text3)' }}>{fmtDate(a.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 52, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No agreements found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
