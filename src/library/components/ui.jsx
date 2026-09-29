import { useEffect, useRef, useState } from 'react'
import { bus } from '../lib/bus.js'

// ---------- Icons (Lucide paths, ISC) ----------
const PATHS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  books: 'M16 6l4 14M12 6v14M8 8v12M4 4v16',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0 .01',
  borrow: 'M12 5v14M5 12l7 7 7-7',
  return: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  alert: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01',
  gate: 'M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 21V11h6v10M2 21h20',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  bell: 'M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  report: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  device: 'M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0M8.5 16.429a5 5 0 0 1 7 0',
  log: 'M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13',
  settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  home: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  search: 'm21 21-4.34-4.34M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  history: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  plus: 'M5 12h14M12 5v14',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  xCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6',
  card: 'M2 5h20v14H2zM2 10h20M6 15h4',
  tag: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42zM7.5 7.5h.01',
  face: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  edit: 'M12 20h9M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  archive: 'M3 3h18v5H3zM5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  refresh: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5',
  menu: 'M4 12h16M4 6h16M4 18h16',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  chevron: 'm9 18 6-6-6-6',
  cpu: 'M9 9h6v6H9zM4 4h16v16H4zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3',
  sparkle: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
  lock: 'M5 11h14v10H5zM7 11V7a5 5 0 0 1 10 0v4',
  unlock: 'M5 11h14v10H5zM7 11V7a5 5 0 0 1 9.9-1',
  eye: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  mail: 'M2 4h20v16H2zM22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7',
  sms: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
  api: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  db: 'M3 5a9 3 0 1 0 18 0 9 3 0 1 0-18 0M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M12 3v18',
  flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
}

