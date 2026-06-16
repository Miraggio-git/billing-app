import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmt, fmtDate } from '../lib/utils'
import { Icon } from './Icon'

// ─── Template ───────────────────────────────────────────────────────────────
const TEMPLATE_HEADERS = 'Vendor Code,Vendor Name,Invoice No,UTR,Payment Date (DD/MM/YYYY),Payment Approval Date (DD/MM/YYYY),Payment Mode (NEFT/RTGS/UPI/CHEQUE/IMPS)'
const VALID_MODES      = ['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'IMPS', 'DD', 'CASH']

// ─── CSV Parser ──────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseRow = (line) => {
    const out = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { out.push(cur.trim()); cur = '' }
      else cur += ch
    }
    out.push(cur.trim())
    return out
  }

  const headers = parseRow(lines[0])
  const rows = lines.slice(1)
    .map((line, i) => ({ _rowNum: i + 2, values: parseRow(line) }))
    .filter(r => r.values.some(v => v))
  return { headers, rows }
}

// Accept DD/MM/YYYY or DD-MM-YYYY
function parseDate(str) {
  if (!str) return null
  const parts = str.replace(/-/g, '/').split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts
  const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T12:00:00Z`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 24,
}
const MODAL = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 16, width: '100%', maxWidth: 780,
  maxHeight: '90vh', overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
}
const TH = {
  padding: '9px 14px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.04em',
  whiteSpace: 'nowrap', background: 'var(--surface2)',
}

// ─── Component ───────────────────────────────────────────────────────────────
export function BulkPaymentUpload({ onSuccess }) {
  const { profile, session } = useAuth()
  const [open, setOpen]           = useState(false)
  const [step, setStep]           = useState('upload')   // upload | validating | errors | preview | processing | done
  const [dragOver, setDragOver]   = useState(false)
  const [fileName, setFileName]   = useState('')
  const [errors, setErrors]       = useState([])          // [{ row, field, message }]
  const [preview, setPreview]     = useState([])          // validated rows
  const [result, setResult]       = useState(null)        // { inserted, total }
  const [tplLoading, setTplLoading] = useState(false)
  const fileRef = useRef()

  // ── Download template — all vendors, one row per unique vendor code ──────
  async function downloadTemplate() {
    setTplLoading(true)
    const { data: vendors } = await supabase
      .from('vendors')
      .select('vendor_code, name')
      .neq('status', 'INACTIVE')
      .order('name', { ascending: true })
    setTplLoading(false)

    // Deduplicate: vendors with a code → key by vendor_code (handles Prozo ×4,
    // Blue Dart ×2 etc). Vendors without a code → key by name (handles Delhivery
    // which has two entries both with no code).
    const seen = new Map()
    for (const v of (vendors || [])) {
      const key = v.vendor_code ? `code:${v.vendor_code}` : `name:${v.name}`
      if (!seen.has(key)) seen.set(key, v)
    }

    const rows = [...seen.values()]
      .map(v => `${v.vendor_code ?? ''},"${v.name}",,,,, `)

    if (rows.length === 0) rows.push('MRG-001,ABC Supplies Pvt Ltd,,,,, ')

    const csv  = [TEMPLATE_HEADERS, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'bulk_payment_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Handle file drop / select ─────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setErrors([{ row: '—', field: 'File', message: 'Only CSV files are supported. Please use the downloaded template.' }])
      setStep('errors'); return
    }
    setFileName(file.name)
    setStep('validating')

    const text              = await file.text()
    const { headers, rows } = parseCSV(text)

    // Header check — must have the four key columns
    const hasVendorCode  = headers.some(h => h.toLowerCase().includes('vendor code'))
    const hasInvoiceNo   = headers.some(h => h.toLowerCase().includes('invoice'))
    const hasUTR         = headers.some(h => h.toLowerCase().includes('utr'))
    const hasPaymentDate = headers.some(h => h.toLowerCase().includes('payment date'))
    if (!hasVendorCode || !hasInvoiceNo || !hasUTR || !hasPaymentDate) {
      setErrors([{ row: '—', field: 'File', message: 'Invalid template headers. Download the template and fill it in.' }])
      setStep('errors'); return
    }
    if (rows.length === 0) {
      setErrors([{ row: '—', field: 'File', message: 'The file has no data rows.' }])
      setStep('errors'); return
    }

    const getCol = (row, keyword) => {
      const idx = headers.findIndex(h => h.toLowerCase().includes(keyword.toLowerCase()))
      return idx >= 0 ? (row.values[idx] || '').trim() : ''
    }

    // ── Batch fetch vendors & bills in one round-trip each ─────────────────
    const vendorCodes = [...new Set(rows.map(r => getCol(r, 'vendor code')).filter(Boolean))]
    const invoiceNos  = [...new Set(rows.map(r => getCol(r, 'invoice')).filter(Boolean))]

    const [{ data: vendors }, { data: bills }] = await Promise.all([
      supabase.from('vendors')
        .select('id,name,vendor_code,email')
        .in('vendor_code', vendorCodes),
      supabase.from('bills')
        .select('id,invoice_number,vendor_id,amount,status,billing_period_start,billing_period_end')
        .in('invoice_number', invoiceNos),
    ])

    const vendorByCode = {}
    ;(vendors || []).forEach(v => { vendorByCode[v.vendor_code] = v })

    const billKey = (vendorId, invoiceNo) => `${vendorId}__${invoiceNo}`
    const billByKey = {}
    ;(bills || []).forEach(b => { billByKey[billKey(b.vendor_id, b.invoice_number)] = b })

    // ── Validate row by row ────────────────────────────────────────────────
    const rowErrors = []
    const validRows = []
    const seenUTRs     = new Set()
    const seenInvoices = new Set()

    for (const row of rows) {
      const n               = row._rowNum
      const vendorCode      = getCol(row, 'vendor code')
      const invoiceNo       = getCol(row, 'invoice')
      const utr             = getCol(row, 'utr')
      const dateStr         = getCol(row, 'payment date')
      const approvalDateStr = getCol(row, 'approval date')
      const modeRaw         = getCol(row, 'payment mode').toUpperCase()
      const paymentMode     = VALID_MODES.includes(modeRaw) ? modeRaw : 'NEFT'
      const paymentDate     = parseDate(dateStr)
      const approvalDate    = parseDate(approvalDateStr)

      const errs = []

      if (!vendorCode)      errs.push({ row: n, field: 'Vendor Code',            message: 'Vendor Code is required' })
      if (!invoiceNo)       errs.push({ row: n, field: 'Invoice No',             message: 'Invoice No is required' })
      if (!utr)             errs.push({ row: n, field: 'UTR',                    message: 'UTR is required' })
      if (!dateStr)         errs.push({ row: n, field: 'Payment Date',           message: 'Payment Date is required' })
      else if (!paymentDate)  errs.push({ row: n, field: 'Payment Date',         message: `"${dateStr}" is not a valid date — use DD/MM/YYYY` })
      if (!approvalDateStr) errs.push({ row: n, field: 'Payment Approval Date',  message: 'Payment Approval Date is required' })
      else if (!approvalDate) errs.push({ row: n, field: 'Payment Approval Date', message: `"${approvalDateStr}" is not a valid date — use DD/MM/YYYY` })

      // Duplicate UTR within this batch
      if (utr && seenUTRs.has(utr))
        errs.push({ row: n, field: 'UTR', message: `Duplicate UTR "${utr}" found in this file` })
      else if (utr) seenUTRs.add(utr)

      // Duplicate invoice within this batch
      if (invoiceNo && seenInvoices.has(invoiceNo))
        errs.push({ row: n, field: 'Invoice No', message: `Duplicate invoice "${invoiceNo}" found in this file` })
      else if (invoiceNo) seenInvoices.add(invoiceNo)

      // Vendor must exist
      const vendor = vendorCode ? vendorByCode[vendorCode] : null
      if (vendorCode && !vendor)
        errs.push({ row: n, field: 'Vendor Code', message: `Vendor code "${vendorCode}" not found in system` })

      // Bill must exist and belong to this vendor
      const bill = (vendor && invoiceNo) ? billByKey[billKey(vendor.id, invoiceNo)] : null
      if (vendor && invoiceNo && !bill)
        errs.push({ row: n, field: 'Invoice No', message: `Invoice "${invoiceNo}" not found for vendor "${vendorCode}"` })
      if (bill && bill.status === 'PAID')
        errs.push({ row: n, field: 'Invoice No', message: `Invoice "${invoiceNo}" is already marked PAID` })
      if (bill && !['PAID', 'PENDING_PAYMENT'].includes(bill.status))
        errs.push({ row: n, field: 'Invoice No', message: `Invoice "${invoiceNo}" has status "${bill.status}" — it must be PENDING_PAYMENT to be paid` })

      if (errs.length > 0) {
        rowErrors.push(...errs)
      } else {
        validRows.push({ vendorCode, vendorName: vendor.name, invoiceNo, utr, paymentDate, approvalDate, paymentMode, vendor, bill, amountPaid: bill.amount })
      }
    }

    if (rowErrors.length > 0) {
      setErrors(rowErrors); setStep('errors')
    } else {
      setPreview(validRows); setStep('preview')
    }
  }

  // ── Confirm & process ─────────────────────────────────────────────────────
  async function confirmUpload() {
    setStep('processing')
    const paidBy = profile?.name || session?.user?.email || 'Finance Team'
    let inserted = 0
    const paymentIds = []

    for (const row of preview) {
      try {
        // 1. Insert payment record
        const { data: payment, error: payErr } = await supabase
          .from('payments')
          .insert({
            bill_id:              row.bill.id,
            vendor_id:            row.vendor.id,
            payment_mode:         row.paymentMode,
            utr_or_cheque_number: row.utr,
            amount_paid:          row.amountPaid,
            paid_at:              row.paymentDate,
            payment_approved_at:  row.approvalDate,
            paid_by:              paidBy,
          })
          .select('id')
          .single()
        if (payErr) throw payErr
        paymentIds.push(payment.id)

        // 2. Mark bill as PAID
        await supabase
          .from('bills')
          .update({ status: 'PAID', paid_at: row.paymentDate })
          .eq('id', row.bill.id)

        // 3. Insert into payment_notifications queue → n8n picks this up and sends vendor email
        await supabase.from('payment_notifications').insert({
          payment_id:            payment.id,
          vendor_id:             row.vendor.id,
          bill_id:               row.bill.id,
          vendor_email:          row.vendor.email,
          vendor_name:           row.vendor.name,
          invoice_number:        row.invoiceNo,
          amount_paid:           row.amountPaid,
          utr:                   row.utr,
          payment_mode:          row.paymentMode,
          paid_at:               row.paymentDate,
          payment_approved_at:   row.approvalDate,
          paid_by:               paidBy,
          billing_period_start:  row.bill.billing_period_start,
          billing_period_end:    row.bill.billing_period_end,
          status:                'pending',
        })

        inserted++
      } catch (e) {
        console.error('Failed row:', row.invoiceNo, e)
      }
    }

    // 4. Audit log
    try {
      await supabase.from('bulk_upload_logs').insert({
        uploaded_by:     paidBy,
        filename:        fileName,
        total_rows:      preview.length,
        successful_rows: inserted,
        payment_ids:     paymentIds,
      })
    } catch (_) { /* table may not exist yet */ }

    setResult({ inserted, total: preview.length })
    setStep('done')
    if (inserted > 0) onSuccess?.()
  }

  // ── Reset & close ─────────────────────────────────────────────────────────
  function reset() {
    setStep('upload'); setErrors([]); setPreview([])
    setResult(null); setFileName('')
  }
  function close() { reset(); setOpen(false) }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '9px 18px', borderRadius: 'var(--radius)',
          background: 'var(--surface)', border: '1px solid var(--border2)',
          color: 'var(--text2)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
      >
        <Icon name="upload" size={14} color="currentColor" />
        Bulk Upload
      </button>
    )
  }

  return (
    <div style={OVERLAY} onClick={e => e.target === e.currentTarget && close()}>
      <div style={MODAL}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Bulk Payment Upload</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Upload a CSV to mark multiple invoices as paid at once</div>
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', display: 'flex' }}>
            <Icon name="x" size={18} color="currentColor" />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* STEP: upload */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 20, lineHeight: 1 }}>📋</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Step 1 — Download the template</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.6 }}>
                    Template downloads with all vendors (one row per vendor). Fill in <strong>Invoice No</strong>, <strong>UTR</strong>, <strong>Payment Date</strong>, <strong>Approval Date</strong> (DD/MM/YYYY) and Payment Mode for the vendors you are paying.
                  </div>
                  <button onClick={downloadTemplate} disabled={tplLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', color: tplLoading ? 'var(--text3)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: tplLoading ? 'default' : 'pointer', opacity: tplLoading ? 0.6 : 1 }}>
                    <Icon name="download" size={13} color="currentColor" />
                    {tplLoading ? 'Loading vendors…' : 'Download Template'}
                  </button>
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border2)'}`,
                  borderRadius: 12, padding: '40px 24px', textAlign: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: dragOver ? 'rgba(29,78,216,0.04)' : 'var(--surface)',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {dragOver ? 'Drop it here' : 'Step 2 — Upload your filled CSV'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Drag & drop or click to browse · CSV only</div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              </div>
            </div>
          )}

          {/* STEP: validating */}
          {step === 'validating' && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Validating your file…</div>
              <div style={{ fontSize: 12 }}>Checking vendor codes, invoice numbers and bill statuses</div>
            </div>
          )}

          {/* STEP: errors */}
          {step === 'errors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
                <span style={{ fontSize: 18 }}>❌</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Upload rejected — {errors.length} issue{errors.length !== 1 ? 's' : ''} found</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Fix all errors in your CSV and re-upload. No records have been changed.</div>
                </div>
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Row', 'Column', 'Error'].map(h => <th key={h} style={TH}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((e, i) => (
                      <tr key={i} style={{ borderBottom: i < errors.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '10px 14px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text3)' }}>#{e.row}</span></td>
                        <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)' }}>{e.field}</span></td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>All {preview.length} row{preview.length !== 1 ? 's' : ''} validated — ready to process</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Review below and confirm. Vendor confirmation emails will be sent automatically after processing.</div>
                </div>
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Vendor', 'Invoice No', 'Amount', 'UTR', 'Mode', 'Payment Date', 'Approval Date'].map(h => <th key={h} style={TH}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < preview.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{r.vendorName}</td>
                        <td style={{ padding: '10px 14px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{r.invoiceNo}</span></td>
                        <td style={{ padding: '10px 14px' }}><span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{fmt(r.amountPaid)}</span></td>
                        <td style={{ padding: '10px 14px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{r.utr}</span></td>
                        <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 99, padding: '3px 9px' }}>{r.paymentMode}</span></td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>{fmtDate(r.paymentDate)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>{fmtDate(r.approvalDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP: processing */}
          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>⚙️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Processing {preview.length} payment{preview.length !== 1 ? 's' : ''}…</div>
              <div style={{ fontSize: 12 }}>Updating bills and queuing vendor email notifications</div>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{result.inserted === result.total ? '🎉' : '⚠️'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {result.inserted} of {result.total} payment{result.total !== 1 ? 's' : ''} processed
              </div>
              {result.inserted === result.total ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
                  All bills marked as paid. Vendor confirmation emails have been queued and will be sent shortly via n8n.
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
                  {result.total - result.inserted} row{result.total - result.inserted !== 1 ? 's' : ''} failed — check console for details. Successfully processed rows have been saved.
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', background: 'var(--surface)' }}>
          {step === 'errors' && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>Fix errors in your file then re-upload</span>
              <button onClick={reset} style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--primary)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Re-upload
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={reset} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmUpload} style={{ padding: '8px 22px', borderRadius: 8, background: 'var(--green)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Confirm & Process {preview.length} Payment{preview.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={close} style={{ padding: '8px 22px', borderRadius: 8, background: 'var(--primary)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Done
            </button>
          )}
          {(step === 'upload' || step === 'validating' || step === 'processing') && (
            <button onClick={close} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
