import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

const TH = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.03em' }
const ROLES = ['admin', 'l1', 'l2', 'finance']
const ROLE_LABELS = { admin: 'Admin', l1: 'L1 Approver', l2: 'L2 Approver', finance: 'Finance' }
const ROLE_COLORS = { admin: 'var(--primary)', l1: 'var(--lime)', l2: 'var(--green)', finance: 'var(--yellow)' }
const ROLE_BG = { admin: 'rgba(29,78,216,0.15)', l1: 'rgba(163,230,53,0.15)', l2: 'rgba(34,197,94,0.15)', finance: 'rgba(234,179,8,0.15)' }

const INPUT = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

export function Users() {
  const { role: myRole, profile: myProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createForm, setCreateForm] = useState({ email: '', name: '', password: '', role: 'l1' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
    if (err) setError(err.message)
    else setUsers(data || [])
    setLoading(false)
  }

  async function updateUser(userId, changes) {
    setSaving(p => ({ ...p, [userId]: true }))
    const { error: err } = await supabase.from('profiles').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', userId)
    if (err) setError(err.message)
    else setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...changes } : u))
    setSaving(p => ({ ...p, [userId]: false }))
  }

  async function createUser() {
    if (!createForm.email || !createForm.password || !createForm.name) {
      setCreateError('Email, name and password are required.')
      return
    }
    setCreating(true)
    setCreateError('')

    // Save admin session before signUp replaces it
    const { data: { session: adminSession } } = await supabase.auth.getSession()

    const { data, error: err } = await supabase.auth.signUp({
      email: createForm.email,
      password: createForm.password,
      options: { data: { name: createForm.name, role: createForm.role } },
    })

    if (err) { setCreateError(err.message); setCreating(false); return }

    // Restore admin session (signUp auto-signs-in the new user)
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      })
    }

    setShowCreate(false)
    setCreateForm({ email: '', name: '', password: '', role: 'l1' })
    setCreating(false)
    load()
  }

  if (myRole !== 'admin') {
    return (
      <div style={{ padding: '60px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Access Denied</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Only administrators can manage users.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 36px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>Users</h1>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>{users.length} accounts</div>
        </div>
        <button
          onClick={() => { setShowCreate(p => !p); setCreateError('') }}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          {showCreate ? 'Cancel' : '+ New Account'}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 18, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Create Account Form */}
      {showCreate && (
        <div style={{ marginBottom: 22, padding: '20px 22px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Create Account</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Full Name</label>
              <input
                value={createForm.name}
                onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Jane Smith"
                style={INPUT}
                className="input-base"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                placeholder="jane@company.com"
                style={INPUT}
                className="input-base"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Password</label>
              <input
                type="password"
                value={createForm.password}
                onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Minimum 6 characters"
                style={INPUT}
                className="input-base"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Role</label>
              <select
                value={createForm.role}
                onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))}
                style={{ ...INPUT, cursor: 'pointer' }}
                className="input-base"
              >
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          {createError && (
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
              {createError}
            </div>
          )}
          <button
            onClick={createUser}
            disabled={creating}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1 }}
          >
            {creating ? 'Creating…' : 'Create Account'}
          </button>
          <span style={{ marginLeft: 12, fontSize: 11, color: 'var(--text3)' }}>User will receive a confirmation email to activate their account.</span>
        </div>
      )}

      {/* Role legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        {ROLES.map(r => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: ROLE_BG[r], border: `1px solid ${ROLE_COLORS[r]}33`, borderRadius: 99, fontSize: 12, fontWeight: 600, color: ROLE_COLORS[r] }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: ROLE_COLORS[r] }} />
            {ROLE_LABELS[r]}
          </div>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 52, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {['User', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const isMe = u.id === myProfile?.id
                const isSaving = saving[u.id]
                return (
                  <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none', opacity: isSaving ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: ROLE_BG[u.role] || 'var(--surface3)',
                          border: `1px solid ${ROLE_COLORS[u.role] || 'var(--border)'}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                          color: ROLE_COLORS[u.role] || 'var(--text3)',
                        }}>
                          {(u.name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                            {u.name || '—'} {isMe && <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 4 }}>(you)</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <select
                        value={u.role}
                        disabled={isMe || isSaving}
                        onChange={e => updateUser(u.id, { role: e.target.value })}
                        className="input-base"
                        style={{ fontSize: 12, padding: '5px 10px', width: 'auto', minWidth: 120, color: ROLE_COLORS[u.role] || 'var(--text)', fontWeight: 600 }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <button
                        disabled={isMe || isSaving}
                        onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 99,
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: isMe ? 'not-allowed' : 'pointer',
                          background: u.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
                          color: u.is_active ? 'var(--green)' : 'var(--red)',
                          opacity: isMe ? 0.5 : 1,
                        }}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text3)' }}>{fmtDate(u.created_at)}</td>
                    <td style={{ padding: '13px 16px' }}>
                      {!isMe && (
                        <button
                          className="btn-ghost"
                          disabled={isSaving}
                          onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                          style={{ padding: '5px 12px', fontSize: 12 }}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 52, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                    No users yet. Use the button above to create the first account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

