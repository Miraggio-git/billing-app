import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from './Icon'

const NAV = [
  { to: '/',          icon: 'dashboard', label: 'Overview'   },
  { to: '/bills',     icon: 'bills',     label: 'Bills Queue' },
  { to: '/vendors',   icon: 'vendors',   label: 'Vendors'    },
  { to: '/contracts', icon: 'contracts', label: 'Contracts'  },
  { to: '/payments',  icon: 'payments',  label: 'Payments'   },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a18 0%, #07070f 100%)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
    }}>

      {/* Ambient top glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent, var(--amber), var(--cyan), transparent)',
        animation: 'borderFlicker 8s ease-in-out infinite',
      }} />

      {/* Logo */}
      <div style={{ padding: '28px 20px 22px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
        <div style={{
          fontFamily: 'Orbitron, monospace',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: 'var(--amber)',
          textShadow: '0 0 12px rgba(255,140,0,0.7), 0 0 32px rgba(255,140,0,0.3)',
          animation: 'neonFlicker 10s ease-in-out infinite',
        }}>
          MIRAGGIO
        </div>
        <div style={{
          fontSize: 9,
          color: 'var(--cyan)',
          letterSpacing: '0.28em',
          marginTop: 4,
          textTransform: 'uppercase',
          opacity: 0.8,
          textShadow: '0 0 8px rgba(0,212,232,0.5)',
        }}>
          ▸ Vendor · Payments
        </div>
        {/* Decorative corner */}
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24,
          borderBottom: '1px solid var(--amber-dim)', borderRight: '1px solid var(--amber-dim)',
          opacity: 0.3,
        }} />
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 10px', flex: 1 }}>
        {NAV.map(({ to, icon, label }, idx) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              width: '100%',
              padding: '10px 13px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: isActive
                ? 'linear-gradient(90deg, rgba(255,140,0,0.12) 0%, rgba(255,140,0,0.04) 100%)'
                : 'transparent',
              borderLeft: isActive ? '2px solid var(--amber)' : '2px solid transparent',
              color: isActive ? 'var(--amber)' : 'var(--text2)',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 2,
              textDecoration: 'none',
              transition: 'all 0.2s',
              boxShadow: isActive ? '0 0 12px rgba(255,140,0,0.08)' : 'none',
              letterSpacing: '0.02em',
              animation: `slideInLeft 0.3s ${idx * 0.05}s both`,
            })}
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={icon}
                  color={isActive ? 'var(--amber)' : 'var(--text3)'}
                  size={15}
                />
                {label}
                {isActive && (
                  <span style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--amber)',
                    boxShadow: '0 0 6px var(--amber)',
                    animation: 'glowPulse 2s ease-in-out infinite',
                  }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* System status */}
      <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
            boxShadow: '0 0 6px var(--green)',
            animation: 'cyanPulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em' }}>
            SYS · ONLINE
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.04em' }}>
          DB: SUPABASE / AP-SE-2
        </div>
      </div>
    </aside>
  )
}
