import { useMemo, useState } from 'react'
import { Avatar, Badge, Book3D, Empty, Icon, Modal, Tilt } from '../components/ui.jsx'
import { toast } from '../lib/bus.js'
import { renewProblems, services, webAction, writeLog } from '../lib/services.js'
import { activeTxForStudent, categoryName, now, titleAvailability, useStore } from '../lib/store.js'
import { DAY, dueLabel, fmtDate, fmtShortDate, fmtShortDateTime, fmtTime } from '../lib/time.js'

function CountdownRing({ tx, t }) {
  const total = tx.dueAt - tx.borrowedAt
  const left = Math.max(0, tx.dueAt - t)
  const pct = t > tx.dueAt ? 1 : 1 - left / total
  const d = dueLabel(tx.dueAt, t)
  const r = 26
  const c = 2 * Math.PI * r
  const days = t > tx.dueAt ? Math.floor((t - tx.dueAt) / DAY) : Math.ceil(left / DAY)
  return (
    <div className={`ring ring-${d.tone}`} title={d.text}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className="ring-track" />
        <circle cx="32" cy="32" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="ring-num">{days}<small>{t > tx.dueAt ? 'late' : days === 1 ? 'day' : 'days'}</small></span>
    </div>
  )
}

function Shelf({ loans, s, t, go }) {
  return (
    <div className="shelf-scene">
      <div className="shelf">
        <div className="shelf-books">
          {loans.length === 0 && <p className="shelf-empty">Your shelf is empty. Find something good in the library!</p>}
          {loans.map((tx) => {
            const copy = s.copies.find((c) => c.id === tx.copyId)
            const title = s.titles.find((x) => x.id === copy.titleId)
            const d = dueLabel(tx.dueAt, t)
            return <Book3D key={tx.id} title={title} size="md" onClick={() => go('mybooks')} badge={<span className={`pill pill-${d.tone}`}>{d.text}</span>} />
          })}
        </div>
        <div className="shelf-board" />
      </div>
    </div>
  )
}

