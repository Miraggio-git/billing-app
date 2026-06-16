import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, fmtDateDDMMYY, daysAgo, daysUntil } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icon'
import { ApproveRejectActions } from '../components/ApproveRejectActions'
import { canActOnBill } from '../lib/approval'
import { useAuth } from '../contexts/AuthContext'

const TABS = [
  { key: 'ALL',              label: 'All' },
  { key: 'PENDING_L1',      label: 'L1 Queue' },
  { key: 'PENDING_L2',      label: 'L2 Queue' },
  { key: 'PENDING_PAYMENT', label: 'To Pay' },
  { key: 'PAID',            label: 'Paid' },
  { key: 'REJECTED',        label: 'Rejected' },
]
const FREQ_LABELS = { MONTHLY:'Monthly', QUARTERLY:'Quarterly', ANNUAL:'Annual', ONE_TIME:'One-time' }
const CAT_LABELS  = { IT_SERVICES:'IT Services', CLOUD:'Cloud', HARDWARE:'Hardware', CONSULTING:'Consulting', SUPPORT:'Support', MAINTENANCE:'Maintenance' }
const TH = { padding:'11px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--text3)', letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }
const LBL = { display:'block', fontSize:12, fontWeight:600, color:'var(--text3)', marginBottom:6 }
const EMPTY_CN = { amount:'', reason:'', date:new Date().toISOString().slice(0,10), cn_number:'' }

