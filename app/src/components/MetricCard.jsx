import { useEffect, useRef, useState } from 'react'

function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(null)
  const raf = useRef(null)
  useEffect(() => {
    const raw = String(target)
    const num = parseFloat(raw.replace(/[^0-9.]/g, ''))
    const prefix = raw.startsWith('₹') ? '₹' : ''
    if (isNaN(num) || !prefix) { setDisplay(target); return }
    let start = null
    const tick = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(prefix + (num * ease).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target])
  return display ?? target
}

export function MetricCard({ label, value, sub, accent = 'orange', onClick, urgent, trend }) {
  const animated = useCountUp(value)
  const [hovered, setHovered] = useState(false)
  const accentColor = accent === 'lime' ? 'var(--lime)' : accent === 'green' ? 'var(--green)' : accent === 'red' ? 'var(--red)' : 'var(--primary)'
  const accentBg = accent === 'lime' ? 'var(--lime-dim)' : accent === 'green' ? 'rgba(34,197,94,0.08)' : accent === 'red' ? 'rgba(239,68,68,0.08)' : 'var(--orange-dim)'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--surface2)' : 'var(--surface)',
        border: `1px solid ${hovered && onClick ? accentColor + '55' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '22px 22px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s',
        transform: hovered && onClick ? 'translateY(-2px)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent bar top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accentColor,
        borderRadius: '16px 16px 0 0',
        opacity: urgent ? 1 : 0.5,
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </div>
        {urgent && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: accentColor,
            animation: accent === 'lime' ? 'pulse-lime 2s infinite' : 'pulse-orange 2s infinite',
          }} />
        )}
      </div>

      <div style={{
        fontSize: String(value).startsWith('₹') ? 24 : 40,
        fontWeight: 900,
        color: 'var(--text)',
        lineHeight: 1,
        letterSpacing: '-0.03em',
        animation: 'countIn 0.4s ease both',
        fontFamily: String(value).startsWith('₹') ? 'DM Mono, monospace' : 'Inter, sans-serif',
      }}>
        {animated}
      </div>

      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>{sub}</div>
      )}

      {trend !== undefined && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <span style={{ color: trend >= 0 ? 'var(--lime)' : 'var(--red)', fontWeight: 600 }}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
          <span style={{ color: 'var(--text3)' }}>vs last month</span>
        </div>
      )}
    </div>
  )
}

