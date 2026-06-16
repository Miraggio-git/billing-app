import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { fmtDate } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icon'

const TH = { padding:'11px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--text3)', letterSpacing:'0.04em', textTransform:'uppercase', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }
const STATUS_TABS = ['ALL','ACTIVE','PENDING','INACTIVE']
const VENDOR_CATEGORIES = ['ALL','SERVICE','PRODUCT']
const EMPTY_FORM = { name:'', email:'', phone:'', contact_person:'', gstin:'', pan:'', vendor_code:'', category:'SERVICE', service_description:'', bank_name:'', bank_account_no:'', bank_ifsc:'', bank_account_name:'' }

function Section({ title }) {
  return (
    <div style={{gridColumn:'span 2',display:'flex',alignItems:'center',gap:10,marginTop:4}}>
      <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:'0.06em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{title}</div>
      <div style={{flex:1,height:1,background:'var(--border)'}} />
    </div>
  )
}

function PdfLink({ url, label }) {
  if (!url||!url.trim()) return null
  return (
    <a href={url.trim()} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
      style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,color:'var(--primary)',background:'var(--primary-light)',borderRadius:6,padding:'3px 8px',textDecoration:'none',border:'1px solid rgba(29,78,216,0.15)',whiteSpace:'nowrap'}}>
      PDF {label}
    </a>
  )
}