function fmtBillingPeriod(start, end, frequency, fallback) {
  const base = start || fallback
  if (!base) return ''
  if (frequency === 'QUARTERLY') { const m=new Date(base).getMonth(),y=new Date(base).getFullYear(); return `Q${Math.floor(m/3)+1} ${y}` }
  if (frequency === 'ANNUAL') return new Date(base).getFullYear().toString()
  return new Date(base).toLocaleDateString('en-IN',{month:'short',year:'numeric'})
}
// Bill category falls back to the vendor's category when the bill itself has none.
function billCategory(b) { return b.category || b.vendors?.category || '' }
function dueDateColor(d) {
  if (!d) return 'var(--text3)'
  const days=daysUntil(d)
  if (days<0) return '#dc2626'
  if (days<=7) return '#c2410c'
  if (days<=14) return '#b45309'
  return 'var(--text2)'
}
function generateCSV(bills) {
  const headers=['Vendor','Invoice','Amount (INR)','Period','Frequency','Category','Due Date','Status','Created']
  const rows=bills.map(b=>[b.vendors?.name||'',b.invoice_number||'',b.amount??'',fmtBillingPeriod(b.billing_period_start,b.billing_period_end,b.frequency,b.created_at),FREQ_LABELS[b.frequency]||b.frequency||'',CAT_LABELS[billCategory(b)]||billCategory(b),fmtDateDDMMYY(b.due_date),b.status,fmtDate(b.created_at)])
  const csv=[headers,...rows].map((r,i)=>r.map((v,j)=>i>0&&j===2?v:`"${v}"`).join(',')).join('\n')
  const blob=new Blob([csv],{type:'text/csv'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a');a.href=url;a.download=`bills-${new Date().toISOString().split('T')[0]}.csv`;a.click();URL.revokeObjectURL(url)
}

export function Bills() {
  const navigate=useNavigate()
  const { role } = useAuth()
  const [searchParams,setSearchParams]=useSearchParams()
  const [bills,setBills]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const activeTab=searchParams.get('status')||'ALL'
  const [showCN,setShowCN]=useState(false)
  const [cnBill,setCnBill]=useState(null)
  const [cnForm,setCnForm]=useState(EMPTY_CN)
  const [cnSaving,setCnSaving]=useState(false)
  const [cnError,setCnError]=useState('')
  const [cnSuccess,setCnSuccess]=useState(false)

  useEffect(()=>{
    async function load(){
      setLoading(true)
      const {data}=await supabase.from('bills').select('id,invoice_number,amount,status,billing_period_start,billing_period_end,due_date,paid_at,frequency,category,anomaly_flags,bill_pdf_url,created_at,vendor_id,order_type,vendors(name,category)').order('created_at',{ascending:false})
      setBills(data||[]);setLoading(false)
    }
    load()
  },[])

  const filtered=bills.filter(b=>{
    const matchStatus=activeTab==='ALL'?true:activeTab==='REJECTED'?(b.status==='REJECTED_L1'||b.status==='REJECTED_L2'):b.status===activeTab
    const q=search.toLowerCase()
    return matchStatus&&(!q||(b.vendors?.name||'').toLowerCase().includes(q)||(b.invoice_number||'').toLowerCase().includes(q))
  })
  const setTab=key=>{if(key==='ALL')searchParams.delete('status');else searchParams.set('status',key);setSearchParams(searchParams)}

  function openCN(bill){setCnBill(bill);setCnForm({...EMPTY_CN,amount:bill.amount||''});setCnError('');setCnSuccess(false);setShowCN(true)}

  async function handleSaveCN(){
    if(!cnForm.amount||Number(cnForm.amount)<=0){setCnError('Please enter a valid amount.');return}
    if(!cnForm.reason.trim()){setCnError('Please enter a reason.');return}
    setCnSaving(true);setCnError('')
    const payload={vendor_id:cnBill.vendor_id,vendor_name:cnBill.vendors?.name||'',linked_bill_id:cnBill.id,amount:Number(cnForm.amount),date:cnForm.date||new Date().toISOString().slice(0,10),reason:cnForm.reason.trim(),status:'PENDING'}
    if(cnForm.cn_number.trim())payload.cn_number=cnForm.cn_number.trim()
    const {error}=await supabase.from('credit_notes').insert(payload)
    setCnSaving(false)
    if(error){setCnError(error.message||'Failed to save.');return}
    setCnSuccess(true)
    setTimeout(()=>{setShowCN(false);setCnBill(null);setCnForm(EMPTY_CN);setCnSuccess(false)},1400)
  }

  return (
    /* Full-width container â€" no maxWidth clamp; sits flush beside sidebar */
    <div style={{padding:'24px 24px',width:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28,gap:16,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:800,letterSpacing:'-0.03em',color:'var(--text)'}}>Bills Queue</h1>
          <div style={{color:'var(--text3)',fontSize:13,marginTop:4}}>{bills.length} bills total</div>
        </div>
        <button className="btn-download" onClick={()=>generateCSV(filtered)} style={{display:'flex',alignItems:'center',gap:6}}>
          <Icon name="download" size={14} color="var(--primary)" /> Export Bills
        </button>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:'var(--radius)',padding:'8px 14px',flex:1,minWidth:200,maxWidth:300}}>
          <Icon name="search" size={14} color="var(--text3)" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor or invoice..." style={{border:'none',outline:'none',background:'transparent',flex:1,color:'var(--text)',fontSize:13}} />
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:4}}>
          {TABS.map(({key,label})=>{
            const isActive=activeTab===key
            return <button key={key} onClick={()=>setTab(key)} style={{padding:'6px 14px',borderRadius:8,border:'none',fontSize:12,fontWeight:600,transition:'all 0.15s',background:isActive?'var(--primary)':'transparent',color:isActive?'#fff':'var(--text3)'}}>{label}</button>
          })}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{padding:52,textAlign:'center',color:'var(--text3)',fontSize:13}}>Loading...</div>
        ) : (
          /* Horizontal-scroll safety wrapper â€" table never clips off-screen */
          <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed',minWidth:1150}}>
            <colgroup>
              <col style={{width:'17%'}} />
              <col style={{width:'13%'}} />
              <col style={{width:'10%'}} />
              <col style={{width:'8%'}} />
              <col style={{width:'8%'}} />
              <col style={{width:'10%'}} />
              <col style={{width:'10%'}} />
              <col style={{width:'10%'}} />
              <col style={{width:'14%'}} />
            </colgroup>
            <thead>
              <tr>
                {['Vendor','Invoice','Amount','Period','Freq','Category','Due Date','Status',''].map(h=><th key={h} style={TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b,i)=>(
                <tr key={b.id} className="table-row-hover" style={{borderBottom:i<filtered.length-1?'1px solid var(--border)':'none',cursor:'pointer'}} onClick={()=>navigate(`/bills/${b.id}`)}>
                  {/* Vendor: clamp to 2 lines, neat truncate */}
                  <td style={{padding:'10px 12px'}}>
                    <div className="clamp-2" style={{fontWeight:700,fontSize:14,lineHeight:1.35}} title={b.vendors?.name||''}>{b.vendors?.name||''}</div>
                  </td>
                  <td style={{padding:'10px 12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><span className="mono" style={{fontSize:12,color:'var(--text2)'}}>{b.invoice_number||''}</span></td>
                  <td style={{padding:'10px 12px'}}><span className="mono" style={{fontWeight:600,fontSize:13,color:'var(--text)'}}>{fmt(b.amount)}</span></td>
                  <td style={{padding:'10px 12px',fontSize:12,color:'var(--text3)'}}>{fmtBillingPeriod(b.billing_period_start,b.billing_period_end,b.frequency,b.created_at)}</td>
                  <td style={{padding:'10px 12px'}}>{(FREQ_LABELS[b.frequency]||b.frequency)&&<span style={{fontSize:11,background:'var(--surface3)',color:'var(--text2)',borderRadius:6,padding:'3px 8px',border:'1px solid var(--border2)'}}>{FREQ_LABELS[b.frequency]||b.frequency}</span>}</td>
                  <td style={{padding:'10px 12px'}}>{billCategory(b)&&<span style={{fontSize:11,background:'var(--primary-light)',color:'var(--primary)',borderRadius:6,padding:'3px 8px',fontWeight:600}}>{CAT_LABELS[billCategory(b)]||billCategory(b)}</span>}</td>
                  {/* Due date + paid date */}
                  <td style={{padding:'10px 12px'}}>
                    {b.due_date
                      ? <div className="mono" style={{fontSize:12,fontWeight:600,
                          color: b.status==='PAID' ? '#d97706'
                               : daysUntil(b.due_date)<0 ? '#dc2626'
                               : daysUntil(b.due_date)<=7 ? '#c2410c'
                               : 'var(--text2)'}}>
                          {fmtDateDDMMYY(b.due_date)}
                          {b.status!=='PAID'&&daysUntil(b.due_date)<0&&
                            <span style={{fontSize:9,fontWeight:700,background:'#dc2626',color:'#fff',borderRadius:4,padding:'1px 5px',marginLeft:5,letterSpacing:'0.04em'}}>OVERDUE</span>}
                        </div>
                      : <span style={{fontSize:12,color:'var(--text3)'}}>—</span>}
                    {b.status==='PAID'&&b.paid_at&&(
                      <div className="mono" style={{fontSize:11,color:'#16a34a',fontWeight:600,marginTop:3,display:'flex',alignItems:'center',gap:3}}>
                        <span>✓</span>{fmtDateDDMMYY(b.paid_at)}
                      </div>
                    )}
                  </td>
                  <td style={{padding:'10px 12px'}}><StatusBadge status={b.status} /></td>
                  <td style={{padding:'10px 12px'}} onClick={e => { if (canActOnBill({ role, status: b.status })) e.stopPropagation() }}>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                      {/* PDF icon — always shown, clickable only if URL exists */}
                      {b.bill_pdf_url ? (
                        <a
                          href={b.bill_pdf_url} target="_blank" rel="noreferrer"
                          onClick={e=>e.stopPropagation()}
                          title="View Invoice PDF"
                          style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:'var(--radius)',border:'1px solid rgba(59,130,246,0.35)',background:'rgba(59,130,246,0.08)',color:'var(--primary)',fontWeight:700,fontSize:11,textDecoration:'none'}}
                        >
                          <Icon name="bills" size={11} color="var(--primary)" /> PDF
                        </a>
                      ) : (
                        <span
                          title="No PDF available"
                          style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:'var(--radius)',border:'1px solid var(--border)',background:'var(--surface2)',color:'var(--text3)',fontSize:11,opacity:0.5}}
                        >
                          <Icon name="bills" size={11} color="var(--text3)" /> PDF
                        </span>
                      )}
                      {canActOnBill({ role, status: b.status }) ? (
                        <ApproveRejectActions
                          bill={b}
                          size="sm"
                          stopRowClick
                          onDone={(patch) => setBills(prev => prev.map(x => x.id === b.id ? { ...x, ...patch } : x))}
                        />
                      ) : (
                        <>
                          <button onClick={e=>{e.stopPropagation();navigate(`/bills/${b.id}`)}} className="btn-ghost" style={{padding:'5px 12px',fontSize:12}}>Open &rarr;</button>
                          <button className="btn-ghost" style={{color:'var(--primary)',fontWeight:700,padding:'5px 12px',fontSize:12}} onClick={e=>{e.stopPropagation();openCN(b)}}>+ CR Note</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={9} style={{padding:52,textAlign:'center',color:'var(--text3)',fontSize:13}}>No bills match the current filter</td></tr>}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showCN&&cnBill&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setShowCN(false)}}>
          <div style={{background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:'var(--radius-lg)',width:460,animation:'fadeUp 0.2s ease both',overflow:'hidden'}}>
            <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,fontSize:16,color:'var(--text)'}}>Add Credit Note</div>
                <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>{cnBill.vendors?.name} &middot; {cnBill.invoice_number||'No invoice no.'}</div>
              </div>
              <button onClick={()=>setShowCN(false)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',padding:4}}><Icon name="x" size={18} /></button>
            </div>
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:16}}>
              <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:'var(--text3)'}}>Original Bill Amount</span>
                <span style={{fontFamily:'DM Mono, monospace',fontWeight:700,fontSize:14,color:'var(--text)'}}>{fmt(cnBill.amount)}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div><label style={LBL}>CR Note Number</label><input className="input-base" value={cnForm.cn_number} onChange={e=>setCnForm(p=>({...p,cn_number:e.target.value}))} placeholder="e.g. CN-001" style={{width:'100%'}} /></div>
                <div><label style={LBL}>Date *</label><input className="input-base" type="date" value={cnForm.date} onChange={e=>setCnForm(p=>({...p,date:e.target.value}))} style={{width:'100%'}} /></div>
              </div>
              <div><label style={LBL}>Credit Amount (Rs.) *</label><input className="input-base" type="number" min="0" step="0.01" value={cnForm.amount} onChange={e=>setCnForm(p=>({...p,amount:e.target.value}))} placeholder="Enter credit amount" style={{width:'100%'}} /></div>
              <div><label style={LBL}>Reason *</label><textarea className="input-base" rows={3} value={cnForm.reason} onChange={e=>setCnForm(p=>({...p,reason:e.target.value}))} placeholder="Reason for credit note..." style={{width:'100%',resize:'vertical'}} /></div>
              {cnError&&<div style={{background:'var(--red-light)',color:'#dc2626',borderRadius:'var(--radius)',padding:'10px 14px',fontSize:13}}>{cnError}</div>}
              {cnSuccess&&<div style={{background:'var(--green-light)',color:'#15803d',borderRadius:'var(--radius)',padding:'10px 14px',fontSize:13,fontWeight:600}}>Credit note saved successfully!</div>}
            </div>
            <div style={{padding:'14px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn-ghost" onClick={()=>setShowCN(false)} disabled={cnSaving}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveCN} disabled={cnSaving||cnSuccess}>{cnSaving?'Saving...':'Save Credit Note'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
