import { useEffect, useRef, useState } from 'react'
import { onDevice, toast } from '../lib/bus.js'
import { borrowRules, deviceCall } from '../lib/services.js'
import { categoryName, now, useStore } from '../lib/store.js'
import { DAY, dueLabel, fmtDateTime } from '../lib/time.js'
import FaceCheck from './FaceCheck.jsx'
import { Avatar, Badge, Book3D, Icon } from './ui.jsx'

function Steps({ steps, current }) {
  return (
    <ol className="steps">
      {steps.map((label, i) => (
        <li key={label} className={i < current ? 'done' : i === current ? 'current' : ''}>
          <span className="step-num">{i < current ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  )
}

function ScanPrompt({ kind, device, onSubmit, hint }) {
  const [value, setValue] = useState('')
  const card = kind === 'card'
  return (
    <div className="scan-prompt">
      <div className={`scan-visual ${card ? 'scan-card' : 'scan-book'}`} aria-hidden="true">
        <div className="scan-pad"><span /><span /><span /></div>
        <div className="scan-object">{card ? <Icon name="card" size={38} strokeWidth={1.4} /> : <Icon name="book" size={38} strokeWidth={1.4} />}</div>
      </div>
      <h3>{card ? 'Tap your RFID school ID' : 'Place the book on the reader'}</h3>
      <p className="muted">{hint ?? `Waiting for ${device}. Use the device simulator (bottom right) or type a UID.`}</p>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (value.trim()) { onSubmit(value.trim()); setValue('') } }}>
        <input value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} placeholder={card ? 'Card UID, e.g. 04A1B2C3' : 'Book RFID, e.g. B8239CAF'} aria-label={card ? 'Student card UID' : 'Book RFID UID'} spellCheck="false" autoComplete="off" />
        <button type="submit" className="btn">Enter</button>
      </form>
    </div>
  )
}

function Problems({ list }) {
  if (!list?.length) return null
  return (
    <div className="problems" role="alert">
      <Icon name="alert" />
      <ul>{list.map((p) => <li key={p}>{p}</li>)}</ul>
    </div>
  )
}

/** Borrowing kiosk: card → face → book → duration → confirm. */
export function BorrowStation({ device = 'BORROW-01', compact = false }) {
  const s = useStore()
  const [step, setStep] = useState(0)
  const [student, setStudent] = useState(null)
  const [verification, setVerification] = useState(null)
  const [copyId, setCopyId] = useState(null)
  const [days, setDays] = useState(null)
  const [problems, setProblems] = useState([])
  const [done, setDone] = useState(null)
  const resetTimer = useRef(null)

  const reset = () => {
    clearTimeout(resetTimer.current)
    setStep(0); setStudent(null); setVerification(null); setCopyId(null); setDays(null); setProblems([]); setDone(null)
  }
  useEffect(() => () => clearTimeout(resetTimer.current), [])

  const onCard = (tag) => {
    const res = deviceCall(device, 'POST', '/api/rfid/student-scan', { uid: tag })
    if (res.status !== 200) { setProblems([res.body.error]); return }
    const st = s.students.find((x) => x.id === res.body.student.id)
    setStudent(st)
    setProblems(res.body.problems)
    if (res.body.problems.length) return
    if (s.settings.requireFace) setStep(1)
    else { setVerification('not-required'); setStep(2) }
  }

  const onBook = (tag) => {
    const res = deviceCall(device, 'POST', '/api/rfid/book-scan', { uid: tag })
    if (res.status !== 200) { setProblems([res.body.error]); return }
    const copy = res.body.copy
    const list = []
    if (copy.status === 'borrowed') list.push('This copy is already borrowed. Please hand it to the librarian.')
    if (copy.status === 'lost' || copy.status === 'maintenance') list.push(`This copy is marked ${copy.status}. Please hand it to the librarian.`)
    if (copy.status === 'reserved' && s.reservations.some((r) => r.copyId === copy.id && r.studentId !== student.id)) list.push('This copy is on hold for another student.')
    setProblems(list)
    if (list.length) return
    setCopyId(copy.id)
    const rules = borrowRules(s, copy)
    setDays(rules.durations.includes(7) ? 7 : rules.durations.at(-1))
    setStep(3)
  }

  // Hardware events for this station.
  const handlers = useRef({})
  useEffect(() => { handlers.current = { step, onCard, onBook } })
  useEffect(() => onDevice(device, (e) => {
    const h = handlers.current
    if (e.kind === 'student-card' && h.step === 0) h.onCard(e.uid)
    if (e.kind === 'book-tag' && h.step === 2) h.onBook(e.uid)
  }), [device])

  const confirm = () => {
    const res = deviceCall(device, 'POST', '/api/borrow', { studentId: student.id, copyId, days, verification: verification === 'not-required' ? 'verified' : verification })
    if (res.status !== 201) { setProblems(res.body.problems ?? [res.body.error]); return }
    setDone(res.body.transaction)
    setStep(4)
    toast('good', 'Book borrowed', `${student.name} · due ${fmtDateTime(res.body.transaction.dueAt)}`)
    resetTimer.current = setTimeout(reset, 15000)
  }

  const copy = copyId && s.copies.find((c) => c.id === copyId)
  const title = copy && s.titles.find((t) => t.id === copy.titleId)
  const rules = copy && borrowRules(s, copy)
  const t = now()

  return (
    <div className={`station${compact ? ' station-compact' : ''}`}>
      <header className="station-head">
        <div>
          <p className="eyebrow">{device} · Borrowing station</p>
          <h2>Borrow a book</h2>
        </div>
        {step > 0 && <button type="button" className="btn btn-ghost" onClick={reset}>Cancel</button>}
      </header>
      <Steps steps={['School ID', 'Face check', 'Scan book', 'Confirm']} current={Math.min(step, 4)} />

      {student && step > 0 && step < 4 && (
        <div className="who">
          <Avatar student={student} size={44} />
          <div><strong>{student.name}</strong><span className="muted">{student.studentId} · {student.program}</span></div>
          {verification && <Badge status={verification === 'manual' ? 'manual' : 'verified'}>{verification === 'manual' ? 'Librarian verified' : 'Identity verified'}</Badge>}
        </div>
      )}

      <Problems list={problems} />

      {step === 0 && <ScanPrompt kind="card" device={device} onSubmit={onCard} />}
      {step === 0 && student && problems.length > 0 && <button type="button" className="btn btn-ghost" onClick={reset}>Start over</button>}
      {step === 1 && student && <FaceCheck student={student} device={device} onDone={(v) => { setVerification(v); setStep(2) }} />}
      {step === 2 && <ScanPrompt kind="book" device={device} onSubmit={onBook} />}

      {step === 3 && title && (
        <div className="confirm-grid">
          <Book3D title={title} size="lg" float />
          <div className="confirm-body">
            <p className="eyebrow">{categoryName(s, title.category)} · Copy #{copy.copyNo} · RFID {copy.rfid}</p>
            <h3 className="confirm-title">{title.title}</h3>
            <p className="muted">{title.author}</p>
            <p className="field-label">Borrowing period</p>
            <div className="duration-picks">
              {s.settings.durations.map((d) => (
                <button key={d} type="button" className={`duration${days === d ? ' on' : ''}`} disabled={!rules.durations.includes(d)} onClick={() => setDays(d)}>
                  <strong>{d}</strong><span>day{d === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
            {rules.maxDays < s.settings.maxDays && <p className="muted small">{categoryName(s, title.category)} books can be borrowed for up to {rules.maxDays} day{rules.maxDays === 1 ? '' : 's'}.</p>}
            <dl className="summary">
              <div><dt>Student</dt><dd>{student.name} ({student.studentId})</dd></div>
              <div><dt>Book</dt><dd>{title.title}</dd></div>
              <div><dt>Borrowed</dt><dd>{fmtDateTime(t)}</dd></div>
              <div><dt>Period</dt><dd>{days} day{days === 1 ? '' : 's'}</dd></div>
              <div className="summary-due"><dt>Due</dt><dd>{fmtDateTime(t + days * DAY)}</dd></div>
            </dl>
            <div className="btn-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={confirm}><Icon name="check" />Confirm borrowing</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setStep(2); setCopyId(null) }}>Scan a different book</button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && done && title && (
        <div className="success">
          <div className="success-burst"><Icon name="checkCircle" size={44} /></div>
          <h3>Enjoy your book, {student.name.split(' ')[0]}!</h3>
          <p>Return <strong>{title.title}</strong> by <strong>{fmtDateTime(done.dueAt)}</strong>.</p>
          <p className="gate-ok"><Icon name="unlock" size={16} /> RFID {copy.rfid} is now authorized at the exit gate.</p>
          <button type="button" className="btn btn-primary" onClick={reset}>Next student</button>
        </div>
      )}
    </div>
  )
}

/** Return kiosk: card → book → review → confirm. */
export function ReturnStation({ device = 'RETURN-01' }) {
  const s = useStore()
  const [step, setStep] = useState(0)
  const [student, setStudent] = useState(null)
  const [tx, setTx] = useState(null)
  const [problems, setProblems] = useState([])
  const [done, setDone] = useState(null)

  const reset = () => { setStep(0); setStudent(null); setTx(null); setProblems([]); setDone(null) }

  const onCard = (tag) => {
    const res = deviceCall(device, 'POST', '/api/rfid/student-scan', { uid: tag })
    if (res.status !== 200) { setProblems([res.body.error]); return }
    setStudent(s.students.find((x) => x.id === res.body.student.id))
    setProblems([])
    setStep(1)
  }
  const onBook = (tag) => {
    const res = deviceCall(device, 'POST', '/api/rfid/book-scan', { uid: tag })
    if (res.status !== 200) { setProblems([res.body.error]); return }
    const active = res.body.activeTransaction
    if (!active) { setProblems(['This book has no active borrowing transaction. It may already be returned.']); return }
    if (active.studentId !== student.id) { setProblems(['This book was borrowed by a different student. Please hand it to the librarian.']); return }
    setProblems([])
    setTx(active)
    setStep(2)
  }
  const handlers = useRef({})
  useEffect(() => { handlers.current = { step, onCard, onBook } })
  useEffect(() => onDevice(device, (e) => {
    const h = handlers.current
    if (e.kind === 'student-card' && h.step === 0) h.onCard(e.uid)
    if (e.kind === 'book-tag' && h.step === 1) h.onBook(e.uid)
  }), [device])

  const confirm = () => {
    const res = deviceCall(device, 'POST', '/api/return', { copyId: tx.copyId, studentId: student.id })
    if (res.status !== 200) { setProblems([res.body.error]); return }
    setDone(res.body)
    setStep(3)
    toast('good', 'Book returned', res.body.onTime ? 'Returned on time.' : 'Returned late.')
  }

  const copy = tx && s.copies.find((c) => c.id === tx.copyId)
  const title = copy && s.titles.find((t) => t.id === copy.titleId)
  const t = now()
  const late = tx && t > tx.dueAt

  return (
    <div className="station">
      <header className="station-head">
        <div>
          <p className="eyebrow">{device} · Return station</p>
          <h2>Return a book</h2>
        </div>
        {step > 0 && <button type="button" className="btn btn-ghost" onClick={reset}>Cancel</button>}
      </header>
      <Steps steps={['School ID', 'Scan book', 'Review', 'Done']} current={step} />
      {student && step > 0 && step < 3 && (
        <div className="who">
          <Avatar student={student} size={44} />
          <div><strong>{student.name}</strong><span className="muted">{student.studentId}</span></div>
        </div>
      )}
      <Problems list={problems} />
      {step === 0 && <ScanPrompt kind="card" device={device} onSubmit={onCard} />}
      {step === 1 && <ScanPrompt kind="book" device={device} onSubmit={onBook} hint={`Place the book you are returning on ${device}.`} />}
      {step === 2 && title && (
        <div className="confirm-grid">
          <Book3D title={title} size="lg" float />
          <div className="confirm-body">
            <p className="eyebrow">Copy #{copy.copyNo} · RFID {copy.rfid}</p>
            <h3 className="confirm-title">{title.title}</h3>
            <dl className="summary">
              <div><dt>Student</dt><dd>{student.name}</dd></div>
              <div><dt>Borrowed</dt><dd>{fmtDateTime(tx.borrowedAt)}</dd></div>
              <div><dt>Due</dt><dd>{fmtDateTime(tx.dueAt)}</dd></div>
              <div><dt>Return</dt><dd>{fmtDateTime(t)}</dd></div>
              <div className="summary-due"><dt>Status</dt><dd>{late ? <Badge status="overdue">{dueLabel(tx.dueAt, t).text}</Badge> : <Badge status="available">On time</Badge>}</dd></div>
            </dl>
            <div className="btn-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={confirm}><Icon name="check" />Confirm return</button>
            </div>
          </div>
        </div>
      )}
      {step === 3 && done && (
        <div className="success">
          <div className="success-burst"><Icon name="checkCircle" size={44} /></div>
          <h3>Thanks for returning it!</h3>
          <p>{title.title} is back on the shelf{done.copyStatus === 'reserved' ? ' for the student who reserved it' : ''}. {done.onTime ? 'Returned on time.' : 'Returned late.'}</p>
          <p className="gate-ok"><Icon name="lock" size={16} /> RFID {copy.rfid} can no longer leave through the exit.</p>
          <button type="button" className="btn btn-primary" onClick={reset}>Next student</button>
        </div>
      )}
    </div>
  )
}
