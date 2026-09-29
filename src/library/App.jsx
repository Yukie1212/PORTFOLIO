import { useEffect, useRef, useState } from 'react'
import Simulator from './components/Simulator.jsx'
import { Avatar, Icon, Toasts } from './components/ui.jsx'
import { toast } from './lib/bus.js'
import { runScheduler } from './lib/services.js'
import { now, store, useStore } from './lib/store.js'
import { fmtShortDateTime } from './lib/time.js'
import { ActivityLogs, Devices, Notifications, Reports, Settings } from './pages/Admin.jsx'
import Books, { BookDetail } from './pages/Books.jsx'
import { Borrowing, Overdue, Returns } from './pages/Circulation.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { Gate, SecurityEvents } from './pages/Security.jsx'
import { StudentBooks, StudentHistory, StudentHome, StudentLibrary, StudentNotifications, StudentProfile } from './pages/Student.jsx'
import Students, { StudentDetail } from './pages/Students.jsx'

const SESSION_KEY = 'smart-library-session'
const readSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}
const writeSession = (v) => {
  try { if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v)); else localStorage.removeItem(SESSION_KEY) } catch { /* storage blocked */ }
}

const ADMIN_NAV = [
  ['dashboard', 'Dashboard', 'dashboard'], ['books', 'Books', 'books'], ['students', 'Students', 'users'],
  ['borrowing', 'Borrowing', 'borrow'], ['returns', 'Returns', 'return'], ['overdue', 'Overdue', 'clock'],
  ['gate', 'RFID Gate', 'gate'], ['security', 'Security Events', 'shield'], ['notifications', 'Notifications', 'bell'],
  ['reports', 'Reports', 'report'], ['devices', 'Devices', 'device'], ['logs', 'Activity Logs', 'log'], ['settings', 'Settings', 'settings'],
]
const STUDENT_NAV = [
  ['home', 'Home', 'home'], ['library', 'Library', 'search'], ['mybooks', 'My Books', 'book'],
  ['history', 'History', 'history'], ['notifications', 'Notifications', 'bell'], ['profile', 'My Profile', 'user'],
]

function useRoute() {
  const parse = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

function SignIn({ onSignIn }) {
  const s = useStore()
  const [role, setRole] = useState('librarian')
  const [studentId, setStudentId] = useState('s1')
  const [email, setEmail] = useState('librarian@school.edu.ph')
  const [password, setPassword] = useState('library-demo')
  const [error, setError] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (role === 'librarian' && (email.trim() !== 'librarian@school.edu.ph' || password !== 'library-demo')) { setError('Use the demo credentials shown below.'); return }
    onSignIn(role === 'librarian' ? { role } : { role, studentId })
  }
  return (
    <div className="signin">
      <div className="signin-books" aria-hidden="true">
        {['#1f5f4b', '#27425a', '#7a3b2e', '#397d68', '#2d2f33', '#8a5a12', '#1f765d', '#5b4a8a', '#527087', '#35524a', '#6b2f3a'].map((c, i) => (
          <span key={c} style={{ background: c, width: 26 + ((i * 7) % 22), height: 130 + ((i * 37) % 110), transform: `rotateX(8deg) rotateZ(${i === 4 ? -8 : i === 8 ? 6 : 0}deg)` }} />
        ))}
      </div>
      <form className="signin-card" onSubmit={submit}>
        <p className="eyebrow">Smart library · Demo</p>
        <h1>Sign in</h1>
        <p className="muted">RFID lending, turnstile security, reminders and facial verification. Sample data only, stored in your browser.</p>
        <div className="role-pick" role="radiogroup" aria-label="Role">
          <button type="button" role="radio" aria-checked={role === 'librarian'} className={role === 'librarian' ? 'on' : ''} onClick={() => setRole('librarian')}><Icon name="shield" /><strong>Librarian</strong><span>Dashboard, stations, gate</span></button>
          <button type="button" role="radio" aria-checked={role === 'student'} className={role === 'student' ? 'on' : ''} onClick={() => setRole('student')}><Icon name="user" /><strong>Student</strong><span>My books, library, alerts</span></button>
        </div>
        {role === 'librarian' ? (
          <>
            <label className="field"><span className="field-label">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
            <label className="field"><span className="field-label">Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
            <p className="muted small">Demo: librarian@school.edu.ph / library-demo</p>
          </>
        ) : (
          <label className="field"><span className="field-label">Sign in as</span>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>{s.students.map((st) => <option key={st.id} value={st.id}>{st.name} · {st.studentId}</option>)}</select>
          </label>
        )}
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg">Continue</button>
        <a className="link-btn" href="./">← Back to portfolio</a>
      </form>
    </div>
  )
}

