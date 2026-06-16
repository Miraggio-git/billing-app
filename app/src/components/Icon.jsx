const PATHS = {
  dashboard:   'M3 3h7v7H3zm0 11h7v7H3zm11-11h7v7h-7zm0 11h7v7h-7z',
  bills:       'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 3.5L18.5 8H14V3.5zM8 13h8v1H8zm0 3h8v1H8zm0-6h5v1H8z',
  vendors:     'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  contracts:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  payments:    'M4 2h16a1 1 0 011 1v18l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 011-1zm4 6h8M8 10h8M8 14h5',
  alert:       'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  check:       'M20 6L9 17l-5-5',
  x:           'M18 6L6 18M6 6l12 12',
  search:      'M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z',
  plus:        'M12 5v14M5 12h14',
  chevron_left:'M15 18l-6-6 6-6',
  chevron_down:'M6 9l6 6 6-6',
  external:    'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3',
  edit:        'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  settings:    'M12 15a3 3 0 100-6 3 3 0 000 6zm0 0v3m0-12V3m9 9h-3M3 12H0m15.364 6.364l-2.121-2.121M8.757 8.757L6.636 6.636m12.728 0l-2.121 2.121M8.757 15.243l-2.121 2.121',
  filter:      'M4 6h16M7 12h10M10 18h4',
  trending_up: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
}

export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <path d={PATHS[name] || ''} />
    </svg>
  )
}
