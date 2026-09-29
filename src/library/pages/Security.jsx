import { useEffect, useState } from 'react'
import { Avatar, Badge, Cover, Empty, Icon, PageHeader, Panel } from '../components/ui.jsx'
import { toast } from '../lib/bus.js'
import { deviceCall, webAction, writeLog } from '../lib/services.js'
import { copyStatus, now, useStore } from '../lib/store.js'
import { fmtShortDateTime, fmtTimeSec } from '../lib/time.js'

function useEventView(s, g) {
  const copy = g.copyId && s.copies.find((c) => c.id === g.copyId)
  const title = copy && s.titles.find((t) => t.id === copy.titleId)
  const student = g.studentId && s.students.find((st) => st.id === g.studentId)
  const borrower = g.borrowerId && s.students.find((st) => st.id === g.borrowerId)
  return { copy, title, student, borrower }
}

function Detection({ g, big = false }) {
  const s = useStore()
  const { copy, title, student, borrower } = useEventView(s, g)
  const ok = g.result === 'allowed'
  return (
    <article className={`detection ${ok ? 'det-ok' : 'det-alarm'}${big ? ' det-big' : ''}`}>
      {title ? <Cover title={title} className="det-cover" /> : <div className="det-cover det-unknown"><Icon name="tag" size={26} /></div>}
      <div className="det-body">
        <p className="det-time mono">{fmtTimeSec(g.at)}</p>
        <p className="det-headline">{ok ? 'RFID detected' : g.result === 'unknown' ? 'UNKNOWN RFID TAG DETECTED' : 'UNAUTHORIZED BOOK DETECTED'}</p>
        <dl>
          <div><dt>Book</dt><dd>{title?.title ?? '—'}</dd></div>
          <div><dt>Status</dt><dd>{ok ? 'Authorized' : copy ? `${copyStatus(s, copy)[0].toUpperCase()}${copyStatus(s, copy).slice(1)} · ${g.reason}` : g.reason}</dd></div>
          {ok ? <div><dt>Borrower</dt><dd>{student?.name}</dd></div> : <div><dt>RFID</dt><dd className="mono">{g.rfid}</dd></div>}
          {!ok && borrower && <div><dt>Loaned to</dt><dd>{borrower.name}</dd></div>}
          {!ok && <div><dt>At gate</dt><dd>{student ? `${student.name} (camera match)` : g.camera ? 'Unidentified person · CAM-01 frame saved' : 'Not identified'}</dd></div>}
          <div><dt>Gate</dt><dd className="mono">{g.gate}</dd></div>
          <div><dt>Result</dt><dd><strong>{ok ? 'Exit Allowed' : 'ALARM ACTIVATED'}</strong></dd></div>
        </dl>
      </div>
    </article>
  )
}

export function Gate() {
  const s = useStore()
  const [rfid, setRfid] = useState('')
  const [, setTick] = useState(0)
  const latest = s.gateEvents[0]

  // Re-render twice a second so the gate animation clears after a detection.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [])

  const recent = latest && now() - latest.at < 4000
  const state = recent ? (latest.result === 'allowed' ? 'open' : 'alarm') : 'idle'
  const test = (e) => {
    e.preventDefault()
    if (!rfid.trim()) return
    const res = deviceCall('EXIT-01', 'POST', '/api/gate/check', { rfid: rfid.trim() })
    if (res.status !== 200) toast('danger', 'Gate API error', res.body.error)
    setRfid('')
  }
  const alarms = s.gateEvents.filter((g) => g.result !== 'allowed' && !g.resolved).length

  return (
    <div className="page">
      <PageHeader eyebrow="07 / Security" title="RFID gate · EXIT-01">
        <span className="live-pill"><span className="dot" />Live</span>
      </PageHeader>
      <div className={`gate-stage gate-${state}`} aria-live="assertive">
        <div className="turnstile" aria-hidden="true">
          <div className="post post-l"><span className="antenna" /></div>
          <div className="arms"><span className="arm arm-l" /><span className="arm arm-r" /></div>
          <div className="post post-r"><span className="antenna" /></div>
          <div className="gate-floor" />
          <div className="rf-waves"><span /><span /><span /></div>
        </div>
        <div className="gate-status">
          <p className="eyebrow">Gate state</p>
          <strong>{state === 'open' ? 'Exit allowed' : state === 'alarm' ? 'Alarm · gate locked' : 'Monitoring'}</strong>
          <span>{state === 'idle' ? 'Waiting for tags at the exit antennas.' : latest?.reason}</span>
          <form className="inline-form" onSubmit={test}>
            <input className="mono" value={rfid} onChange={(e) => setRfid(e.target.value.toUpperCase())} placeholder="Test a tag UID" aria-label="Test RFID at gate" />
            <button type="submit" className="btn">Detect</button>
          </form>
          <p className="muted small">{alarms} unresolved alarm{alarms === 1 ? '' : 's'} · rule: a copy may leave only with an active loan.</p>
        </div>
      </div>
      <Panel title="Recent detections" flush>
        <div className="detections">
          {s.gateEvents.slice(0, 12).map((g, i) => <Detection key={g.id} g={g} big={i === 0} />)}
        </div>
      </Panel>
    </div>
  )
}

