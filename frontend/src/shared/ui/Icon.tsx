const paths = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  plus: 'M12 5v14 M5 12h14',
  sales: 'M4 7h16l-1 14H5L4 7Z M8 7V6a4 4 0 0 1 8 0v1',
  history: 'M3 11a9 9 0 1 1 2.5 7 M3 4v7h7 M12 7v5l3 2',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Z M9 7h6 M9 11h6',
  products: 'm12 3 9 5v8l-9 5-9-5V8l9-5Z M3 8l9 5 9-5 M12 13v8 M7.5 5.5l9 5',
  purchases: 'M3 3h2l3 12h11l2-8H6 M9 20h.01 M18 20h.01',
  suppliers: 'M3 17V6h11v11H3Z M14 10h4l3 4v3h-7 M5 17a2 2 0 1 0 4 0 M16 17a2 2 0 1 0 4 0',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  employees: 'M16 21v-2a4 4 0 0 0-8 0v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M3 8v10h3 M21 8v10h-3',
  logout: 'M9 21H4V3h5 M10 12h11 M17 8l4 4-4 4',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  arrow: 'M5 12h14 M14 7l5 5-5 5',
  lock: 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 11h16',
  chart: 'M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8',
  wallet: 'M20 8V4H5a2 2 0 0 0 0 4h16v13H5a2 2 0 0 1-2-2V6 M21 12h-5v5h5 M17 14.5h.01',
  alert: 'm12 3 10 18H2L12 3Z M12 9v5 M12 17h.01',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}><path d={paths[name]} /></svg>
}
