import type { CSSProperties } from 'react'

export type IconName = 'board' | 'document' | 'plus' | 'arrow' | 'close' | 'menu' | 'check' | 'local' | 'search'
const paths: Record<IconName, React.ReactNode> = {
  board: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="5" width="7" height="10" rx="1.5" /><rect x="5" y="14" width="7" height="7" rx="1.5" /></>,
  document: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  check: <path d="m5 12 4 4L19 6" />,
  local: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
}

export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>
}
