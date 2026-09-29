import { useState } from 'react'
import { emitDevice, toast } from '../lib/bus.js'
import { deviceCall, runScheduler } from '../lib/services.js'
import { activeTxForCopy, store, useStore } from '../lib/store.js'
import { DAY, HOUR } from '../lib/time.js'
import { Icon } from './ui.jsx'

// Remember whether the panel was open when a page change remounts it.
let wasOpen = false

const TARGETS = [['BORROW-01', 'Borrowing station'], ['RETURN-01', 'Return station'], ['EXIT-01', 'Exit gate']]

/**
 * Stand-in for the physical hardware. It emits the same device events a
 * reader would (card tap, tag read, face result) and calls the gate API the
 * way the ESP32 turnstile controller does.
 */
export default function Simulator({ defaultTarget = 'BORROW-01' }) {
  const s = useStore()
  const [open, setOpenState] = useState(wasOpen)
  const setOpen = (v) => { wasOpen = v; setOpenState(v) }
  const [tab, setTab] = useState('devices')
  const [target, setTarget] = useState(defaultTarget)
  const [studentUid, setStudentUid] = useState('04A1B2C3')
  const [bookUid, setBookUid] = useState('B8239CAF')
  const [carrier, setCarrier] = useState('')

  const titleOf = (c) => s.titles.find((t) => t.id === c.titleId)
  const gate = (rfid, personStudentId = carrier || null) => {
    const res = deviceCall('EXIT-01', 'POST', '/api/gate/check', { rfid, personStudentId })
    if (res.status !== 200) toast('danger', 'Gate API error', res.body.error)
    else if (res.body.decision === 'ALLOW_EXIT') toast('good', 'Exit allowed', `${rfid} has an active loan.`)
  }
  const unauthorized = () => {
    const copy = s.copies.find((c) => c.status === 'available' && !activeTxForCopy(s, c.id))
    if (copy) { setBookUid(copy.rfid); gate(copy.rfid, null) }
  }
  const successfulReturn = () => {
    const tx = s.transactions.find((x) => x.returnedAt == null)
    if (!tx) return
    const res = deviceCall('RETURN-01', 'POST', '/api/return', { copyId: tx.copyId, studentId: tx.studentId })
    toast(res.status === 200 ? 'good' : 'danger', res.status === 200 ? 'Return processed at RETURN-01' : 'Return failed', res.status === 200 ? titleOf(s.copies.find((c) => c.id === tx.copyId)).title : res.body.error)
  }
  const advance = (ms) => {
    store.update((st) => { st.clockOffset = (st.clockOffset ?? 0) + ms })
    runScheduler()
    toast('info', 'Clock moved forward', `Demo time is now ${new Date(Date.now() + store.get().clockOffset).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`)
  }

  return (
    <div className={`sim${open ? ' open' : ''}`}>
      <button type="button" className="sim-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="cpu" size={16} />Device simulator<Icon name={open ? 'x' : 'plus'} size={14} />
      </button>
      {open && (
        <div className="sim-body">
          <div className="sim-tabs">
            <button type="button" className={tab === 'devices' ? 'on' : ''} onClick={() => setTab('devices')}>Hardware</button>
            <button type="button" className={tab === 'guide' ? 'on' : ''} onClick={() => setTab('guide')}>Try this</button>
            <button type="button" className={tab === 'time' ? 'on' : ''} onClick={() => setTab('time')}>Clock</button>
          </div>

          {tab === 'devices' && (
            <div className="sim-section">
              <label className="field">
                <span className="field-label">Send to</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  {TARGETS.map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Student card</span>
                <select value={studentUid} onChange={(e) => setStudentUid(e.target.value)}>
                  {s.students.map((st) => <option key={st.id} value={st.rfid}>{st.name} · {st.rfid}{st.status !== 'active' ? ' (suspended)' : ''}{!st.face ? ' (no face)' : ''}</option>)}
                  <option value="DEADBEEF">Unregistered card · DEADBEEF</option>
                </select>
              </label>
              <button type="button" className="btn btn-sm" disabled={target === 'EXIT-01'} onClick={() => emitDevice({ device: target, kind: 'student-card', uid: studentUid })}><Icon name="card" size={15} />Tap student card</button>

              <div className="sim-row">
                <button type="button" className="btn btn-sm" disabled={target === 'EXIT-01'} onClick={() => emitDevice({ device: target, kind: 'face', outcome: 'match' })}><Icon name="face" size={15} />Face match</button>
                <button type="button" className="btn btn-sm" disabled={target === 'EXIT-01'} onClick={() => emitDevice({ device: target, kind: 'face', outcome: 'mismatch' })}>Face mismatch</button>
              </div>

              <label className="field">
                <span className="field-label">Book tag</span>
                <select value={bookUid} onChange={(e) => setBookUid(e.target.value)}>
                  {s.copies.map((c) => <option key={c.id} value={c.rfid}>{titleOf(c).title.slice(0, 30)} #{c.copyNo} · {c.rfid} ({c.status})</option>)}
                  <option value="E21A09BC">Unknown tag · E21A09BC</option>
                </select>
              </label>
              {target === 'EXIT-01' ? (
                <>
                  <label className="field">
                    <span className="field-label">Person at gate (camera match)</span>
                    <select value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                      <option value="">Not identified</option>
                      {s.students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                    </select>
                  </label>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => gate(bookUid)}><Icon name="gate" size={15} />Gate detects tag</button>
                </>
              ) : (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => emitDevice({ device: target, kind: 'book-tag', uid: bookUid })}><Icon name="tag" size={15} />Scan book tag</button>
              )}

              <p className="field-label sim-quick-label">Quick scenarios</p>
              <div className="sim-row">
                <button type="button" className="btn btn-sm btn-danger" onClick={unauthorized}><Icon name="alert" size={15} />Unauthorized exit</button>
                <button type="button" className="btn btn-sm" onClick={successfulReturn}><Icon name="return" size={15} />Successful return</button>
              </div>
            </div>
          )}

          {tab === 'guide' && (
            <ol className="sim-guide">
              <li>Open <strong>Borrowing</strong>. Tap <strong>Juan Dela Cruz</strong>'s card, then <strong>Face match</strong>.</li>
              <li>Scan <strong>Computer Networks · B8239CAF</strong>, choose 7 days and confirm.</li>
              <li>Open <strong>RFID Gate</strong>, pick B8239CAF and <strong>Gate detects tag</strong>: exit allowed.</li>
              <li>Try <strong>Unauthorized exit</strong>: the alarm fires and the gate locks.</li>
              <li>On <strong>Clock</strong>, jump 6 days ahead to see the "due tomorrow" reminder, then 2 more for the overdue notice.</li>
              <li>Switch to the <strong>student portal</strong> as Juan to see it from his side.</li>
            </ol>
          )}

          {tab === 'time' && (
            <div className="sim-section">
              <p className="muted small">Move the demo clock forward to trigger reminders and overdue status. The scheduler runs after each jump.</p>
              <div className="sim-row">
                <button type="button" className="btn btn-sm" onClick={() => advance(HOUR)}>+1 hour</button>
                <button type="button" className="btn btn-sm" onClick={() => advance(DAY)}>+1 day</button>
                <button type="button" className="btn btn-sm" onClick={() => advance(6 * DAY)}>+6 days</button>
              </div>
              <div className="sim-row">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { store.update((st) => { st.clockOffset = 0 }); toast('info', 'Clock reset to real time') }}>Real time</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { if (confirm('Reset all demo data?')) { store.reset(); runScheduler(true); toast('info', 'Demo data reset') } }}><Icon name="refresh" size={15} />Reset demo</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