function AdminLayout({ route, go, onSignOut }) {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const [page, id] = route
  const unread = s.notifications.filter((n) => n.audience === 'librarian' && !n.read).length
  const alarms = s.gateEvents.filter((g) => g.result !== 'allowed' && !g.resolved).length
  const pendingRenewals = (s.renewalRequests ?? []).filter((r) => r.status === 'pending')
  const seenRenewals = useRef(null)
  useEffect(() => {
    const ids = pendingRenewals.map((r) => r.id)
    if (seenRenewals.current) {
      const fresh = pendingRenewals.filter((r) => !seenRenewals.current.includes(r.id))
      fresh.forEach((r) => {
        const student = s.students.find((x) => x.id === r.studentId)
        const title = s.titles.find((x) => x.id === s.copies.find((c) => c.id === r.copyId)?.titleId)
        toast('info', 'New renewal request', `${student?.name} wants to renew '${title?.title}'. Review it on the dashboard.`)
      })
    }
    seenRenewals.current = ids
  })
  const content = {
    dashboard: <Dashboard go={go} />,
    books: id ? <BookDetail id={id} go={go} /> : <Books go={go} />,
    students: id ? <StudentDetail id={id} go={go} /> : <Students go={go} />,
    borrowing: <Borrowing />, returns: <Returns />, overdue: <Overdue />,
    gate: <Gate />, security: <SecurityEvents />, notifications: <Notifications />,
    reports: <Reports />, devices: <Devices />, logs: <ActivityLogs />, settings: <Settings />,
  }[page] ?? <Dashboard go={go} />
  return (
    <div className={`admin${open ? ' nav-open' : ''}`}>
      <aside className="sidebar">
        <a className="brand" href="#/admin/dashboard"><span className="brand-mark"><Icon name="book" size={18} /></span>Smart Library</a>
        <nav aria-label="Librarian navigation">
          {ADMIN_NAV.map(([key, label, icon]) => (
            <a key={key} href={`#/admin/${key}`} className={page === key || (!page && key === 'dashboard') ? 'on' : ''} onClick={() => setOpen(false)}>
              <Icon name={icon} size={18} /><span>{label}</span>
              {key === 'security' && alarms > 0 && <em className="nav-count danger">{alarms}</em>}
              {key === 'dashboard' && pendingRenewals.length > 0 && <em className="nav-count" title="Renewal requests">{pendingRenewals.length}</em>}
              {key === 'notifications' && unread > 0 && <em className="nav-count">{unread}</em>}
            </a>
          ))}
        </nav>
        <p className="sidebar-foot">Demo data only. Nothing leaves your browser.</p>
      </aside>
      <div className="nav-scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label="Menu"><Icon name="menu" /></button>
          <span className="clock-chip mono" title="Demo clock">{fmtShortDateTime(now())}{s.clockOffset ? ' · fast-forwarded' : ''}</span>
          <div className="topbar-end">
            <a href="#/admin/notifications" className="icon-btn bell" aria-label={`${unread} unread notifications`}><Icon name="bell" />{unread > 0 && <em>{unread > 99 ? '99+' : unread}</em>}</a>
            <span className="who-chip"><span className="avatar avatar-lib">LB</span><span className="hide-sm">Librarian</span></span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onSignOut}><Icon name="logout" size={15} /><span className="hide-sm">Sign out</span></button>
          </div>
        </header>
        <main id="main">{content}</main>
      </div>
      {(() => {
        const target = page === 'returns' ? 'RETURN-01' : page === 'gate' || page === 'security' ? 'EXIT-01' : 'BORROW-01'
        return <Simulator key={target} defaultTarget={target} />
      })()}
    </div>
  )
}

function StudentLayout({ route, go, me, onSignOut }) {
  const s = useStore()
  const [page, id] = route
  const unread = s.notifications.filter((n) => n.audience === 'student' && n.studentId === me.id && !n.read).length
  const content = {
    home: <StudentHome me={me} go={go} />, library: <StudentLibrary me={me} go={go} openId={id} />, mybooks: <StudentBooks me={me} go={go} />,
    history: <StudentHistory me={me} />, notifications: <StudentNotifications me={me} />, profile: <StudentProfile me={me} />,
  }[page] ?? <StudentHome me={me} go={go} />
  return (
    <div className="student">
      <aside className="s-rail">
        <a className="s-brand" href="#/student/home"><span className="brand-mark"><Icon name="book" size={18} /></span><span>Smart Library</span></a>
        <nav aria-label="Student navigation">
          {STUDENT_NAV.map(([key, label, icon]) => (
            <a key={key} href={`#/student/${key}`} className={page === key || (!page && key === 'home') ? 'on' : ''}>
              <span className="s-nav-icon"><Icon name={icon} size={20} />{key === 'notifications' && unread > 0 && <em>{unread}</em>}</span><span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="s-me">
          <Avatar student={me} size={36} />
          <div><strong>{me.name}</strong><span className="mono small">{me.studentId}</span></div>
          <button type="button" className="icon-btn" onClick={onSignOut} aria-label="Sign out"><Icon name="logout" size={16} /></button>
        </div>
      </aside>
      <main id="main" className="s-main">
        <div className="s-topbar">
          <a className="s-brand" href="#/student/home"><span className="brand-mark"><Icon name="book" size={16} /></span>Smart Library</a>
          <button type="button" className="icon-btn" onClick={onSignOut} aria-label="Sign out"><Icon name="logout" size={18} /></button>
        </div>
        {content}
      </main>
    </div>
  )
}

export default function App() {
  const s = useStore()
  const route = useRoute()
  const [session, setSession] = useState(readSession)

  useEffect(() => {
    runScheduler(store.takeFresh())
    const timer = setInterval(() => runScheduler(), 15000)
    return () => clearInterval(timer)
  }, [])

  const go = (path) => { location.hash = `#/${session?.role === 'student' ? 'student' : 'admin'}/${path}` }
  const signIn = (v) => {
    writeSession(v)
    setSession(v)
    location.hash = v.role === 'student' ? '#/student/home' : '#/admin/dashboard'
  }
  const signOut = () => { writeSession(null); setSession(null); location.hash = '' }

  let body
  if (!session) body = <SignIn onSignIn={signIn} />
  else if (session.role === 'student') {
    const me = s.students.find((st) => st.id === session.studentId)
    // Role guard: students never render librarian pages.
    if (!me) body = <SignIn onSignIn={signIn} />
    else body = <StudentLayout route={route[0] === 'student' ? route.slice(1) : []} go={go} me={me} onSignOut={signOut} />
  } else {
    body = <AdminLayout route={route[0] === 'admin' ? route.slice(1) : []} go={go} onSignOut={signOut} />
  }
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {body}
      <Toasts />
    </>
  )
}
