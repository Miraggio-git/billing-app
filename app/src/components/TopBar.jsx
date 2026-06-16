import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { useAuth } from '../contexts/AuthContext'

const PAGES = [
  { to: '/',            label: 'Overview'    },
  { to: '/bills',       label: 'Bills Queue' },
  { to: '/vendors',     label: 'Vendors'     },
  { to: '/contracts',   label: 'Contracts'   },
  { to: '/agreements',  label: 'Agreements'  },
  { to: '/payments',    label: 'Payments'    },
]

export function TopBar() {
  const { profile, role, signOut } = useAuth()

  const roleColor = { admin: 'var(--primary)', l1: 'var(--lime)', l2: 'var(--green)', finance: 'var(--yellow)' }[role] || 'var(--primary)'

  return (
    <header style={{
      height: 'var(--top-h)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 6,
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Pill nav */}
      <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
        {PAGES.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <button className={`nav-pill${isActive ? ' active' : ''}`}>
                {label}
              </button>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Right: search + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="icon-btn">
          <Icon name="search" size={15} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
              {profile?.name || profile?.email || 'User'}
            </div>
            <div style={{ fontSize: 10, color: roleColor, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 1 }}>
              {role ? { admin: 'Admin', l1: 'L1 Approver', l2: 'L2 Approver', finance: 'Finance' }[role] : ''}
            </div>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff' }}>
            {(profile?.name || profile?.email || 'M')[0].toUpperCase()}
          </div>
          <button onClick={signOut} title="Sign out" style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}

