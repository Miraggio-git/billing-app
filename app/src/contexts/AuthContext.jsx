import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    let data = null
    for (let i = 0; i < 3; i++) {
      const res = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (res.data) { data = res.data; break }
      await new Promise(r => setTimeout(r, 600))
    }
    setProfile(data)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const role = profile?.role || null

  const value = {
    session,
    profile,
    role,
    loading,
    signOut,
    isAdmin: role === 'admin',
    isL1: role === 'l1',
    isL2: role === 'l2',
    isFinance: role === 'finance',
    canManageVendors: role === 'admin',
    canApproveL1: role === 'admin' || role === 'l1',
    canApproveL2: role === 'admin' || role === 'l2',
    canLogPayment: role === 'admin' || role === 'finance',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
