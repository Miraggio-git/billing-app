import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmt, fmtDate, fmtDateDDMMYY, daysUntil } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { ApproveRejectActions } from '../components/ApproveRejectActions'
import { Icon } from '../components/Icon'

const TH = { padding:'11px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--text3)', letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }

export function Approvals() {
  const navigate = useNavigate()
  const { role, canApproveL1, canApproveL2, isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Default tab based on role
  const defaultTab = useMemo(() => {
    if (params.get('tab')) return params.get('tab')
    if (role === 'l1') return 'L1'
    if (role === 'l2') return 'L2'
    return 'L1'
  }, [role, params])

  const tab = params.get('tab') || defaultTab
  const setTab = (key) => {
    params.set('tab', key)
    setParams(params)
  }

  const tabs = useMemo(() => {
    const t = []
    if (canApproveL1) t.push({ key: 'L1', label: 'L1 Queue', status: 'PENDING_L1' })
    if (canApproveL2) t.push({ key: 'L2', label: 'L2 Queue', status: 'PENDING_L2' })
    if (isAdmin) t.push({ key: 'ALL', label: 'All Pending', status: 'ALL' })
    return t
  }, [canApproveL1, canApproveL2, isAdmin])

  async function load() {
    setLoading(true)
    const statusFilter =
      tab === 'L1' ? ['PENDING_L1'] :
      tab === 'L2' ? ['PENDING_L2'] :
      ['PENDING_L1', 'PENDING_L2']

    const { data } = await supabase
      .from('bills')
      .select('id,invoice_number,amount,status,billing_period_start,billing_period_end,due_date,frequency,category,anomaly_flags,bill_pdf_url,created_at,vendor_id,order_type,vendors(name)')
      .in('status', statusFilter)
      .order('created_at', { ascending: false })

    setBills(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  const filtered = bills.filter(b => {
    const q = search.toLowerCase()
    if (!q) return true
    return (b.vendors?.name || '').toLowerCase().includes(q) ||
           (b.invoice_number || '').toLowerCase().includes(q)
  })

  function handleActionDone(billId, patch) {
    // Remove from queue (it's no longer pending) or update inline
    setBills(prev => prev.filter(b => b.id !== billId))
  }

  if (tabs.length === 0) {
    return (
      <div style={{ padding: 40, color: 'var(--text3)', fontSize: 14 }}>
        Your role does not have approval rights.
      </div>
    )
  }

  return (
    <div style={{ padding:'24px 24px', width:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28, gap:16, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text)' }}>Pending Approvals</h1>
          <div style={{ color:'var(--text3)', fontSize:13, marginTop:4 }}>
            {filtered.length} bill{filtered.length !== 1 ? 's' : ''} awaiting your decision
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', padding:'8px 14px', flex:1, minWidth:200, maxWidth:300 }}>
          <Icon name="search" size={14} color="var(--text3)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendor or invoice..."
            style={{ border:'none', outline:'none', background:'transparent', flex:1, color:'var(--text)', fontSize:13 }}
          />
        </div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:4 }}>
          {tabs.map(({ key, label }) => {
            const isActive = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding:'6px 14px', borderRadius:8, border:'none',
                  fontSize:12, fontWeight:600, transition:'all 0.15s',
                  background: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text3)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding:52, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:52, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
            🎉 No bills awaiting {tab === 'ALL' ? 'approval' : `${tab} approval`}.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed', minWidth:1100 }}>
              <colgroup>
                <col style={{ width:'17%' }} />
                <col style={{ width:'13%' }} />
                <col style={{ width:'9%' }} />
                <col style={{ width:'10%' }} />
                <col style={{ width:'9%' }} />
                <col style={{ width:'9%' }} />
                <col style={{ width:'9%' }} />
                <col style={{ width:'9%' }} />
                <col style={{ width:'15%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['Vendor','Invoice','Amount','Due','Period','Status','Anomalies','Invoice PDF','Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => {
                  const anomalies = Array.isArray(b.anomaly_flags) ? b.anomaly_flags : []
                  return (
                    <tr
                      key={b.id}
                      className="table-row-hover"
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor:'pointer' }}
                      onClick={() => navigate(`/bills/${b.id}`)}
                    >
                      <td style={{ padding:'10px 12px' }}>
                        <div className="clamp-2" style={{ fontWeight:700, fontSize:14, lineHeight:1.35 }}>{b.vendors?.name || ''}</div>
                      </td>
                      <td style={{ padding:'10px 12px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        <span className="mono" style={{ fontSize:12, color:'var(--text2)' }}>{b.invoice_number || ''}</span>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <span className="mono" style={{ fontWeight:600, fontSize:13 }}>{fmt(b.amount)}</span>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        {b.due_date ? (
                          <span className="mono" style={{
                            fontSize:12, fontWeight:600,
                            color: daysUntil(b.due_date) < 0 ? '#dc2626' :
                                   daysUntil(b.due_date) <= 7 ? '#c2410c' : 'var(--text2)'
                          }}>
                            {fmtDateDDMMYY(b.due_date)}
                          </span>
                        ) : <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text3)' }}>
                        {b.billing_period_start ? new Date(b.billing_period_start).toLocaleDateString('en-IN', { month:'short', year:'numeric' }) : '—'}
                      </td>
                      <td style={{ padding:'10px 12px' }}><StatusBadge status={b.status} /></td>
                      <td style={{ padding:'10px 12px' }}>
                        {anomalies.length > 0 ? (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, background:'var(--yellow-light)', color:'#b45309', borderRadius:6, padding:'3px 8px', border:'1px solid rgba(234,179,8,0.3)', fontWeight:600 }}>
                            ⚠ {anomalies.length}
                          </span>
                        ) : <span style={{ fontSize:11, color:'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ padding:'10px 12px' }} onClick={e => e.stopPropagation()}>
                        {b.bill_pdf_url ? (
                          <a
                            href={b.bill_pdf_url} target="_blank" rel="noreferrer"
                            style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700, color:'var(--primary)', textDecoration:'none', padding:'5px 11px', borderRadius:'var(--radius)', border:'1px solid rgba(59,130,246,0.35)', background:'rgba(59,130,246,0.08)', whiteSpace:'nowrap' }}
                          >
                            <Icon name="bills" size={11} color="var(--primary)" /> View PDF
                          </a>
                        ) : (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text3)', padding:'5px 11px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'var(--surface2)', opacity:0.55 }}>
                            <Icon name="bills" size={11} color="var(--text3)" /> No PDF
                          </span>
                        )}
                      </td>
                      <td style={{ padding:'10px 12px' }} onClick={e => e.stopPropagation()}>
                        <ApproveRejectActions
                          bill={b}
                          size="sm"
                          stopRowClick
                          onDone={(patch) => handleActionDone(b.id, patch)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