export function StudentHome({ me, go }) {
  const s = useStore()
  const t = now()
  const loans = activeTxForStudent(s, me.id).sort((a, b) => a.dueAt - b.dueAt)
  const history = s.transactions.filter((tx) => tx.studentId === me.id && tx.returnedAt)
  const soon = loans.filter((tx) => tx.dueAt - t < 2 * DAY)
  const notes = s.notifications.filter((n) => n.audience === 'student' && n.studentId === me.id).slice(0, 3)
  const popular = useMemo(() => {
    const counts = new Map()
    s.transactions.forEach((tx) => { const id = s.copies.find((c) => c.id === tx.copyId).titleId; counts.set(id, (counts.get(id) ?? 0) + 1) })
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => s.titles.find((x) => x.id === id)).filter((x) => x && !x.archived && titleAvailability(s, x.id).available).slice(0, 6)
  }, [s])
  const hour = new Date(t).getHours()
  return (
    <div className="s-page">
      <section className="s-hero">
        <div>
          <p className="s-eyebrow">{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}</p>
          <h1>Hi, {me.name.split(' ')[0]}!</h1>
          <p>{loans.length ? `You have ${loans.length} book${loans.length === 1 ? '' : 's'} on your shelf${soon.length ? ` · ${soon.length} due soon` : ''}.` : 'No books borrowed right now.'}</p>
          <div className="s-stats">
            <Tilt className="s-stat"><strong>{loans.length}</strong><span>Borrowed</span></Tilt>
            <Tilt className="s-stat"><strong>{soon.length}</strong><span>Due soon</span></Tilt>
            <Tilt className="s-stat"><strong>{history.length}</strong><span>Books read</span></Tilt>
          </div>
        </div>
        <Shelf loans={loans} s={s} t={t} go={go} />
      </section>

      {soon.length > 0 && (
        <button type="button" className="s-alert" onClick={() => go('mybooks')}>
          <Icon name="clock" /><span><strong>{s.titles.find((x) => x.id === s.copies.find((c) => c.id === soon[0].copyId).titleId).title}</strong> · {dueLabel(soon[0].dueAt, t).text}</span><Icon name="chevron" />
        </button>
      )}

      <section className="s-section">
        <div className="s-section-head"><h2>Popular right now</h2><button type="button" className="link-btn" onClick={() => go('library')}>Browse library</button></div>
        <div className="s-carousel">
          {popular.map((ti) => (
            <div key={ti.id} className="s-carousel-item">
              <Book3D title={ti} size="md" onClick={() => go(`library/${ti.id}`)} />
              <strong>{ti.title}</strong>
              <span className="muted small">{ti.author}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="s-section">
        <div className="s-section-head"><h2>Latest updates</h2><button type="button" className="link-btn" onClick={() => go('notifications')}>See all</button></div>
        {notes.length === 0 ? <p className="muted">No notifications yet.</p> : <ul className="s-notes">{notes.map((n) => <StudentNote key={n.id} n={n} />)}</ul>}
      </section>
    </div>
  )
}

function StudentNote({ n }) {
  const icon = { reminder: 'clock', overdue: 'alert', borrowed: 'book', returned: 'return', renewed: 'refresh', reserved: 'sparkle' }[n.kind] ?? 'bell'
  return (
    <li className={`s-note s-note-${n.kind}${n.read ? '' : ' unread'}`}>
      <span className="s-note-icon"><Icon name={icon} size={18} /></span>
      <div>
        <strong>{n.title}</strong>
        <p>{n.body}</p>
        <span className="small muted">{fmtShortDateTime(n.at)} · {n.channels.map((c) => (c === 'inapp' ? 'in-app' : c)).join(', ')}</span>
      </div>
    </li>
  )
}

export function StudentLibrary({ me, go, openId }) {
  const s = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const list = s.titles.filter((ti) => {
    if (ti.archived) return false
    if (cat && ti.category !== cat) return false
    if (onlyAvailable && !titleAvailability(s, ti.id).available) return false
    const needle = q.trim().toLowerCase()
    return !needle || ti.title.toLowerCase().includes(needle) || ti.author.toLowerCase().includes(needle)
  })
  const open = openId && s.titles.find((x) => x.id === openId)
  return (
    <div className="s-page">
      <header className="s-head"><h1>Library</h1><p>Search the catalog and see what's on the shelf right now.</p></header>
      <div className="s-filters">
        <label className="s-search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or author" aria-label="Search by title or author" /></label>
        <div className="s-chips">
          <button type="button" className={!cat ? 'on' : ''} onClick={() => setCat('')}>All</button>
          {s.categories.map((c) => <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.name}</button>)}
        </div>
        <label className="s-toggle"><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /><span />Available now</label>
      </div>
      {list.length === 0 ? <Empty title="No books found">Try another search.</Empty> : (
        <div className="s-grid">
          {list.map((ti) => {
            const a = titleAvailability(s, ti.id)
            return (
              <div key={ti.id} className="s-book">
                <Book3D title={ti} size="md" onClick={() => go(`library/${ti.id}`)} />
                <strong>{ti.title}</strong>
                <span className="muted small">{ti.author}</span>
                {a.available ? <Badge status="available">{a.available} on shelf</Badge> : <Badge status="borrowed">All out</Badge>}
              </div>
            )
          })}
        </div>
      )}
      {open && <BookModal me={me} title={open} onClose={() => go('library')} />}
    </div>
  )
}

function BookModal({ me, title, onClose }) {
  const s = useStore()
  const a = titleAvailability(s, title.id)
  const reserved = s.reservations.find((r) => r.titleId === title.id && r.studentId === me.id)
  const shelf = a.copies.find((c) => c.status === 'available')?.shelf
  const t = now()
  const nextDue = s.transactions.filter((tx) => tx.returnedAt == null && a.copies.some((c) => c.id === tx.copyId)).sort((x, y) => x.dueAt - y.dueAt)[0]
  const reserve = () => {
    webAction((st) => {
      st.reservations.push({ id: `rs_${Date.now().toString(36)}`, titleId: title.id, studentId: me.id, createdAt: now() })
      writeLog(st, { user: me.name, action: 'Book reserved', studentId: me.id, copyId: a.copies[0]?.id, result: title.title })
    })
    toast('good', 'Reserved!', 'We will notify you when a copy is returned.')
  }
  return (
    <Modal title={title.title} onClose={onClose} wide>
      <div className="s-detail">
        <Book3D title={title} size="xl" float />
        <div>
          <p className="s-eyebrow">{categoryName(s, title.category)}</p>
          <h2 className="s-detail-title">{title.title}</h2>
          <p className="lead">{title.author} · {title.publisher}, {title.year}</p>
          <p>{title.description}</p>
          {a.available ? (
            <div className="s-callout s-callout-good"><Icon name="checkCircle" /><div><strong>Available now</strong><span>{a.available} of {a.total} copies · Shelf {shelf}. Take it to the borrowing station and tap your school ID.</span></div></div>
          ) : (
            <div className="s-callout"><Icon name="clock" /><div><strong>All copies are out</strong><span>{nextDue ? `The next copy is due back ${fmtShortDate(nextDue.dueAt)}${t > nextDue.dueAt ? ' (overdue)' : ''}.` : 'Check back soon.'}</span></div></div>
          )}
          {!a.available && (reserved ? <Badge status="reserved">You reserved this</Badge> : <button type="button" className="s-btn" onClick={reserve}><Icon name="sparkle" />Reserve a copy</button>)}
        </div>
      </div>
    </Modal>
  )
}

export function StudentBooks({ me }) {
  const s = useStore()
  const t = now()
  const [problems, setProblems] = useState({})
  const loans = activeTxForStudent(s, me.id).sort((a, b) => a.dueAt - b.dueAt)
  const renew = (tx) => {
    const r = webAction((st) => services.renew(st, { txId: tx.id, user: me.name }))
    if (r.status === 200) { toast('good', 'Renewed!', `New due date: ${fmtDate(r.body.transaction.dueAt)} at ${fmtTime(r.body.transaction.dueAt)}`); setProblems({}) }
    else setProblems({ [tx.id]: r.body.problems })
  }
  return (
    <div className="s-page">
      <header className="s-head"><h1>My books</h1><p>Everything you have borrowed right now, with live countdowns.</p></header>
      {loans.length === 0 ? <Empty title="No borrowed books">Visit the library and tap your ID at the borrowing station.</Empty> : (
        <div className="s-loans">
          {loans.map((tx) => {
            const copy = s.copies.find((c) => c.id === tx.copyId)
            const title = s.titles.find((x) => x.id === copy.titleId)
            const d = dueLabel(tx.dueAt, t)
            const blockers = renewProblems(s, tx)
            return (
              <Tilt key={tx.id} className={`s-loan s-loan-${d.tone}`} max={6}>
                <Book3D title={title} size="md" />
                <div className="s-loan-body">
                  <span className={`pill pill-${d.tone}`}>{d.tone === 'overdue' ? 'Overdue' : d.tone === 'soon' ? 'Due soon' : 'Borrowed'}</span>
                  <h3>{title.title}</h3>
                  <p className="muted">{title.author}</p>
                  <dl>
                    <div><dt>Borrowed</dt><dd>{fmtShortDateTime(tx.borrowedAt)}</dd></div>
                    <div><dt>Due</dt><dd>{fmtShortDateTime(tx.dueAt)}</dd></div>
                  </dl>
                  <p className={`countdown countdown-${d.tone}`}>{d.text}</p>
                  <button type="button" className="s-btn s-btn-sm" onClick={() => renew(tx)} disabled={blockers.length > 0} title={blockers[0] ?? 'Renew'}><Icon name="refresh" size={16} />Renew{tx.renewals ? ` (${tx.renewals}/${s.settings.renewalLimit})` : ''}</button>
                  {(problems[tx.id] ?? (blockers.length ? [blockers[0]] : [])).map((p) => <p key={p} className="small muted">{p}</p>)}
                </div>
                <CountdownRing tx={tx} t={t} />
              </Tilt>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function StudentHistory({ me }) {
  const s = useStore()
  const rows = s.transactions.filter((tx) => tx.studentId === me.id && tx.returnedAt).sort((a, b) => b.returnedAt - a.returnedAt)
  return (
    <div className="s-page">
      <header className="s-head"><h1>Borrowing history</h1><p>{rows.length} book{rows.length === 1 ? '' : 's'} read and returned.</p></header>
      {rows.length === 0 ? <Empty title="No history yet" /> : (
        <ol className="s-timeline">
          {rows.map((tx) => {
            const copy = s.copies.find((c) => c.id === tx.copyId)
            const title = s.titles.find((x) => x.id === copy.titleId)
            return (
              <li key={tx.id}>
                <Book3D title={title} size="sm" />
                <div>
                  <strong>{title.title}</strong>
                  <span className="muted small">{fmtShortDate(tx.borrowedAt)} → {fmtShortDate(tx.returnedAt)}</span>
                </div>
                {tx.lateReturn ? <Badge status="overdue">Returned late</Badge> : <Badge status="available">On time</Badge>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export function StudentNotifications({ me }) {
  const s = useStore()
  const list = s.notifications.filter((n) => n.audience === 'student' && n.studentId === me.id)
  return (
    <div className="s-page">
      <header className="s-head">
        <h1>Notifications</h1><p>Due-date reminders, overdue notices and confirmations.</p>
        {list.some((n) => !n.read) && <button type="button" className="link-btn" onClick={() => webAction((st) => st.notifications.forEach((n) => { if (n.studentId === me.id) n.read = true }))}>Mark all as read</button>}
      </header>
      {list.length === 0 ? <Empty title="You're all caught up" icon="bell" /> : <ul className="s-notes">{list.map((n) => <StudentNote key={n.id} n={n} />)}</ul>}
    </div>
  )
}

export function StudentProfile({ me }) {
  const s = useStore()
  const [flipped, setFlipped] = useState(false)
  return (
    <div className="s-page">
      <header className="s-head"><h1>My profile</h1><p>Your RFID school ID is your library card. Tap the card to flip it.</p></header>
      <div className="s-profile">
        <button type="button" className={`idcard${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label="Flip school ID card">
          <div className="idcard-inner">
            <div className="idcard-front">
              <div className="idcard-top"><Icon name="book" size={18} /><span>University Library</span></div>
              <div className="idcard-main">
                <Avatar student={me} size={86} />
                <div>
                  <strong>{me.name}</strong>
                  <span className="mono">{me.studentId}</span>
                  <span>{me.program}</span>
                  <span>Year {me.year}</span>
                </div>
              </div>
              <div className="idcard-holo" />
            </div>
            <div className="idcard-back">
              <div className="idcard-chip"><span /><span /><span /><span /></div>
              <div className="idcard-coil" />
              <span className="mono idcard-uid">RFID {me.rfid}</span>
              <div className="idcard-barcode">{Array.from({ length: 38 }, (_, i) => <span key={i} style={{ width: (i * 7) % 3 + 1 }} />)}</div>
              <span className="small">If found, please return to the University Library.</span>
            </div>
          </div>
        </button>
        <div className="s-profile-info">
          <dl>
            <div><dt>Email</dt><dd>{me.email}</dd></div>
            <div><dt>Phone</dt><dd>{me.phone}</dd></div>
            <div><dt>Account</dt><dd><Badge status={me.status} /></dd></div>
            <div><dt>Borrowing limit</dt><dd>{activeTxForStudent(s, me.id).length} of {s.settings.maxBooks} books</dd></div>
            <div><dt>Face verification</dt><dd>{me.face ? <Badge status="verified">Enrolled</Badge> : <Badge status="manual">Librarian check</Badge>}</dd></div>
          </dl>
          <p className="small muted">Your face data is stored only as an encrypted template that librarians can't view as a photo. Ask the library to delete it at any time.</p>
        </div>
      </div>
    </div>
  )
}