export function Vendors() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [vendors,setVendors]           = useState([])
  const [agreementMap,setAgreementMap] = useState({})
  const [loading,setLoading]           = useState(true)
  const [loadError,setLoadError]       = useState('')
  const [search,setSearch]             = useState('')
  const [statusFilter,setStatusFilter] = useState('ALL')
  const [categoryFilter,setCategoryFilter] = useState('ALL')
  const [showForm,setShowForm]         = useState(false)
  const [form,setForm]                 = useState(EMPTY_FORM)
  const [saving,setSaving]             = useState(false)
  const [error,setError]               = useState(null)
  const [success,setSuccess]           = useState(false)
  const [expanded,setExpanded]         = useState({})

  const isDemoEmail = email => !email || email.trim().toLowerCase().startsWith('vendor')

  useEffect(()=>{ load() },[])

  async function load() {
    setLoading(true); setLoadError('')
    try {
      const [{data:vData,error:vErr},{data:agData}] = await Promise.all([
        supabase.from('vendors').select('id,name,email,phone,contact_person,gstin,pan,status,vendor_code,category,parent_vendor_id,created_at').order('name',{ascending:true}),
        supabase.from('agreements').select('vendor_id,agreement_url,agreement_url2').not('vendor_id','is',null),
      ])
      if (vErr) throw vErr
      setVendors(vData||[])
      const map = {}
      for (const ag of (agData||[])) {
        if (!ag.vendor_id) continue
        if (!map[ag.vendor_id]) map[ag.vendor_id]={url:null,url2:null}
        if (ag.agreement_url&&!map[ag.vendor_id].url)   map[ag.vendor_id].url  = ag.agreement_url
        if (ag.agreement_url2&&!map[ag.vendor_id].url2) map[ag.vendor_id].url2 = ag.agreement_url2
      }
      setAgreementMap(map)
    } catch(err) { setLoadError(err.message||'Failed to load vendors.') }
    finally { setLoading(false) }
  }

  async function handleAdd() {
    if (!form.name.trim()||!form.email.trim()) return
    setSaving(true); setError(null)
    const payload=Object.fromEntries(Object.entries(form).filter(([,v])=>v&&v.trim()).map(([k,v])=>[k,v.trim()]))
    payload.status='PENDING'
    const {error:err}=await supabase.from('vendors').insert(payload)
    if (err){setError(err);setSaving(false);return}
    setSuccess(true); await load(); setSaving(false)
    setTimeout(()=>{setSuccess(false);setShowForm(false);setForm(EMPTY_FORM)},1200)
  }

  function handleClose(){setShowForm(false);setForm(EMPTY_FORM);setError(null);setSuccess(false)}

  // Build children map: parent_id → [children]
  const childrenMap = {}
  for (const v of vendors) {
    if (v.parent_vendor_id) {
      if (!childrenMap[v.parent_vendor_id]) childrenMap[v.parent_vendor_id] = []
      childrenMap[v.parent_vendor_id].push(v)
    }
  }
  // Only show top-level vendors in main list
  const topLevel = vendors.filter(v => !v.parent_vendor_id)

  const filtered = topLevel.filter(v => {
    const matchStatus   = statusFilter==='ALL' || v.status===statusFilter
    const matchCategory = categoryFilter==='ALL' || v.category===categoryFilter
    const q = search.toLowerCase()
    const children = childrenMap[v.id] || []
    const matchChildren = children.some(c =>
      c.name.toLowerCase().includes(q) ||
      (c.category||'').toLowerCase().includes(q)
    )
    return matchStatus && matchCategory && (!q ||
      v.name.toLowerCase().includes(q) ||
      (v.email||'').toLowerCase().includes(q) ||
      (v.vendor_code||'').toLowerCase().includes(q) ||
      matchChildren
    )
  })

  return (
    /* Full-width container — sits flush beside sidebar, fills remaining width */
    <div style={{padding:'24px 24px',width:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28,gap:16,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:800,letterSpacing:'-0.03em',color:'var(--text)'}}>Vendors</h1>
          <div style={{color:'var(--text3)',fontSize:13,marginTop:4}}>{topLevel.length} vendors · {vendors.length} entities</div>
        </div>
        {role==='admin'&&<button className="btn-primary" onClick={()=>setShowForm(true)} style={{display:'flex',alignItems:'center',gap:6}}><Icon name="plus" size={14} color="#fff" /> Add Vendor</button>}
      </div>

      {loadError&&<div style={{marginBottom:18,padding:'12px 16px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius)',color:'#dc2626',fontSize:13}}>{loadError}</div>}

      {showForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}}>
          <div style={{background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:'var(--radius-lg)',width:600,maxHeight:'90vh',overflowY:'auto',animation:'fadeUp 0.2s ease both'}}>
            <div style={{padding:'20px 28px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'var(--surface)',zIndex:1}}>
              <div>
                <div style={{fontWeight:700,fontSize:17,color:'var(--text)'}}>Register New Vendor</div>
                <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>Fields marked * are required</div>
              </div>
              <button onClick={handleClose} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',padding:4}}><Icon name="x" size={18} /></button>
            </div>
            <div style={{padding:'20px 28px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <Section title="Basic Information" />
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)',gridColumn:'span 2'}}>Vendor Name *<input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="input-base" placeholder="Legal entity name" style={{fontSize:13}} /></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>Email *<input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="input-base" type="email" placeholder="vendor@example.com" style={{fontSize:13}} /></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>Phone<input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="input-base" placeholder="+91..." style={{fontSize:13}} /></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>Contact Person<input value={form.contact_person} onChange={e=>setForm(p=>({...p,contact_person:e.target.value}))} className="input-base" placeholder="Name" style={{fontSize:13}} /></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>Category<select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} className="input-base" style={{fontSize:13}}><option value="SERVICE">Service</option><option value="PRODUCT">Product</option></select></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)',gridColumn:'span 2'}}>Service Description<textarea value={form.service_description} onChange={e=>setForm(p=>({...p,service_description:e.target.value}))} className="input-base" rows={3} style={{fontSize:13,resize:'vertical'}} placeholder="Describe the services or products this vendor provides…" /></label>
              <Section title="Tax and Compliance" />
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>GSTIN<input value={form.gstin} onChange={e=>setForm(p=>({...p,gstin:e.target.value}))} className="input-base" placeholder="15-character GST number" style={{fontSize:13}} /></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>PAN<input value={form.pan} onChange={e=>setForm(p=>({...p,pan:e.target.value}))} className="input-base" placeholder="10-character PAN" style={{fontSize:13}} /></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>Vendor Code<input value={form.vendor_code} onChange={e=>setForm(p=>({...p,vendor_code:e.target.value}))} className="input-base" placeholder="Internal code" style={{fontSize:13}} /></label>
              <Section title="Bank Details" />
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>Bank Name<input value={form.bank_name} onChange={e=>setForm(p=>({...p,bank_name:e.target.value}))} className="input-base" placeholder="e.g. HDFC Bank" style={{fontSize:13}} /></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>IFSC Code<input value={form.bank_ifsc} onChange={e=>setForm(p=>({...p,bank_ifsc:e.target.value}))} className="input-base" placeholder="e.g. HDFC0001234" style={{fontSize:13}} /></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>Account Number<input value={form.bank_account_no} onChange={e=>setForm(p=>({...p,bank_account_no:e.target.value}))} className="input-base" placeholder="Account number" style={{fontSize:13}} /></label>
              <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:12,fontWeight:600,color:'var(--text3)'}}>Account Holder Name<input value={form.bank_account_name} onChange={e=>setForm(p=>({...p,bank_account_name:e.target.value}))} className="input-base" placeholder="Name on account" style={{fontSize:13}} /></label>
            </div>
            {success&&<div style={{margin:'0 28px 14px',padding:'12px 16px',background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:'var(--radius)',color:'#15803d',fontSize:13,fontWeight:600}}>Vendor registered successfully!</div>}
            {error&&<div style={{margin:'0 28px 14px',padding:'12px 16px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius)'}}><div style={{color:'#dc2626',fontSize:13,fontWeight:600}}>{error.message||'An error occurred.'}</div>{error.hint&&<div style={{fontSize:11,color:'#dc2626',opacity:0.7,marginTop:4}}>{error.hint}</div>}</div>}
            <div style={{padding:'16px 28px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:10}}>
              <button className="btn-ghost" onClick={handleClose}>Cancel</button>
              <button className="btn-primary" onClick={handleAdd} disabled={saving||success||!form.name.trim()||!form.email.trim()}>{saving?'Saving...':'Register Vendor'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:10,marginBottom:18,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:'var(--radius)',padding:'8px 14px',flex:1,maxWidth:300}}>
          <Icon name="search" size={14} color="var(--text3)" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, code..." style={{border:'none',outline:'none',background:'transparent',flex:1,color:'var(--text)',fontSize:13}} />
        </div>
        <div style={{display:'flex',gap:4,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:4}}>
          {STATUS_TABS.map(s=><button key={s} onClick={()=>setStatusFilter(s)} style={{padding:'6px 14px',borderRadius:8,border:'none',fontSize:12,fontWeight:600,transition:'all 0.15s',background:statusFilter===s?'var(--lime)':'transparent',color:statusFilter===s?'#111':'var(--text3)'}}>{s.charAt(0)+s.slice(1).toLowerCase()}</button>)}
        </div>
        <div style={{display:'flex',gap:4,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:4}}>
          {VENDOR_CATEGORIES.map(c=><button key={c} onClick={()=>setCategoryFilter(c)} style={{padding:'6px 14px',borderRadius:8,border:'none',fontSize:12,fontWeight:600,transition:'all 0.15s',background:categoryFilter===c?'var(--primary)':'transparent',color:categoryFilter===c?'#fff':'var(--text3)'}}>{c.charAt(0)+c.slice(1).toLowerCase()}</button>)}
        </div>
      </div>

      <div className="card">
        {loading ? <div style={{padding:52,textAlign:'center',color:'var(--text3)',fontSize:13}}>Loading...</div> : (
          /* Horizontal-scroll safety wrapper — table never clips off-screen */
          <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed',minWidth:880}}>
            <colgroup>
              <col style={{width:'22%'}} />
              <col style={{width:'11%'}} />
              <col style={{width:'9%'}} />
              <col style={{width:'11%'}} />
              <col style={{width:'13%'}} />
              <col style={{width:'9%'}} />
              <col style={{width:'11%'}} />
              <col style={{width:'14%'}} />
            </colgroup>
            <thead>
              <tr>
                {['Vendor','Code','Category','Contact','GSTIN','Status','Documents',''].map(h=><th key={h} style={TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v,i)=>{
                const ag       = agreementMap[v.id]||{}
                const children = childrenMap[v.id]||[]
                const hasKids  = children.length > 0
                const isOpen   = expanded[v.id]
                const showEmail = !isDemoEmail(v.email)
                const rows = []

                // ── Parent row ──
                rows.push(
                  <tr key={v.id} className="table-row-hover" style={{borderBottom:'1px solid var(--border)',cursor:'pointer',background:'var(--surface)'}} onClick={()=>navigate(`/vendors/${v.id}`)}>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        {hasKids && (
                          <button onClick={e=>{e.stopPropagation();setExpanded(p=>({...p,[v.id]:!p[v.id]}))}}
                            style={{background:'none',border:'none',cursor:'pointer',padding:'2px 4px',color:'var(--text3)',fontSize:13,lineHeight:1,flexShrink:0}}>
                            {isOpen ? '▾' : '▸'}
                          </button>
                        )}
                        <div style={{minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span className="clamp-2" style={{fontWeight:600,fontSize:13}}>{v.name}</span>
                            {hasKids && <span style={{fontSize:10,fontWeight:700,background:'var(--primary-light)',color:'var(--primary)',borderRadius:99,padding:'2px 7px',flexShrink:0}}>{children.length+1} entities</span>}
                          </div>
                          {showEmail && <div style={{fontSize:12,color:'var(--text3)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{padding:'10px 12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><span className="mono" style={{fontSize:12,color:'var(--text2)'}}>{v.vendor_code||''}</span></td>
                    <td style={{padding:'10px 12px'}}>{v.category&&<span style={{fontSize:11,fontWeight:700,borderRadius:99,padding:'4px 10px',background:v.category==='SERVICE'?'var(--primary-light)':v.category==='PRODUCT'?'var(--lime-light)':'var(--surface3)',color:v.category==='SERVICE'?'var(--primary)':v.category==='PRODUCT'?'#4d7c0f':'var(--text3)'}}>{v.category}</span>}</td>
                    <td style={{padding:'10px 12px',fontSize:13,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.contact_person||''}</td>
                    <td style={{padding:'10px 12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><span className="mono" style={{fontSize:12,color:'var(--text2)'}}>{v.gstin||''}</span></td>
                    <td style={{padding:'10px 12px'}}><StatusBadge status={v.status} type="vendor" /></td>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:4}}>
                        {ag.url ? <PdfLink url={ag.url} label="Agreement"/> : <span style={{fontSize:11,color:'var(--text3)'}}>No agreement</span>}
                        {ag.url2 && <PdfLink url={ag.url2} label="Addendum"/>}
                      </div>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <button onClick={e=>{e.stopPropagation();navigate(`/vendors/${v.id}`)}} className="btn-ghost" style={{padding:'5px 10px',fontSize:12}}>View →</button>
                        <button onClick={e=>{e.stopPropagation();navigate(`/vendors/${v.id}/ledger`)}} className="btn-ghost" style={{padding:'5px 10px',fontSize:12,color:'var(--primary)',fontWeight:700}}>Ledger</button>
                      </div>
                    </td>
                  </tr>
                )

                // ── Child rows (expanded) ──
                if (hasKids && isOpen) {
                  children.forEach(c => {
                    const cag = agreementMap[c.id]||{}
                    rows.push(
                      <tr key={c.id} className="table-row-hover" style={{borderBottom:'1px solid var(--border)',cursor:'pointer',background:'var(--surface2)'}} onClick={()=>navigate(`/vendors/${c.id}`)}>
                        <td style={{padding:'9px 12px 9px 36px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{color:'var(--text3)',fontSize:12,flexShrink:0}}>↳</span>
                            <div style={{minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:500,color:'var(--text2)'}}>{c.name}</div>
                              {c.category && <span style={{fontSize:10,fontWeight:600,color:'var(--primary)',background:'var(--primary-light)',borderRadius:4,padding:'1px 6px'}}>{c.category}</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{padding:'9px 12px'}}><span className="mono" style={{fontSize:11,color:'var(--text3)'}}>{c.vendor_code||''}</span></td>
                        <td style={{padding:'9px 12px'}}></td>
                        <td style={{padding:'9px 12px',fontSize:12,color:'var(--text3)'}}>{c.contact_person||''}</td>
                        <td style={{padding:'9px 12px'}}><span className="mono" style={{fontSize:11,color:'var(--text3)'}}>{c.gstin||''}</span></td>
                        <td style={{padding:'9px 12px'}}><StatusBadge status={c.status} type="vendor"/></td>
                        <td style={{padding:'9px 12px'}}>
                          {cag.url ? <PdfLink url={cag.url} label="Agreement"/> : <span style={{fontSize:11,color:'var(--text3)'}}>No agreement</span>}
                          {cag.url2 && <PdfLink url={cag.url2} label="Addendum"/>}
                        </td>
                        <td style={{padding:'9px 12px'}}>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={e=>{e.stopPropagation();navigate(`/vendors/${c.id}`)}} className="btn-ghost" style={{padding:'4px 8px',fontSize:11}}>View →</button>
                            <button onClick={e=>{e.stopPropagation();navigate(`/vendors/${c.id}/ledger`)}} className="btn-ghost" style={{padding:'4px 8px',fontSize:11,color:'var(--primary)',fontWeight:700}}>Ledger</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                }
                return rows
              })}
              {filtered.length===0&&<tr><td colSpan={8} style={{padding:52,textAlign:'center',color:'var(--text3)',fontSize:13}}>No vendors found</td></tr>}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
