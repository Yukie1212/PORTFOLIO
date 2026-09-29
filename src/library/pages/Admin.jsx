import { useMemo, useState } from 'react'
import { Badge, Empty, Field, Icon, PageHeader, Panel, Segmented } from '../components/ui.jsx'
import { toast } from '../lib/bus.js'
import { API_DOCS, api, runScheduler, webAction, writeLog } from '../lib/services.js'
import { categoryName, copyStatus, now, store, txView, useStore } from '../lib/store.js'
import { DAY, fmtDate, fmtDay, fmtShortDate, fmtShortDateTime, fmtTime, startOfDay } from '../lib/time.js'

// ---------- Notifications ----------
export function Notifications() {
  const s = useStore()
  const [tab, setTab] = useState('alerts')
  const [kind, setKind] = useState('')
  const alerts = s.notifications.filter((n) => n.audience === 'librarian' && (!kind || n.kind === kind))
  const unread = s.notifications.filter((n) => n.audience === 'librarian' && !n.read).length
  const markAll = () => webAction((st) => st.notifications.forEach((n) => { if (n.audience === 'librarian') n.read = true }))
  const KINDS = [['', 'All'], ['alarm', 'Gate alarms'], ['overdue', 'Overdue'], ['due-today', 'Due today'], ['face', 'Face failures'], ['suspicious', 'Suspicious scans'], ['lost', 'Lost books'], ['account', 'Accounts']]
  return (
    <div className="page">
      <PageHeader eyebrow="09 / Alerts" title="Notification center">
        <Segmented label="View" value={tab} onChange={setTab} options={[['alerts', `Librarian alerts${unread ? ` (${unread})` : ''}`], ['outbox', 'Sent to students']]} />
      </PageHeader>
      {tab === 'alerts' ? (
        <>
          <div className="filters">
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Alert type">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <button type="button" className="btn btn-ghost" onClick={markAll}><Icon name="check" />Mark all as read</button>
          </div>
          {alerts.length === 0 ? <Empty title="No alerts" icon="bell" /> : (
            <ul className="notif-list">
              {alerts.slice(0, 80).map((n) => (
                <li key={n.id} className={`notif notif-${n.kind}${n.read ? '' : ' unread'}`}>
                  <span className="notif-icon"><Icon name={n.kind === 'alarm' ? 'alert' : n.kind === 'face' ? 'face' : n.kind === 'overdue' ? 'clock' : n.kind === 'suspicious' ? 'tag' : 'bell'} size={16} /></span>
                  <div><strong>{n.title}</strong><p>{n.body}</p><span className="mono small">{fmtShortDateTime(n.at)}</span></div>
                  {!n.read && <button type="button" className="link-btn" onClick={() => webAction((st) => { st.notifications.find((x) => x.id === n.id).read = true })}>Mark read</button>}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Panel title="Outgoing reminders" sub="Delivery log from the email and SMS providers (simulated in this demo)" flush>
          {s.notificationLogs.length === 0 ? <Empty title="Nothing sent yet" icon="mail">Move the demo clock forward to trigger scheduled reminders.</Empty> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Sent</th><th>Student</th><th>Channel</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
              <tbody>{s.notificationLogs.slice(0, 100).map((l) => {
                const st = s.students.find((x) => x.id === l.studentId)
                const n = s.notifications.find((x) => x.id === l.notificationId)
                return <tr key={l.id}><td>{fmtShortDateTime(l.at)}</td><td>{st?.name}</td><td><Icon name={l.channel === 'email' ? 'mail' : 'sms'} size={14} /> {l.channel.toUpperCase()}</td><td className="small">{l.to}</td><td className="small">{n?.title}</td><td><Badge status="available">{l.status}</Badge></td></tr>
              })}</tbody>
            </table></div>
          )}
        </Panel>
      )}
    </div>
  )
}

// ---------- Reports ----------
const REPORTS = [
  ['current', 'Currently borrowed books'], ['overdue', 'Overdue books'], ['history', 'Borrowing history (90 days)'], ['student', 'Student borrowing history'],
  ['popular', 'Most borrowed books'], ['security', 'RFID security events'], ['face', 'Failed facial verification'], ['usage', 'Library usage (30 days)'],
  ['inventory', 'Inventory'], ['lost', 'Missing / lost books'],
]

function buildReport(s, type, studentId) {
  const t = now()
  const loanRow = (tx) => { const v = txView(s, tx); return [v.title.title, v.copy.rfid, v.student.name, v.student.studentId, fmtShortDateTime(tx.borrowedAt), fmtShortDateTime(tx.dueAt), tx.returnedAt ? fmtShortDateTime(tx.returnedAt) : '', tx.returnedAt ? (tx.lateReturn ? 'Returned late' : 'Returned') : t > tx.dueAt ? 'Overdue' : 'Borrowed'] }
  const loanCols = ['Book', 'RFID', 'Student', 'Student ID', 'Borrowed', 'Due', 'Returned', 'Status']
  switch (type) {
    case 'current': return { columns: loanCols, rows: s.transactions.filter((tx) => !tx.returnedAt).map(loanRow) }
    case 'overdue': return { columns: loanCols, rows: s.transactions.filter((tx) => !tx.returnedAt && t > tx.dueAt).map(loanRow) }
    case 'history': return { columns: loanCols, rows: s.transactions.filter((tx) => tx.borrowedAt > t - 90 * DAY).sort((a, b) => b.borrowedAt - a.borrowedAt).map(loanRow) }
    case 'student': return { columns: loanCols, rows: s.transactions.filter((tx) => tx.studentId === studentId).sort((a, b) => b.borrowedAt - a.borrowedAt).map(loanRow) }
    case 'popular': {
      const counts = new Map()
      s.transactions.forEach((tx) => { const id = s.copies.find((c) => c.id === tx.copyId).titleId; counts.set(id, (counts.get(id) ?? 0) + 1) })
      return { columns: ['Rank', 'Book', 'Author', 'Category', 'Loans'], rows: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n], i) => { const ti = s.titles.find((x) => x.id === id); return [i + 1, ti.title, ti.author, categoryName(s, ti.category), n] }) }
    }
    case 'security': return { columns: ['Time', 'Gate', 'RFID', 'Book', 'Reason', 'Result', 'Resolved'], rows: s.gateEvents.filter((g) => g.result !== 'allowed').map((g) => { const c = g.copyId && s.copies.find((x) => x.id === g.copyId); return [fmtShortDateTime(g.at), g.gate, g.rfid, c ? s.titles.find((x) => x.id === c.titleId).title : 'Unknown', g.reason, 'Alarm', g.resolved ? 'Yes' : 'No'] }) }
    case 'face': return { columns: ['Time', 'Student', 'Student ID', 'Context', 'Device', 'Confidence'], rows: s.faceLogs.filter((f) => f.result === 'failed').map((f) => { const st = s.students.find((x) => x.id === f.studentId); return [fmtShortDateTime(f.at), st.name, st.studentId, f.context, f.device, `${Math.round((f.confidence ?? 0) * 100)}%`] }) }
    case 'usage': return { columns: ['Date', 'Borrowed', 'Returned', 'Gate exits', 'Alarms'], rows: Array.from({ length: 30 }, (_, i) => { const d = startOfDay(t) - (29 - i) * DAY; const inDay = (x) => x >= d && x < d + DAY; return [fmtDate(d), s.transactions.filter((tx) => inDay(tx.borrowedAt)).length, s.transactions.filter((tx) => tx.returnedAt && inDay(tx.returnedAt)).length, s.gateEvents.filter((g) => g.result === 'allowed' && inDay(g.at)).length, s.gateEvents.filter((g) => g.result !== 'allowed' && inDay(g.at)).length] }) }
    case 'inventory': return { columns: ['Title', 'Copy', 'RFID', 'ISBN', 'Category', 'Shelf', 'Status'], rows: s.copies.map((c) => { const ti = s.titles.find((x) => x.id === c.titleId); return [ti.title, `#${c.copyNo}`, c.rfid, ti.isbn, categoryName(s, ti.category), c.shelf, copyStatus(s, c)] }) }
    case 'lost': return { columns: ['Title', 'Copy', 'RFID', 'Shelf', 'Status'], rows: s.copies.filter((c) => c.status === 'lost' || c.status === 'maintenance').map((c) => { const ti = s.titles.find((x) => x.id === c.titleId); return [ti.title, `#${c.copyNo}`, c.rfid, c.shelf, c.status] }) }
    default: return { columns: [], rows: [] }
  }
}

const download = (name, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function Reports() {
  const s = useStore()
  const [type, setType] = useState('current')
  const [studentId, setStudentId] = useState('s1')
  const report = useMemo(() => buildReport(s, type, studentId), [s, type, studentId])
  const label = REPORTS.find(([k]) => k === type)[1]
  const file = `library-${type}-${new Date(now()).toISOString().slice(0, 10)}`
  const csv = () => download(`${file}.csv`, [report.columns, ...report.rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  const excel = () => download(`${file}.xls`, `<html><head><meta charset="utf-8"></head><body><table><tr>${report.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${report.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table></body></html>`, 'application/vnd.ms-excel')
  const pdf = () => {
    webAction((st) => writeLog(st, { user: 'Librarian', action: 'Report exported', result: `${label} · PDF` }))
    window.print()
  }
  return (
    <div className="page">
      <PageHeader eyebrow="10 / Reports" title="Reports">
        <button type="button" className="btn" onClick={csv}><Icon name="download" />CSV</button>
        <button type="button" className="btn" onClick={excel}><Icon name="table" />Excel</button>
        <button type="button" className="btn btn-primary" onClick={pdf}><Icon name="report" />PDF</button>
      </PageHeader>
      <div className="filters">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Report">{REPORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {type === 'student' && <select value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="Student">{s.students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select>}
      </div>
      <Panel className="print-area" title={label} sub={`Generated ${fmtShortDateTime(now())} · ${report.rows.length} rows`} flush>
        {report.rows.length === 0 ? <Empty title="No rows" /> : (
          <div className="table-wrap"><table>
            <thead><tr>{report.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{report.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  )
}

// ---------- Devices & API ----------
const SCHEMA = [
  ['users', 'id, name, email, password_hash (bcrypt), role, last_login_at'],
  ['students', 'id, user_id, student_id, rfid_uid_hash, full_name, email, phone, program, year_level, photo_path, status'],
  ['librarians', 'id, user_id, employee_no, pin_hash'],
  ['book_categories', 'id, name, max_days, renewable, lendable'],
  ['books', 'id, title, author, isbn, category_id, publisher, year, description, cover_path, archived_at'],
  ['book_copies', 'id, book_id, copy_no, shelf, status'],
  ['rfid_tags', 'id, uid_hash, taggable_type, taggable_id, assigned_at'],
  ['borrow_transactions', 'id, book_copy_id, student_id, borrowed_at, due_at, status, renewals, device_id, verification'],
  ['return_transactions', 'id, borrow_transaction_id, returned_at, late, device_id, processed_by'],
  ['renewals', 'id, borrow_transaction_id, old_due_at, new_due_at, renewed_at'],
  ['reservations', 'id, book_id, student_id, created_at, fulfilled_at'],
  ['notifications', 'id, audience, student_id, kind, title, body, read_at'],
  ['notification_logs', 'id, notification_id, channel, recipient, provider, status, sent_at'],
  ['gate_events', 'id, device_id, rfid_uid, book_copy_id, student_id, result, reason, occurred_at'],
  ['security_events', 'id, gate_event_id, camera_frame_ref, resolved_by, resolution, resolved_at'],
  ['facial_verification_logs', 'id, student_id, device_id, context, result, confidence, approved_by, created_at'],
  ['face_templates', 'id, student_id, template_encrypted, enrolled_at (restricted)'],
  ['devices', 'id, code, type, location, api_key_hash, last_seen_at, status'],
  ['activity_logs', 'id, occurred_at, user, action, device_id, book_copy_id, student_id, result'],
]

export function Devices() {
  const s = useStore()
  const [doc, setDoc] = useState(0)
  const [device, setDevice] = useState('EXIT-01')
  const [body, setBody] = useState(JSON.stringify(API_DOCS[0][3], null, 2))
  const [path, setPath] = useState(API_DOCS[0][1])
  const [useKey, setUseKey] = useState(true)
  const [res, setRes] = useState(null)
  const pickDoc = (i) => {
    setDoc(i)
    const [, p, , example] = API_DOCS[i]
    setPath(p.replace('{rfid}', 'B8239CAF'))
    setBody(example ? JSON.stringify(example, null, 2) : '')
    setRes(null)
  }
  const send = () => {
    let parsed = {}
    try { parsed = body.trim() ? JSON.parse(body) : {} } catch { setRes({ status: 400, body: { error: 'Request body is not valid JSON.' } }); return }
    setRes(api.request(API_DOCS[doc][0], path, parsed, { device, key: useKey ? api.deviceKey(device) : 'invalid' }))
  }
  const rotate = (id) => {
    webAction((st) => {
      const d = st.devices.find((x) => x.id === id)
      d.key = `dev_live_${Math.random().toString(16).slice(2, 6)}`
      writeLog(st, { user: 'Librarian', action: 'Device API key rotated', device: id, result: 'Success' })
    })
    toast('good', 'API key rotated', id)
  }
  return (
    <div className="page">
      <PageHeader eyebrow="11 / Hardware" title="Devices & API" />
      <div className="device-grid">
        {s.devices.map((d) => (
          <article key={d.id} className="device">
            <div className="device-top"><span className="mono">{d.id}</span><Badge status={d.status} /></div>
            <strong>{d.name}</strong>
            <span className="muted small">{d.type}</span>
            <span className="small">{d.location} · last seen {fmtShortDateTime(d.lastSeen)}</span>
            <div className="device-key"><span className="mono small">Key ••••{d.key.slice(-4)}</span><button type="button" className="link-btn" onClick={() => rotate(d.id)}>Rotate</button></div>
          </article>
        ))}
      </div>

      <div className="grid-2">
        <Panel title="API console" sub="Hardware never writes to the database directly. Every request is authenticated, rate-limited and validated.">
          <div className="api-console">
            <div className="api-endpoints">
              {API_DOCS.map(([m, p, d], i) => (
                <button key={p} type="button" className={doc === i ? 'on' : ''} onClick={() => pickDoc(i)} title={d}>
                  <span className={`method method-${m.toLowerCase()}`}>{m}</span><span className="mono">{p}</span>
                </button>
              ))}
            </div>
            <p className="small muted">{API_DOCS[doc][2]}</p>
            <div className="form-grid two">
              <Field label="Device"><select value={device} onChange={(e) => setDevice(e.target.value)}>{s.devices.map((d) => <option key={d.id}>{d.id}</option>)}</select></Field>
              <Field label="Path"><input className="mono" value={path} onChange={(e) => setPath(e.target.value)} /></Field>
            </div>
            {API_DOCS[doc][0] === 'POST' && <Field label="JSON body"><textarea className="mono" rows={5} value={body} onChange={(e) => setBody(e.target.value)} spellCheck="false" /></Field>}
            <label className="check"><input type="checkbox" checked={useKey} onChange={(e) => setUseKey(e.target.checked)} />Send device API key (untick to see a 401)</label>
            <button type="button" className="btn btn-primary" onClick={send}><Icon name="api" />Send request</button>
            {res && <pre className={`api-res ${res.status < 300 ? 'ok' : 'err'}`}><span className="mono">HTTP {res.status}</span>{'\n'}{JSON.stringify(res.body, null, 2)}</pre>}
          </div>
        </Panel>
        <Panel title="Architecture" sub="Each module can be swapped without rewriting the others">
          <ol className="arch">
            <li><strong>Frontend</strong><span>Librarian dashboard, student portal, station and gate screens</span></li>
            <li><strong>API gateway</strong><span>Device auth (hashed keys), rate limiting, validation, audit logging</span></li>
            <li><strong>Circulation service</strong><span>Borrow, return, renew, rules, due-date engine</span></li>
            <li><strong>RFID &amp; gate service</strong><span>Tag lookup and the exit rule: active loan or alarm</span></li>
            <li><strong>Notification service</strong><span>Scheduler plus email, SMS and in-app providers</span></li>
            <li><strong>Face verification service</strong><span>Encrypted templates, confidence threshold, manual override</span></li>
            <li><strong>Database</strong><span>Single source of truth for every screen and device</span></li>
          </ol>
          <details className="schema">
            <summary><Icon name="db" size={16} />Database tables ({SCHEMA.length})</summary>
            <dl>{SCHEMA.map(([t, cols]) => <div key={t}><dt className="mono">{t}</dt><dd className="small">{cols}</dd></div>)}</dl>
          </details>
        </Panel>
      </div>
    </div>
  )
}

// ---------- Activity logs ----------
export function ActivityLogs() {
  const s = useStore()
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(60)
  const needle = q.trim().toLowerCase()
  const bookOf = (copyId) => { const c = copyId && s.copies.find((x) => x.id === copyId); return c ? s.titles.find((x) => x.id === c.titleId)?.title : '' }
  const rows = s.logs.filter((l) => !needle || [l.action, l.user, l.device, l.result, bookOf(l.copyId), s.students.find((x) => x.id === l.studentId)?.name ?? ''].some((v) => String(v).toLowerCase().includes(needle)))
  return (
    <div className="page">
      <PageHeader eyebrow="12 / Audit" title="Activity logs" />
      <div className="filters"><label className="search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by action, user, device, book or student" aria-label="Filter logs" /></label></div>
      <Panel flush sub={`${rows.length} entries`}>
        <div className="table-wrap"><table className="logs">
          <thead><tr><th>Date</th><th>Time</th><th>User</th><th>Action</th><th>Device</th><th>Book</th><th>Student</th><th>Result</th></tr></thead>
          <tbody>{rows.slice(0, limit).map((l) => (
            <tr key={l.id}><td>{fmtShortDate(l.at)}</td><td className="mono small">{fmtTime(l.at)}</td><td>{l.user}</td><td><strong>{l.action}</strong></td><td className="mono small">{l.device}</td><td>{bookOf(l.copyId)}</td><td>{s.students.find((x) => x.id === l.studentId)?.name ?? ''}</td><td className="small">{l.result}</td></tr>
          ))}</tbody>
        </table></div>
        {rows.length > limit && <div className="load-more"><button type="button" className="btn btn-ghost" onClick={() => setLimit(limit + 100)}>Load more</button></div>}
      </Panel>
    </div>
  )
}

// ---------- Settings ----------
export function Settings() {
  const s = useStore()
  const st = s.settings
  const update = (fn, what) => {
    webAction((x) => { fn(x.settings); writeLog(x, { user: 'Librarian', action: 'Settings changed', result: what }) })
  }
  const num = (v, min, max) => Math.max(min, Math.min(max, Number(v) || min))
  return (
    <div className="page">
      <PageHeader eyebrow="13 / Configuration" title="Settings" />
      <div className="grid-2">
        <Panel title="Borrowing rules">
          <div className="form-grid two">
            <Field label="Maximum borrowing days"><input type="number" min="1" max="60" value={st.maxDays} onChange={(e) => update((x) => { x.maxDays = num(e.target.value, 1, 60) }, 'Maximum borrowing days')} /></Field>
            <Field label="Maximum books per student"><input type="number" min="1" max="20" value={st.maxBooks} onChange={(e) => update((x) => { x.maxBooks = num(e.target.value, 1, 20) }, 'Maximum books')} /></Field>
            <Field label="Grace period (hours)"><input type="number" min="0" max="72" value={st.graceHours} onChange={(e) => update((x) => { x.graceHours = num(e.target.value, 0, 72) }, 'Grace period')} /></Field>
            <Field label="Renewal limit"><input type="number" min="0" max="10" value={st.renewalLimit} onChange={(e) => update((x) => { x.renewalLimit = num(e.target.value, 0, 10) }, 'Renewal limit')} /></Field>
          </div>
          <p className="field-label">Borrowing periods offered at the station</p>
          <div className="chips">
            {[1, 3, 5, 7, 14, 21, 30].map((d) => (
              <label key={d} className={`chip${st.durations.includes(d) ? ' on' : ''}`}>
                <input type="checkbox" checked={st.durations.includes(d)} onChange={(e) => update((x) => { x.durations = e.target.checked ? [...x.durations, d].sort((a, b) => a - b) : x.durations.filter((y) => y !== d) }, 'Borrowing periods')} />{d} day{d === 1 ? '' : 's'}
              </label>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={st.blockWhenOverdue} onChange={(e) => update((x) => { x.blockWhenOverdue = e.target.checked }, 'Block when overdue')} />Block borrowing while a student has an overdue book</label>
        </Panel>
        <Panel title="Rules by category" flush>
          <div className="table-wrap"><table>
            <thead><tr><th>Category</th><th>Max days</th><th>Renewable</th><th>Lendable</th></tr></thead>
            <tbody>{s.categories.map((c) => {
              const r = st.categoryRules[c.id] ?? {}
              const set = (k, v) => update((x) => { x.categoryRules[c.id] = { ...(x.categoryRules[c.id] ?? {}), [k]: v } }, `${c.name} rule`)
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><input className="input-sm" type="number" min="1" max="60" value={r.maxDays ?? st.maxDays} onChange={(e) => set('maxDays', num(e.target.value, 1, 60))} aria-label={`${c.name} max days`} /></td>
                  <td><input type="checkbox" checked={r.renewable ?? true} onChange={(e) => set('renewable', e.target.checked)} aria-label={`${c.name} renewable`} /></td>
                  <td><input type="checkbox" checked={r.lendable ?? true} onChange={(e) => set('lendable', e.target.checked)} aria-label={`${c.name} lendable`} /></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        </Panel>
        <Panel title="Reminder schedule" sub="The scheduler sends each enabled reminder once per loan">
          <div className="reminder-list">
            {st.reminders.map((r) => (
              <label key={r.id} className="check"><input type="checkbox" checked={r.enabled} onChange={(e) => update((x) => { x.reminders.find((y) => y.id === r.id).enabled = e.target.checked }, `Reminder: ${r.label}`)} />{r.label}</label>
            ))}
          </div>
          <p className="field-label">Channels</p>
          <div className="chips">
            {[['email', 'Email'], ['sms', 'SMS'], ['inapp', 'In-app']].map(([k, l]) => (
              <label key={k} className={`chip${st.channels[k] ? ' on' : ''}`}><input type="checkbox" checked={st.channels[k]} onChange={(e) => update((x) => { x.channels[k] = e.target.checked }, `Channel ${l}`)} />{l}</label>
            ))}
          </div>
          <button type="button" className="btn btn-sm" onClick={() => { runScheduler(); toast('good', 'Scheduler ran', 'Due reminders were sent.') }}><Icon name="refresh" size={15} />Run scheduler now</button>
        </Panel>
        <Panel title="Facial verification & security">
          <label className="check"><input type="checkbox" checked={st.requireFace} onChange={(e) => update((x) => { x.requireFace = e.target.checked }, 'Require face verification')} />Require identity verification when borrowing</label>
          <Field label={`Match threshold · ${Math.round(st.faceThreshold * 100)}%`} hint="Below this confidence the attempt fails and a librarian can verify manually.">
            <input type="range" min="0.6" max="0.95" step="0.01" value={st.faceThreshold} onChange={(e) => update((x) => { x.faceThreshold = Number(e.target.value) }, 'Face threshold')} />
          </Field>
          <ul className="security-list">
            <li><Icon name="shield" size={15} />Role-based access: students cannot open librarian pages</li>
            <li><Icon name="lock" size={15} />Passwords and device keys stored as hashes, never raw</li>
            <li><Icon name="api" size={15} />Device API keys, 60 requests/min rate limit, input validation</li>
            <li><Icon name="face" size={15} />Only encrypted face templates, visible to administrators only</li>
            <li><Icon name="log" size={15} />Every verification, scan and override written to the audit log</li>
          </ul>
          <p className="muted small">In production this runs on the server with CSRF tokens, parameterised queries and output escaping. The browser demo shows the rules, not the server hardening.</p>
        </Panel>
      </div>
      <p className="muted small">Demo clock: {fmtDate(now())} {fmtTime(now())}{s.clockOffset ? ` (${Math.round(s.clockOffset / DAY * 10) / 10} days ahead)` : ''}. Today is {fmtDay(now())}.{' '}
        <button type="button" className="link-btn" onClick={() => { store.update((x) => { x.clockOffset = 0 }); toast('info', 'Clock reset') }}>Reset clock</button></p>
    </div>
  )
}