export function SecurityEvents() {
  const s = useStore()
  const [filter, setFilter] = useState('open')
  const [notes, setNotes] = useState({})
  const events = s.gateEvents.filter((g) => g.result !== 'allowed' && (filter === 'all' || !g.resolved))
  const failedFace = s.faceLogs.filter((f) => f.result === 'failed').slice(0, 10)
  const resolve = (g) => {
    const note = (notes[g.id] ?? '').trim() || 'Reviewed by librarian.'
    webAction((st) => {
      const e = st.gateEvents.find((x) => x.id === g.id)
      e.resolved = true
      e.resolution = note
      writeLog(st, { user: 'Librarian', action: 'Security event resolved', device: g.gate, copyId: g.copyId, studentId: g.studentId, result: note })
    })
    toast('good', 'Incident resolved')
  }
  return (
    <div className="page">
      <PageHeader eyebrow="08 / Security" title="Security events">
        <div className="segmented">
          <button type="button" className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>Unresolved</button>
          <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        </div>
      </PageHeader>
      {events.length === 0 ? <Empty title="No incidents" icon="shield">All alarms have been reviewed.</Empty> : (
        <div className="incidents">
          {events.map((g) => {
            const copy = g.copyId && s.copies.find((c) => c.id === g.copyId)
            const title = copy && s.titles.find((t) => t.id === copy.titleId)
            const person = g.studentId && s.students.find((st) => st.id === g.studentId)
            return (
              <article key={g.id} className={`incident${g.resolved ? ' resolved' : ''}`}>
                {title ? <Cover title={title} className="det-cover" /> : <div className="det-cover det-unknown"><Icon name="tag" size={26} /></div>}
                <div className="incident-body">
                  <div className="incident-top">
                    <Badge status={g.result === 'unknown' ? 'unknown' : 'alarm'} />
                    <span className="mono small">{fmtShortDateTime(g.at)} · {g.gate}</span>
                  </div>
                  <h3>{title?.title ?? 'Unregistered RFID tag'}</h3>
                  <p className="muted">{g.reason} · RFID <span className="mono">{g.rfid}</span></p>
                  <div className="capture">
                    <div className="capture-frame"><Icon name="camera" size={20} /><span>CAM-01</span></div>
                    <span className="small">{person ? <>Camera match: <strong>{person.name}</strong> ({person.studentId})</> : 'Person not identified. Frame kept for review (restricted).'}</span>
                    {person && <Avatar student={person} size={30} />}
                  </div>
                  {g.resolved ? <p className="small"><Icon name="checkCircle" size={14} /> {g.resolution}</p> : (
                    <div className="inline-form">
                      <input value={notes[g.id] ?? ''} onChange={(e) => setNotes({ ...notes, [g.id]: e.target.value })} placeholder="Resolution note" aria-label="Resolution note" />
                      <button type="button" className="btn btn-primary" onClick={() => resolve(g)}>Resolve</button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
      <Panel title="Failed facial verifications" flush>
        {failedFace.length === 0 ? <Empty title="None recorded" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>When</th><th>Card holder</th><th>Device</th><th>Confidence</th></tr></thead>
            <tbody>{failedFace.map((f) => { const st = s.students.find((x) => x.id === f.studentId); return <tr key={f.id}><td>{fmtShortDateTime(f.at)}</td><td>{st.name}<span className="sub mono">{st.studentId}</span></td><td className="mono">{f.device}</td><td>{Math.round((f.confidence ?? 0) * 100)}%</td></tr> })}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  )
}
