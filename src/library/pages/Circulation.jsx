import { useState } from 'react'
import RenewalRequests from '../components/RenewalRequests.jsx'
import { BorrowStation, ReturnStation } from '../components/Stations.jsx'
import { Avatar, Badge, Empty, Icon, PageHeader, Panel } from '../components/ui.jsx'
import { toast } from '../lib/bus.js'
import { services, webAction } from '../lib/services.js'
import { copyByRfid, now, txView, useStore } from '../lib/store.js'
import { DAY, dueLabel, fmtShortDateTime, startOfDay } from '../lib/time.js'

function LoanTable({ rows, actions = true }) {
  const s = useStore()
  const t = now()
  const manualReturn = (tx) => {
    const r = webAction((st) => services.returnBook(st, { copyId: tx.copyId, device: 'Web', user: 'Librarian' }))
    toast(r.status === 200 ? 'good' : 'danger', r.status === 200 ? 'Return processed manually' : 'Return failed', r.body.error ?? '')
  }
  const remind = (tx) => {
    webAction((st) => services.sendReminderNow(st, tx.id))
    toast('good', 'Reminder sent', 'Email, SMS and in-app notification queued.')
  }
  if (!rows.length) return <Empty title="Nothing here" icon="checkCircle">No loans in this list right now.</Empty>
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Book</th><th>Student</th><th>Borrowed</th><th>Due</th><th>Countdown</th>{actions && <th className="num">Actions</th>}</tr></thead>
        <tbody>
          {rows.map((tx) => {
            const v = txView(s, tx)
            const d = dueLabel(tx.dueAt, t)
            return (
              <tr key={tx.id}>
                <td>{v.title.title}<span className="sub mono">#{v.copy.copyNo} · {v.copy.rfid}</span></td>
                <td><div className="cell-person"><Avatar student={v.student} size={30} /><div>{v.student.name}<span className="sub mono">{v.student.studentId}</span></div></div></td>
                <td>{fmtShortDateTime(tx.borrowedAt)}</td>
                <td>{fmtShortDateTime(tx.dueAt)}{tx.renewals > 0 && <span className="sub">Renewed {tx.renewals}×</span>}</td>
                <td><Badge status={d.tone === 'overdue' ? 'overdue' : d.tone === 'soon' ? 'soon' : 'borrowed'}>{d.text}</Badge></td>
                {actions && (
                  <td className="num">
                    <div className="row-actions">
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => remind(tx)} title="Send reminder now"><Icon name="bell" size={15} />Remind</button>
                      <button type="button" className="btn btn-sm" onClick={() => manualReturn(tx)}><Icon name="return" size={15} />Return</button>
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Borrowing() {
  const s = useStore()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const rows = s.transactions.filter((tx) => tx.returnedAt == null).filter((tx) => {
    if (!needle) return true
    const v = txView(s, tx)
    return [v.title.title, v.student.name, v.student.studentId, v.copy.rfid].some((x) => x.toLowerCase().includes(needle))
  }).sort((a, b) => a.dueAt - b.dueAt)
  return (
    <div className="page">
      <PageHeader eyebrow="04 / Circulation" title="Borrowing" />
      <RenewalRequests />
      <BorrowStation />
      <Panel title="Active loans" sub={`${rows.length} books currently out`} actions={<label className="search search-sm"><Icon name="search" size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter loans" /></label>} flush>
        <LoanTable rows={rows} />
      </Panel>
      <Reservations />
    </div>
  )
}

function Reservations() {
  const s = useStore()
  const list = [...s.reservations].sort((a, b) => (a.copyId ? 0 : 1) - (b.copyId ? 0 : 1) || a.createdAt - b.createdAt)
  const cancel = (r) => {
    webAction((st) => services.cancelReservation(st, { id: r.id, user: 'Librarian' }))
    toast('info', 'Reservation cancelled', 'The student has been notified.')
  }
  return (
    <Panel title="Reservations" sub={`${list.filter((r) => r.copyId).length} on the hold shelf · ${list.filter((r) => !r.copyId).length} waiting`} flush>
      {list.length === 0 ? <Empty title="No reservations" icon="sparkle" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Book</th><th>Student</th><th>Reserved</th><th>Status</th><th className="num">Actions</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const title = s.titles.find((x) => x.id === r.titleId)
                const student = s.students.find((x) => x.id === r.studentId)
                const copy = r.copyId && s.copies.find((c) => c.id === r.copyId)
                const position = s.reservations.filter((x) => x.titleId === r.titleId && !x.copyId).sort((a, b) => a.createdAt - b.createdAt).findIndex((x) => x.id === r.id) + 1
                return (
                  <tr key={r.id}>
                    <td>{title.title}{copy && <span className="sub mono">#{copy.copyNo} · {copy.rfid} · shelf {copy.shelf}</span>}</td>
                    <td><div className="cell-person"><Avatar student={student} size={30} /><div>{student.name}<span className="sub mono">{student.studentId}</span></div></div></td>
                    <td>{fmtShortDateTime(r.createdAt)}</td>
                    <td>{copy ? <Badge status="reserved">On hold until {fmtShortDateTime(r.expiresAt)}</Badge> : <Badge status="soon">#{position} in line</Badge>}</td>
                    <td className="num"><button type="button" className="btn btn-sm btn-ghost" onClick={() => cancel(r)}><Icon name="x" size={15} />Cancel</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

export function Returns() {
  const s = useStore()
  const [rfid, setRfid] = useState('')
  const [error, setError] = useState('')
  const recent = s.transactions.filter((tx) => tx.returnedAt).sort((a, b) => b.returnedAt - a.returnedAt).slice(0, 10)
  const manual = (e) => {
    e.preventDefault()
    const copy = copyByRfid(s, rfid)
    if (!copy) { setError('No book copy has this RFID UID.'); return }
    const r = webAction((st) => services.returnBook(st, { copyId: copy.id, device: 'Web', user: 'Librarian' }))
    if (r.status !== 200) { setError(r.body.error); return }
    setError('')
    setRfid('')
    toast('good', 'Return processed manually', `${s.titles.find((x) => x.id === copy.titleId).title} · ${r.body.onTime ? 'on time' : 'late'}`)
  }
  return (
    <div className="page">
      <PageHeader eyebrow="05 / Circulation" title="Returns" />
      <ReturnStation />
      <div className="grid-2">
        <Panel title="Manual return" sub="For books handed in at the desk or when the reader is down">
          <form className="inline-form" onSubmit={manual}>
            <input className="mono" value={rfid} onChange={(e) => { setRfid(e.target.value.toUpperCase()); setError('') }} placeholder="Book RFID UID" aria-label="Book RFID UID" />
            <button type="submit" className="btn btn-primary">Process return</button>
          </form>
          {error && <p className="error-text">{error}</p>}
          <p className="muted small">Returning a book immediately revokes its exit authorization at the gate.</p>
        </Panel>
        <Panel title="Recent returns" flush>
          <ul className="feed">
            {recent.map((tx) => {
              const v = txView(s, tx)
              return (
                <li key={tx.id}>
                  <Avatar student={v.student} size={30} />
                  <div><strong>{v.title.title}</strong><span>{v.student.name} · {fmtShortDateTime(tx.returnedAt)} · {tx.returnDevice}</span></div>
                  <Badge status={tx.lateReturn ? 'overdue' : 'available'}>{tx.lateReturn ? 'Late' : 'On time'}</Badge>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

export function Overdue() {
  const s = useStore()
  const t = now()
  const today = startOfDay(t)
  const open = s.transactions.filter((tx) => tx.returnedAt == null)
  const overdue = open.filter((tx) => t > tx.dueAt).sort((a, b) => a.dueAt - b.dueAt)
  const dueToday = open.filter((tx) => tx.dueAt >= t && startOfDay(tx.dueAt) === today)
  const dueTomorrow = open.filter((tx) => startOfDay(tx.dueAt) === today + DAY)
  return (
    <div className="page">
      <PageHeader eyebrow="06 / Monitoring" title="Due dates & overdue" />
      <p className="lead-muted">Loans are re-checked every few seconds. Once the due time plus a {s.settings.graceHours}-hour grace period passes, a loan becomes <strong>Overdue</strong> and both the student and the librarian are notified.</p>
      <Panel title={`Overdue (${overdue.length})`} className="panel-danger" flush><LoanTable rows={overdue} /></Panel>
      <div className="grid-2">
        <Panel title={`Due today (${dueToday.length})`} flush><LoanTable rows={dueToday} /></Panel>
        <Panel title={`Due tomorrow (${dueTomorrow.length})`} flush><LoanTable rows={dueTomorrow} /></Panel>
      </div>
    </div>
  )
}
