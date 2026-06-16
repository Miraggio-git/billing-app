import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const SIDEBAR_KEY = 'miraggio-sidebar'
const COLLAPSED_W = 64
const EXPANDED_W  = 232

export function MicroSidebar() {
  const { isAdmin, profile, role, signOut, canApproveL1, canApproveL2 } = useAuth()
  const canApprove = canApproveL1 || canApproveL2

  // Badge count for pending approvals tab
  const [pendingCount, setPendingCount] = useState(0)
  useEffect(() => {
    if (!canApprove) return
    let cancelled = false
    async function fetchPending() {
      const statuses =
        role === 'l1' ? ['PENDING_L1'] :
        role === 'l2' ? ['PENDING_L2'] :
        ['PENDING_L1', 'PENDING_L2']
      const { count } = await supabase
        .from('bills').select('id', { count: 'exact', head: true })
        .in('status', statuses)
      if (!cancelled) setPendingCount(count || 0)
    }
    fetchPending()
    const t = setInterval(fetchPending, 30000) // refresh every 30s
    return () => { cancelled = true; clearInterval(t) }
  }, [canApprove, role])

  // Collapsed by default; toggled by clicking the MIRAGGIO SmS brand
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) !== 'expanded' } catch { return true }
  })

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded') } catch {}
    // Keep the global --side-w in sync so any other layout that reads it adjusts too
    document.documentElement.style.setProperty('--side-w', `${collapsed ? COLLAPSED_W : EXPANDED_W}px`)
  }, [collapsed])

  const NAV = [
    { to: '/',           icon: 'dashboard', label: 'Dashboard'  },
    { to: '/bills',      icon: 'bills',     label: 'Bills'      },
    ...(canApprove ? [{ to: '/approvals', icon: 'check', label: 'Approvals', badge: pendingCount }] : []),
    { to: '/vendors',    icon: 'vendors',   label: 'Vendors'    },
    { to: '/contracts',  icon: 'contracts', label: 'Contracts'  },
    { to: '/payments',   icon: 'payments',  label: 'Payments'   },
    { to: '/users',      icon: 'vendors',   label: 'Users'      },
  ]

  const roleLabel = { admin: 'Admin', l1: 'L1 Approver', l2: 'L2 Approver', finance: 'Finance' }[role] || role

  return (
    <aside style={{
      width: collapsed ? COLLAPSED_W : EXPANDED_W,
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflow: 'hidden',
      transition: 'width 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
    }}>
      {/* Brand — click to toggle */}
      <div
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand menu' : 'Collapse menu'}
        style={{
          padding: collapsed ? '22px 0 18px' : '22px 20px 18px',
          borderBottom: '1px solid var(--border)',
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          minHeight: 60,
          whiteSpace: 'nowrap',
          transition: 'background 0.15s, padding 0.22s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {collapsed ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            color: 'var(--primary)',
            fontWeight: 900,
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}>
            <span style={{ fontSize: 19, fontWeight: 900 }}>S</span>
            <span style={{ fontSize: 10, position: 'relative', top: -2, margin: '0 1px' }}>M</span>
            <span style={{ fontSize: 19, fontWeight: 900 }}>S</span>
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, lineHeight: 1 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.01em' }}>MIRAGGIO</span>
            <span style={{ fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.06em' }}>
              <span style={{ fontSize: 22, fontWeight: 900 }}>S</span>
              <span style={{ fontSize: 11 }}>M</span>
              <span style={{ fontSize: 22, fontWeight: 900 }}>S</span>
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 10, paddingBottom: 10, overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV.map(({ to, icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={{ display: 'block', textDecoration: 'none' }}
            title={collapsed ? (badge ? `${label} (${badge})` : label) : ''}
          >
            {({ isActive }) => (
              <div
                className={`sidebar-nav-link${isActive ? ' active' : ''}`}
                style={collapsed ? {
                  justifyContent: 'center',
                  padding: '9px 0',
                  margin: '2px 6px',
                  borderLeft: '3px solid transparent',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                } : { whiteSpace: 'nowrap', position: 'relative' }}
              >
                <Icon
                  name={icon}
                  size={16}
                  color={isActive ? 'var(--primary)' : 'var(--text3)'}
                />
                {!collapsed && label}
                {badge > 0 && (
                  collapsed ? (
                    <span style={{
                      position: 'absolute', top: 2, right: 8,
                      background: 'var(--red, #ef4444)', color: '#fff',
                      fontSize: 9, fontWeight: 700, padding: '1px 5px',
                      borderRadius: 8, lineHeight: 1.4, minWidth: 14, textAlign: 'center',
                    }}>{badge > 99 ? '99+' : badge}</span>
                  ) : (
                    <span style={{
                      marginLeft: 'auto',
                      background: isActive ? 'var(--primary)' : 'var(--red, #ef4444)',
                      color: '#fff', fontSize: 10, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 10, lineHeight: 1.3,
                    }}>{badge > 99 ? '99+' : badge}</span>
                  )
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User profile */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: collapsed ? '14px 0' : '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        whiteSpace: 'nowrap',
      }}>
        <div
          title={collapsed ? `${profile?.name || profile?.email?.split('@')[0] || 'User'} — ${roleLabel}` : ''}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13, color: '#fff',
            flexShrink: 0,
          }}>
          {(profile?.name || profile?.email || 'M')[0].toUpperCase()}
        </div>
        {!collapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.name || profile?.email?.split('@')[0] || 'User'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {roleLabel}
              </div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              style={{
                background: 'none', border: 'none', padding: 4,
                color: 'var(--text3)', cursor: 'pointer', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Icon name="x" size={14} color="var(--text3)" />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