export function Icon({ name, size = 18, className = '', strokeWidth = 1.8 }) {
  return (
    <svg className={`ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.book} />
    </svg>
  )
}

// ---------- Status badges: icon + label, never colour alone ----------
const STATUS = {
  available: ['Available', 'good', 'checkCircle'],
  borrowed: ['Borrowed', 'info', 'book'],
  reserved: ['Reserved', 'warn', 'clock'],
  overdue: ['Overdue', 'danger', 'alert'],
  lost: ['Lost', 'dark', 'xCircle'],
  maintenance: ['Maintenance', 'muted', 'settings'],
  archived: ['Archived', 'muted', 'archive'],
  soon: ['Due soon', 'warn', 'clock'],
  ok: ['On loan', 'info', 'book'],
  returned: ['Returned', 'muted', 'check'],
  active: ['Active', 'good', 'checkCircle'],
  suspended: ['Suspended', 'danger', 'xCircle'],
  allowed: ['Exit allowed', 'good', 'unlock'],
  alarm: ['Alarm', 'danger', 'alert'],
  unknown: ['Unknown tag', 'danger', 'alert'],
  verified: ['Verified', 'good', 'checkCircle'],
  failed: ['Failed', 'danger', 'xCircle'],
  manual: ['Manual check', 'warn', 'user'],
  online: ['Online', 'good', 'checkCircle'],
  offline: ['Offline', 'danger', 'xCircle'],
}

export function Badge({ status, children }) {
  const [label, tone, icon] = STATUS[status] ?? [status, 'muted', 'tag']
  return (
    <span className={`badge badge-${tone}`}>
      <Icon name={icon} size={12} strokeWidth={2.2} />
      {children ?? label}
    </span>
  )
}

// ---------- Book covers ----------
function Motif({ motif }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, opacity: 0.55 }
  switch (motif) {
    case 'circuit':
      return <g {...common}><path d="M10 110h30l10-10h30M80 100v-20h20M20 130h40l10 10h40M60 90v-15h-20" /><circle cx="100" cy="80" r="3" /><circle cx="110" cy="140" r="3" /><circle cx="40" cy="75" r="3" /></g>
    case 'rings':
      return <g {...common}><circle cx="60" cy="110" r="18" /><circle cx="60" cy="110" r="32" /><circle cx="60" cy="110" r="46" /></g>
    case 'grid':
      return <g {...common}><path d="M15 80h90M15 95h90M15 110h90M15 125h90M15 140h90M30 70v80M50 70v80M70 70v80M90 70v80" /></g>
    case 'type':
      return <g fill="currentColor" opacity="0.5" fontFamily="Consolas, monospace" fontSize="14"><text x="16" y="100">{'{ }'}</text><text x="16" y="122">{'int main()'}</text><text x="16" y="144">{'return 0;'}</text></g>
    case 'wave':
      return <g {...common}><path d="M10 100q15-20 30 0t30 0 30 0 30 0M10 118q15-20 30 0t30 0 30 0 30 0M10 136q15-20 30 0t30 0 30 0 30 0" /></g>
    case 'curve':
      return <g {...common}><path d="M15 150C40 150 45 80 70 80s40 60 45 70M15 150h100M15 70v80" /></g>
    case 'dino':
      return <g {...common}><path d="M20 140h80l-10-25-15 5-10-30-20 15-10-10z" /></g>
    default:
      return <g {...common}><path d="M10 85h100M10 92h100M10 140h100" /></g>
  }
}

export function Cover({ title, className = '' }) {
  if (title.cover?.image) return <img className={`cover cover-img ${className}`} src={title.cover.image} alt={`Cover of ${title.title}`} />
  return (
    <svg className={`cover ${className}`} viewBox="0 0 120 170" role="img" aria-label={`Cover of ${title.title}`} style={{ color: '#fff' }}>
      <rect width="120" height="170" fill={title.cover?.color ?? '#1f765d'} />
      <rect width="7" height="170" fill="#000" opacity="0.18" />
      <Motif motif={title.cover?.motif} />
      <foreignObject x="13" y="12" width="100" height="62">
        <div className="cover-title">{title.title}</div>
      </foreignObject>
      <text x="14" y="160" fill="#fff" opacity="0.8" fontSize="7.5" fontFamily="Segoe UI, Arial, sans-serif">{title.author.length > 28 ? `${title.author.slice(0, 27)}…` : title.author}</text>
    </svg>
  )
}

/** A book with real depth: cover, spine, page block. Tilts toward the pointer. */
export function Book3D({ title, size = 'md', badge = null, onClick, float = false }) {
  const ref = useRef(null)
  const onMove = (e) => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--ry', `${-28 + x * 34}deg`)
    el.style.setProperty('--rx', `${y * -14}deg`)
  }
  const reset = () => {
    ref.current?.style.removeProperty('--ry')
    ref.current?.style.removeProperty('--rx')
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={`book3d book3d-${size}${float ? ' book3d-float' : ''}`} ref={ref} onPointerMove={onMove} onPointerLeave={reset} onClick={onClick} aria-label={onClick ? `Open ${title.title}` : undefined}>
      <div className="book3d-inner">
        <div className="book3d-front"><Cover title={title} /></div>
        <div className="book3d-spine" style={{ background: title.cover?.color }}><span>{title.title}</span></div>
        <div className="book3d-pages" />
        <div className="book3d-back" style={{ background: title.cover?.color }} />
      </div>
      <div className="book3d-shadow" />
      {badge && <div className="book3d-badge">{badge}</div>}
    </Tag>
  )
}

/** Generic pointer-tilt wrapper for 3D cards. */
export function Tilt({ children, className = '', max = 10 }) {
  const ref = useRef(null)
  const onMove = (e) => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(900px) rotateY(${x * max}deg) rotateX(${-y * max}deg) translateZ(0)`
    el.style.setProperty('--glare-x', `${(x + 0.5) * 100}%`)
    el.style.setProperty('--glare-y', `${(y + 0.5) * 100}%`)
  }
  const reset = () => {
    if (ref.current) ref.current.style.transform = ''
  }
  return <div ref={ref} className={`tilt ${className}`} onPointerMove={onMove} onPointerLeave={reset}>{children}</div>
}

// ---------- People ----------
const AVATAR_COLORS = ['#1f765d', '#527087', '#a8741a', '#6b4e71', '#397d68', '#8a5a44']
export function Avatar({ student, size = 40 }) {
  if (!student) return <span className="avatar" style={{ width: size, height: size }}><Icon name="user" size={size * 0.5} /></span>
  if (student.photo) return <img className="avatar" src={student.photo} alt="" style={{ width: size, height: size }} />
  const initials = student.name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('')
  const color = AVATAR_COLORS[Number(student.id.replace(/\D/g, '')) % AVATAR_COLORS.length]
  return <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }} aria-hidden="true">{initials}</span>
}

// ---------- Layout bits ----------
export function PageHeader({ eyebrow, title, children }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  )
}

export function Panel({ title, sub, actions, children, className = '', flush = false }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className={flush ? 'panel-body flush' : 'panel-body'}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, note, tone, icon, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={`stat${tone ? ` stat-${tone}` : ''}`} onClick={onClick}>
      <span className="stat-label">{icon && <Icon name={icon} size={15} />}{label}</span>
      <strong className="stat-value">{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </Tag>
  )
}

export function Empty({ icon = 'book', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Toasts() {
  const [items, setItems] = useState([])
  useEffect(() => bus.on('toast', (t) => {
    setItems((list) => [t, ...list].slice(0, 4))
    setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), t.tone === 'danger' ? 7000 : 4500)
  }), [])
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <Icon name={t.tone === 'danger' ? 'alert' : t.tone === 'good' ? 'checkCircle' : t.tone === 'warn' ? 'alert' : 'bell'} />
          <div><strong>{t.title}</strong>{t.body && <p>{t.body}</p>}</div>
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  )
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/** Read an uploaded image and downscale it so it fits in local storage. */
export function readImage(file, maxW = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
