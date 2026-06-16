import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, daysUntil } from '../lib/utils'
import { Icon } from '../components/Icon'

const TH = {
  padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
}

const DATE_OPTIONS = [
  { value: 'all',        label: 'All Time'      },
  { value: 'this_month', label: 'This Month'    },
  { value: 'last_month', label: 'Last Month'    },
  { value: 'last_3m',   label: 'Last 3 Months' },
]

function applyDateFilter(bills, filter) {
  if (filter === 'all') return bills
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  return bills.filter(b => {
    const d = new Date(b.created_at)
    if (filter === 'this_month') return d >= new Date(y, m, 1)
    if (filter === 'last_month') return d >= new Date(y, m - 1, 1) && d < new Date(y, m, 1)
    if (filter === 'last_3m')   return d >= new Date(y, m - 2, 1)
    return true
  })
}

const pillSelect = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 99,
  padding: '7px 32px 7px 14px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  minWidth: 180,
}

// Equal-height metric card; numbers can change without resizing.
const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '22px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  cursor: 'pointer',
  minHeight: 152,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
}
const cardTitle  = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }
const cardSub    = { fontSize: 11, color: 'var(--text3)' }
const cardBigVal = { fontSize: 38, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }
const cardMoney  = { fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, fontFamily: 'DM Mono, monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

export function Dashboard() {
  const navigate = useNavigate()
  const [allBills, setAllBills]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [dateFilter, setDateFilter]     = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('bills')
        .select('id,status,amount,invoice_number,vendor_id,created_at,bill_pdf_url,vendors(name)')
        .order('created_at', { ascending: false })
      setAllBills(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const uniqueVendors = useMemo(() => {
    const map = {}
    allBills.forEach(b => {
      if (b.vendor_id && !map[b.vendor_id]) map[b.vendor_id] = b.vendors?.name || b.vendor_id
    })
    return Object.entries(map).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [allBills])

  const bills = useMemo(() => {
    let f = applyDateFilter(allBills, dateFilter)
    if (vendorFilter !== 'all') f = f.filter(b => b.vendor_id === vendorFilter)
    return f
  }, [allBills, dateFilter, vendorFilter])

  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const pendingL1 = bills.filter(b => b.status === 'PENDING_L1').length
    const pendingL2 = bills.filter(b => b.status === 'PENDING_L2').length
    const payBills  = bills.filter(b => b.status === 'PENDING_PAYMENT')
    const paidBills = bills.filter(b => b.status === 'PAID' && new Date(b.created_at) >= monthStart)
    const paidMonth = paidBills.reduce((s, b) => s + Number(b.amount), 0)
    return {
      pendingL1,
      pendingL2,
      pendingPayAmt:   payBills.reduce((s, b) => s + Number(b.amount), 0),
      pendingPayCount: payBills.length,
      paidMonth,
      paidMonthCount:  paidBills.length,
    }
  }, [bills])

  const vendorSummaryRows = useMemo(() => {
    const map = {}
    bills.forEach(b => {
      if (!map[b.vendor_id]) map[b.vendor_id] = { vendor_id: b.vendor_id, vendor_name: b.vendors?.name || '—', total_invoiced: 0, count: 0, pending_count: 0 }
      map[b.vendor_id].total_invoiced += Number(b.amount || 0)
      map[b.vendor_id].count += 1
      if (b.status !== 'PAID') map[b.vendor_id].pending_count += 1
    })
    return Object.values(map).sort((a, b) => b.total_invoiced - a.total_invoiced)
  }, [bills])

  const now = new Date()

  return (
    /* Full-width container — no maxWidth clamp so filters don't shift layout */
    <div style={{ padding: '24px 24px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>OVERVIEW</h1>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={pillSelect}>
            {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} style={{ ...pillSelect, minWidth: 260 }}>
            <option value="all">All Vendors</option>
            {uniqueVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)', padding: '40px 0', fontSize: 13 }}>Loading data...</div>
      ) : (
        <>
          {/* Cards: equal-width grid via minmax(0, 1fr) — stable across filters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 22 }}>
            <div style={cardStyle} onClick={() => navigate('/bills?status=PENDING_L1')}>
              <div style={cardTitle}>Awaiting L1</div>
              <div style={cardBigVal}>{stats.pendingL1}</div>
              <div style={cardSub}>L1 approval pending</div>
            </div>
            <div style={cardStyle} onClick={() => navigate('/bills?status=PENDING_L2')}>
              <div style={cardTitle}>Awaiting L2</div>
              <div style={cardBigVal}>{stats.pendingL2}</div>
              <div style={cardSub}>L2 approval pending</div>
            </div>
            <div style={cardStyle} onClick={() => navigate('/bills?status=PENDING_PAYMENT')}>
              <div style={cardTitle}>To Pay Amount</div>
              <div style={cardMoney}>{fmt(stats.pendingPayAmt).replace('₹', '')}</div>
              <div style={cardSub}>Number of Invoice: {stats.pendingPayCount}</div>
            </div>
            <div style={{ ...cardStyle, cursor: 'default' }}>
              <div style={cardTitle}>Amount This Month</div>
              <div style={cardMoney}>{fmt(stats.paidMonth).replace('₹', '')}</div>
              <div style={cardSub}>Number of Invoice: {stats.paidMonthCount}</div>
            </div>
          </div>

          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Vendor-wise Summary</div>
              <button onClick={() => navigate('/vendors')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View all &rarr;</button>
            </div>
            {/* Fixed table layout so column widths don't shift on filter */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '46%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr>{['Vendor', 'Total Invoiced', 'Bill Count', 'Pending Bills'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {vendorSummaryRows.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No data for this filter.</td></tr>
                ) : vendorSummaryRows.map((v, i) => (
                  <tr key={v.vendor_id} className="table-row-hover" style={{ borderBottom: i < vendorSummaryRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>
                      <span className="clamp-2">{v.vendor_name}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--primary)' }}>{fmt(v.total_invoiced)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text2)' }}>{v.count}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: v.pending_count > 0 ? '#b45309' : 'var(--text3)', fontWeight: v.pending_count > 0 ? 700 : 400 }}>
                      {v.pending_count > 0 ? `${v.pending_count} bill${v.pending_count !== 1 ? 's' : ''}` : 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent Bills — quick PDF access */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Recent Bills</div>
              <button onClick={() => navigate('/bills')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View all &rarr;</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr>{['Vendor', 'Invoice', 'Amount', 'Status', 'Invoice PDF'].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {bills.slice(0, 10).map((b, i) => (
                  <tr
                    key={b.id}
                    className="table-row-hover"
                    style={{ borderBottom: i < Math.min(bills.length, 10) - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/bills/${b.id}`)}
                  >
                    <td style={{ padding: '9px 12px', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.vendors?.name || '—'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.invoice_number || '—'}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 12 }}>{fmt(b.amount)}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, fontWeight: 600,
                        background: b.status === 'PAID' ? 'rgba(34,197,94,0.1)' : b.status?.startsWith('PENDING') ? 'rgba(251,146,60,0.12)' : 'rgba(239,68,68,0.1)',
                        color: b.status === 'PAID' ? 'var(--green)' : b.status?.startsWith('PENDING') ? '#c2410c' : 'var(--red)',
                      }}>{b.status?.replace(/_/g,' ')}</span>
                    </td>
                    <td style={{ padding: '9px 12px' }} onClick={e => e.stopPropagation()}>
                      {b.bill_pdf_url ? (
                        <a
                          href={b.bill_pdf_url} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.08)' }}
                        >
                          <Icon name="bills" size={11} color="var(--primary)" /> View PDF
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text3)', opacity: 0.5, padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Icon name="bills" size={11} color="var(--text3)" /> No PDF
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No bills for this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
