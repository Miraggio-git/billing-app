import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, daysUntil } from '../lib/utils'
import { Icon } from '../components/Icon'

const TH = { padding:'11px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--text3)', letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }
const LBL = { display:'block', fontSize:12, fontWeight:600, color:'var(--text3)', marginBottom:6 }

function StatusTag({ status, expiry_date }) {
  if (status) {
    const s = status.toUpperCase()
    if (s === 'SIGNED' || s === 'ACTIVE')
      return <span style={{ background: 'var(--green-light)', color: '#15803d', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Signed</span>
    if (s === 'EXPIRED')
      return <span style={{ background: 'var(--red-light)', color: '#dc2626', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Expired</span>
    if (s === 'PENDING' || s === 'NOT RECEIVED' || s === 'NOT_RECEIVED')
      return <span style={{ background: 'var(--yellow-light)', color: '#b45309', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Pending</span>
    if (s === 'NO AGREEMENT' || s === 'NO_AGREEMENT')
      return <span style={{ background: 'var(--surface3)', color: 'var(--text3)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>No Agreement</span>
    return <span style={{ background: 'var(--surface2)', color: 'var(--text2)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>{status}</span>
  }
  if (expiry_date) {
    const days = daysUntil(expiry_date)
    if (days < 0)   return <span style={{ background: 'var(--red-light)', color: '#dc2626', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Expired</span>
    if (days <= 30) return <span style={{ background: 'var(--yellow-light)', color: '#b45309', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Exp in {days}d</span>
    return <span style={{ background: 'var(--green-light)', color: '#15803d', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Active</span>
  }
  return <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
}

function PdfLink({ url, label }) {
  if (!url || !url.trim()) return null
  return (
    <a
      href={url.trim()}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      onClick={e => e.stopPropagation()}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26,
        color: 'var(--primary)',
        background: 'var(--primary-light)', borderRadius: 6,
        border: '1px solid rgba(29,78,216,0.15)', textDecoration: 'none',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    </a>
  )
}

const EMPTY_AG = {
  vendor_id: '', trade_name: '', service_description: '', status: 'Signed',
  billing_cycle: '', max_amount: '', payment_terms_days: '',
  start_date: '', expiry_date: '', agreement_url: '', agreement_url2: '',
}

const EMPTY_AD = { agreement_id: '', addendum_url: '' }

export function Contracts() {
  const navigate = useNavigate()
  const [agreements, setAgreements] = useState([])
  const [vendors, setVendors]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')

  // Add Agreement modal
  const [showAgForm, setShowAgForm] = useState(false)
  const [agForm, setAgForm]         = useState(EMPTY_AG)
  const [agSaving, setAgSaving]     = useState(false)
  const [agError, setAgError]       = useState('')

  // Add Addendum modal
  const [showAdForm, setShowAdForm] = useState(false)
  const [adForm, setAdForm]         = useState(EMPTY_AD)
  const [adSaving, setAdSaving]     = useState(false)
  const [adError, setAdError]       = useState('')
  const [adSuccess, setAdSuccess]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [agRes, vRes] = await Promise.all([
      supabase
        .from('agreements')
        .select('id,vendor_id,trade_name,service_description,status,agreement_url,agreement_url2,start_date,expiry_date,billing_cycle,max_amount,payment_terms_days,added_by,created_at')
        .order('created_at', { ascending: false }),
      supabase.from('vendors').select('id,name').order('name'),
    ])
    setAgreements(agRes.data || [])
    setVendors(vRes.data || [])
    setLoading(false)
  }

  async function handleAddAgreement(e) {
    e.preventDefault()
    setAgError('')
    if (!agForm.trade_name.trim() && !agForm.vendor_id) { setAgError('Please select a vendor or enter a trade name.'); return }
    setAgSaving(true)
    const payload = { status: agForm.status || 'Signed' }
    if (agForm.vendor_id)                  payload.vendor_id           = agForm.vendor_id
    if (agForm.trade_name.trim())          payload.trade_name          = agForm.trade_name.trim()
    if (agForm.service_description.trim()) payload.service_description = agForm.service_description.trim()
    if (agForm.billing_cycle)              payload.billing_cycle       = agForm.billing_cycle
    if (agForm.max_amount)                 payload.max_amount          = Number(agForm.max_amount)
    if (agForm.payment_terms_days)         payload.payment_terms_days  = Number(agForm.payment_terms_days)
    if (agForm.start_date)                 payload.start_date          = agForm.start_date
    if (agForm.expiry_date)                payload.expiry_date         = agForm.expiry_date
    if (agForm.agreement_url.trim())       payload.agreement_url       = agForm.agreement_url.trim()
    if (agForm.agreement_url2.trim())      payload.agreement_url2      = agForm.agreement_url2.trim()

    const { error } = await supabase.from('agreements').insert(payload)
    setAgSaving(false)
    if (error) { setAgError(error.message || 'Failed to save.'); return }
    setShowAgForm(false); setAgForm(EMPTY_AG)
    await load()
  }

  function agChange(field, value) {
    setAgForm(p => {
      const next = { ...p, [field]: value }
      if (field === 'vendor_id' && !p.trade_name) {
        const v = vendors.find(v => v.id === value)
        if (v) next.trade_name = v.name
      }
      return next
    })
  }

  async function handleAddAddendum() {
    setAdError('')
    if (!adForm.agreement_id) { setAdError('Please select an agreement.'); return }
    if (!adForm.addendum_url.trim()) { setAdError('Please enter the addendum PDF URL.'); return }
    setAdSaving(true)
    const { error } = await supabase
      .from('agreements')
      .update({ agreement_url2: adForm.addendum_url.trim() })
      .eq('id', adForm.agreement_id)
    setAdSaving(false)
    if (error) { setAdError(error.message || 'Failed to save addendum.'); return }
    setAdSuccess(true)
    setTimeout(async () => {
      setShowAdForm(false); setAdForm(EMPTY_AD); setAdSuccess(false)
      await load()
    }, 1200)
  }

  const filtered = agreements.filter(a => {
    const q = search.toLowerCase()
    const name = (a.trade_name || '').toLowerCase()
    const desc = (a.service_description || '').toLowerCase()
    return !q || name.includes(q) || desc.includes(q)
  })

  return (
    /* Full-width container — flush beside sidebar */
    <div style={{ padding: '24px 24px', width: '100%' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>Agreements</h1>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>{agreements.length} agreements on file</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            onClick={() => { setAdForm(EMPTY_AD); setAdError(''); setAdSuccess(false); setShowAdForm(true) }}>
            <Icon name="plus" size={13} /> Add Addendum
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { setAgForm(EMPTY_AG); setAgError(''); setShowAgForm(true) }}>
            <Icon name="plus" size={14} color="#fff" /> Add Agreement
          </button>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '8px 14px', maxWidth: 320 }}>
          <Icon name="search" size={14} color="var(--text3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor or service…" style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, color: 'var(--text)', fontSize: 13 }} />
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 52, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        ) : (
          /* Horizontal-scroll wrapper guarantees nothing clips off-screen */
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 920 }}>
              <colgroup>
                <col style={{ width: '19%' }} />
                <col style={{ width: '19%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }}  />
                <col style={{ width: '16%' }} />
                <col style={{ width: '7%' }}  />
                <col style={{ width: '11%' }} />
                <col style={{ width: '8%' }}  />
              </colgroup>
              <thead>
                <tr>
                  {['Trade Name', 'Service', 'Max Amount', 'Cycle', 'Valid Period', 'Terms', 'Status', 'Docs'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={a.id} className="table-row-hover" style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div className="clamp-2" style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.35 }} title={a.trade_name || ''}>{a.trade_name || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.service_description || ''}>
                      {a.service_description || '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="mono" style={{ fontWeight: 600, fontSize: 12.5 }}>{a.max_amount ? fmt(a.max_amount) : '—'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5, color: 'var(--text2)', textTransform: 'capitalize' }}>
                      {a.billing_cycle ? a.billing_cycle.toLowerCase() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.start_date ? fmtDate(a.start_date) : '—'}
                      <span style={{ margin: '0 4px', opacity: 0.4 }}>→</span>
                      {a.expiry_date ? fmtDate(a.expiry_date) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5, color: 'var(--text2)' }}>{a.payment_terms_days ? `${a.payment_terms_days}d` : '—'}</td>
                    <td style={{ padding: '10px 12px' }}><StatusTag status={a.status} expiry_date={a.expiry_date} /></td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {a.agreement_url  ? <PdfLink url={a.agreement_url}  label="Agreement" /> : null}
                        {a.agreement_url2 ? <PdfLink url={a.agreement_url2} label="Addendum" /> : null}
                        {!a.agreement_url && !a.agreement_url2 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 52, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No agreements found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════ Add Agreement Modal ══════════════════════ */}
      {showAgForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAgForm(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', width: 560, maxHeight: '92vh', overflowY: 'auto', animation: 'fadeUp 0.2s ease both' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Add Agreement</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Register a new vendor agreement</div>
              </div>
              <button onClick={() => setShowAgForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, lineHeight: 1 }}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleAddAgreement} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={LBL}>Vendor</label>
                <select className="input-base" value={agForm.vendor_id} onChange={e => agChange('vendor_id', e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>Trade Name *</label>
                <input className="input-base" value={agForm.trade_name} onChange={e => agChange('trade_name', e.target.value)} placeholder="Name as on agreement" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={LBL}>Service Description</label>
                <textarea className="input-base" rows={2} value={agForm.service_description} onChange={e => agChange('service_description', e.target.value)} placeholder="Describe the service or scope…" style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={LBL}>Status</label>
                  <select className="input-base" value={agForm.status} onChange={e => agChange('status', e.target.value)} style={{ width: '100%' }}>
                    {['Signed', 'Pending', 'Not received', 'No agreement', 'Expired'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>Billing Cycle</label>
                  <select className="input-base" value={agForm.billing_cycle} onChange={e => agChange('billing_cycle', e.target.value)} style={{ width: '100%' }}>
                    <option value="">Select…</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUAL">Annual</option>
                    <option value="ONE_TIME">One Time</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={LBL}>Max Amount (₹)</label>
                  <input className="input-base" type="number" min="0" step="0.01" value={agForm.max_amount} onChange={e => agChange('max_amount', e.target.value)} placeholder="0.00" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={LBL}>Payment Terms (days)</label>
                  <input className="input-base" type="number" min="0" value={agForm.payment_terms_days} onChange={e => agChange('payment_terms_days', e.target.value)} placeholder="e.g. 30" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={LBL}>Start Date</label>
                  <input className="input-base" type="date" value={agForm.start_date} onChange={e => agChange('start_date', e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={LBL}>Expiry Date</label>
                  <input className="input-base" type="date" value={agForm.expiry_date} onChange={e => agChange('expiry_date', e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={LBL}>Agreement PDF URL</label>
                <input className="input-base" type="url" value={agForm.agreement_url} onChange={e => agChange('agreement_url', e.target.value)} placeholder="https://…" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={LBL}>Addendum PDF URL (optional)</label>
                <input className="input-base" type="url" value={agForm.agreement_url2} onChange={e => agChange('agreement_url2', e.target.value)} placeholder="https://…" style={{ width: '100%' }} />
              </div>
              {agError && (
                <div style={{ background: 'var(--red-light)', color: '#dc2626', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>{agError}</div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAgForm(false)} disabled={agSaving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={agSaving}>{agSaving ? 'Saving…' : 'Save Agreement'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ Add Addendum Modal ═══════════════════════ */}
      {showAdForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdForm(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', width: 480, animation: 'fadeUp 0.2s ease both', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Add Addendum</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Link an addendum PDF to an existing agreement</div>
              </div>
              <button onClick={() => setShowAdForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, lineHeight: 1 }}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={LBL}>Agreement *</label>
                <select className="input-base" value={adForm.agreement_id} onChange={e => setAdForm(p => ({ ...p, agreement_id: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Select agreement…</option>
                  {agreements.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.trade_name || 'Unnamed'}{a.service_description ? ` — ${a.service_description.slice(0, 40)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LBL}>Addendum PDF URL *</label>
                <input className="input-base" type="url" value={adForm.addendum_url} onChange={e => setAdForm(p => ({ ...p, addendum_url: e.target.value }))} placeholder="https://supabase.co/storage/…" style={{ width: '100%' }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Paste the signed URL from your Supabase storage bucket</div>
              </div>
              {adError && (
                <div style={{ background: 'var(--red-light)', color: '#dc2626', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>{adError}</div>
              )}
              {adSuccess && (
                <div style={{ background: 'var(--green-light)', color: '#15803d', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>Addendum linked successfully!</div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowAdForm(false)} disabled={adSaving}>Cancel</button>
              <button className="btn-primary" onClick={handleAddAddendum} disabled={adSaving || adSuccess}>{adSaving ? 'Saving…' : 'Link Addendum'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
