import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError(''); setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf7 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 20px' }}>
        {/* Logo and Branding */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          {/* Blue Grid Icon */}
          <svg
            width="56"
            height="56"
            viewBox="0 0 56 56"
            style={{ margin: '0 auto 20px', display: 'block' }}
          >
            <rect x="8" y="8" width="40" height="40" fill="var(--primary)" rx="8" />
            <g stroke="#fff" strokeWidth="2">
              <line x1="18" y1="8" x2="18" y2="48" />
              <line x1="28" y1="8" x2="28" y2="48" />
              <line x1="38" y1="8" x2="38" y2="48" />
              <line x1="8" y1="18" x2="48" y2="18" />
              <line x1="8" y1="28" x2="48" y2="28" />
              <line x1="8" y1="38" x2="48" y2="38" />
            </g>
          </svg>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', letterSpacing: '0.04em' }}>
            MIRAGGIO SMS
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, fontWeight: 500 }}>
            Supply Management System
          </div>
        </div>

        {/* Form Card */}
        <form onSubmit={handleLogin}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '40px 32px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>
                Email Address
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@miraggio.com"
                  autoComplete="email"
                  className="input-base"
                  style={{ fontSize: 14 }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input-base"
                  style={{ fontSize: 14 }}
                />
              </label>
            </div>

            {error && (
              <div style={{
                marginTop: 16,
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10,
                color: 'var(--red)',
                fontSize: 13,
                fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !email.trim() || !password}
              style={{ width: '100%', justifyContent: 'center', marginTop: 24, padding: '12px', fontSize: 14, fontWeight: 700 }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text3)' }}>
          Contact your administrator to get access.
        </div>
      </div>
    </div>
  )
}
