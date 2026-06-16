import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import { Icon } from '../components/Icon'
import { StatusBadge } from '../components/StatusBadge'

export function VendorLedger() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [vendor, setVendor] = useState(null)
  const [bills, setBills] = useState([])
  const [payments, setPayments] = useState([])
  const [creditNotes, setCreditNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('ledger')
  const [showCNModal, setShowCNModal] = useState(false)
  const [cnForm, setCNForm] = useState({ cn_number: '', date: '', amount: '', reason: '', linked_bill_id: '' })

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    try {
      const [vendorRes, billsRes, paymentsRes, cnRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', id).single(),
        supabase.from('bills').select('*').eq('vendor_id', id).order('created_at'),
        supabase.from('payments').select('*').eq('vendor_id', id).order('paid_at'),
        supabase.from('credit_notes').select('*').eq('vendor_id', id).order('date'),
      ])

      setVendor(vendorRes.data)
      setBills(billsRes.data || [])
      setPayments(paymentsRes.data || [])
      setCreditNotes(cnRes.data || [])
    } catch (err) {
      console.error('Failed to load vendor ledger:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddCreditNote() {
    if (!cnForm.cn_number.trim() || !cnForm.amount) return
    try {
      await supabase.from('credit_notes').insert({
        vendor_id: id,
        cn_number: cnForm.cn_number.trim(),
        date: cnForm.date || new Date().toISOString().split('T')[0],
        amount: Number(cnForm.amount),
        reason: cnForm.reason.trim(),
        linked_bill_id: cnForm.linked_bill_id || null,
        status: 'PENDING'
      })
      await load()
      setShowCNModal(false)
      setCNForm({ cn_number: '', date: '', amount: '', reason: '', linked_bill_id: '' })
    } catch (err) {
      console.error('Failed to create credit note:', err)
    }
  }

  // Build ledger entries
  const ledgerEntries = [
    ...bills.map(b => ({
      date: b.created_at,
      type: 'INVOICE',
      ref: b.invoice_number,
      description: `Invoice ${b.invoice_number}`,
      debit: Number(b.amount),
      credit: 0,
    })),
    ...payments.map(p => ({
      date: p.paid_at,
      type: 'PAYMENT',
      ref: p.utr_or_cheque_number || p.id,
      description: `Payment via ${p.payment_mode}`,
      debit: 0,
      credit: Number(p.amount_paid),
    })),
    ...creditNotes.map(cn => ({
      date: cn.date,
      type: 'CREDIT_NOTE',
      ref: cn.cn_number,
      description: cn.reason || 'Credit Note',
      debit: 0,
      credit: Number(cn.amount),
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date))

  let running = 0
  const withBalance = ledgerEntries.map(e => {
    running += e.debit - e.credit
    return { ...e, balance: running }
  })

  const totalBilled = bills.reduce((s, b) => s + Number(b.amount), 0)
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid), 0)
  const totalCN = creditNotes.reduce((s, cn) => s + Number(cn.amount), 0)
  const netOutstanding = totalBilled - totalPaid - totalCN

  function exportLedgerCSV() {
    const headers = ['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']
    const rows = withBalance.map(e => [
      fmtDate(e.date),
      e.type,
      e.ref,
      e.description,
      e.debit > 0 ? fmt(e.debit) : '—',
      e.credit > 0 ? fmt(e.credit) : '—',
      fmt(e.balance),
    ])
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ledger-${vendor?.name || id}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ padding: '32px 36px', textAlign: 'center' }}>Loading…</div>
  if (!vendor) return <div style={{ padding: '32px 36px', textAlign: 'center', color: 'var(--red)' }}>Vendor not found</div>

  return (
    <div style={{ padding: '32px 36px', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/vendors')} style={{ marginBottom: 16, background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}>
          ← Back to Vendors
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{vendor.name}</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{vendor.email}</div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Billed', value: fmt(totalBilled) },
          { label: 'Total Paid', value: fmt(totalPaid) },
          { label: 'Credit Notes', value: fmt(totalCN) },
          { label: 'Net Outstanding', value: fmt(netOutstanding) },
        ].map((kpi, i) => (
          <div key={i} className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>{kpi.label}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        {['ledger', 'creditNotes', 'bills'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              background: activeTab === tab ? 'var(--primary)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--text3)',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {tab === 'ledger' ? 'Ledger' : tab === 'creditNotes' ? 'Credit Notes' : 'Bills'}
          </button>
        ))}
      </div>

      {/* Ledger Tab */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn-download" onClick={exportLedgerCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="download" size={14} color="var(--primary)" />
              Export Ledger
            </button>
          </div>
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withBalance.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>{fmtDate(e.date)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>{e.type}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{e.ref}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{e.description}</td>
                    <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: e.debit > 0 ? 'var(--red)' : 'var(--text3)' }}>{e.debit > 0 ? fmt(e.debit) : '—'}</td>
                    <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: e.credit > 0 ? 'var(--green)' : 'var(--text3)' }}>{e.credit > 0 ? fmt(e.credit) : '—'}</td>
                    <td className="mono" style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{fmt(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit Notes Tab */}
      {activeTab === 'creditNotes' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn-primary" onClick={() => setShowCNModal(true)}>
              <Icon name="plus" size={14} color="#fff" /> New Credit Note
            </button>
          </div>
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  {['CN Number', 'Date', 'Amount', 'Reason', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((cn, i) => (
                  <tr key={cn.id} style={{ borderBottom: i < creditNotes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600 }}>{cn.cn_number}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>{fmtDate(cn.date)}</td>
                    <td className="mono" style={{ padding: '12px 16px', fontSize: 12 }}>{fmt(cn.amount)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{cn.reason || '—'}</td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={cn.status} /></td>
                  </tr>
                ))}
                {creditNotes.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No credit notes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bills Tab */}
      {activeTab === 'bills' && (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {['Invoice', 'Amount', 'Period', 'Status', 'Due Date'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bills.map((b, i) => (
                <tr key={b.id} style={{ borderBottom: i < bills.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600 }}>{b.invoice_number}</td>
                  <td className="mono" style={{ padding: '12px 16px', fontSize: 12 }}>{fmt(b.amount)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{fmtDate(b.billing_period_start)}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={b.status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>{fmtDate(b.due_date)}</td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No bills</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Credit Note Modal */}
      {showCNModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', width: 420, padding: '24px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>New Credit Note</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>
                CN Number
                <input value={cnForm.cn_number} onChange={e => setCNForm(f => ({ ...f, cn_number: e.target.value }))} className="input-base" placeholder="CN-2025-001" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>
                Date
                <input type="date" value={cnForm.date} onChange={e => setCNForm(f => ({ ...f, date: e.target.value }))} className="input-base" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>
                Amount
                <input type="number" value={cnForm.amount} onChange={e => setCNForm(f => ({ ...f, amount: e.target.value }))} className="input-base" placeholder="0.00" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>
                Linked Invoice
                <select value={cnForm.linked_bill_id} onChange={e => setCNForm(f => ({ ...f, linked_bill_id: e.target.value }))} className="input-base">
                  <option value="">Select (optional)</option>
                  {bills.map(b => <option key={b.id} value={b.id}>{b.invoice_number}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>
                Reason
                <textarea value={cnForm.reason} onChange={e => setCNForm(f => ({ ...f, reason: e.target.value }))} className="input-base" placeholder="Reason for credit note" style={{ minHeight: 60 }} />
              </label>
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowCNModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAddCreditNote} disabled={!cnForm.cn_number.trim() || !cnForm.amount}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
