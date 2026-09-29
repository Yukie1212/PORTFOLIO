import { useState } from 'react'
import { toast } from '../lib/bus.js'
import { renewProblems, services, webAction } from '../lib/services.js'
import { useStore } from '../lib/store.js'
import { fmtShortDateTime } from '../lib/time.js'
import { Avatar, Cover, Icon } from './ui.jsx'

/** Renewal requests waiting for a librarian. Nothing is renewed until approved here. */
export default function RenewalRequests() {
  const s = useStore()
  const [declining, setDeclining] = useState(null)
  const [reason, setReason] = useState('')
  const pending = (s.renewalRequests ?? []).filter((r) => r.status === 'pending').sort((a, b) => a.requestedAt - b.requestedAt)
  if (!pending.length) return null

  const decide = (request, approve) => {
    const r = webAction((st) => services.decideRenewal(st, { requestId: request.id, approve, reason }))
    const student = s.students.find((x) => x.id === request.studentId)
    if (r.status !== 200) toast('danger', 'Could not approve', r.body.error)
    else toast(approve ? 'good' : 'info', approve ? 'Renewal approved' : 'Renewal declined', `${student.name} has been notified.`)
    setDeclining(null)
    setReason('')
  }

  return (
    <section className="renewals" aria-live="polite">
      <header className="renewals-head">
        <span className="renewals-icon"><Icon name="refresh" size={18} /></span>
        <div>
          <h2>{pending.length} renewal request{pending.length === 1 ? '' : 's'} waiting</h2>
          <p>Students asked for more time. The due date only changes after you approve.</p>
        </div>
      </header>
      <ul>
        {pending.map((request) => {
          const tx = s.transactions.find((x) => x.id === request.txId)
          const copy = s.copies.find((c) => c.id === request.copyId)
          const title = s.titles.find((x) => x.id === copy.titleId)
          const student = s.students.find((x) => x.id === request.studentId)
          const blockers = tx ? renewProblems(s, tx) : ['Loan already closed.']
          return (
            <li key={request.id}>
              <Cover title={title} className="renewal-cover" />
              <div className="renewal-body">
                <strong>{title.title}</strong>
                <span className="renewal-who"><Avatar student={student} size={22} />{student.name} · <span className="mono">{student.studentId}</span></span>
                <span className="small muted">Due {fmtShortDateTime(request.currentDueAt)} → <strong className="renewal-new">{fmtShortDateTime(request.proposedDueAt)}</strong> · renewal {tx ? tx.renewals + 1 : '?'} of {s.settings.renewalLimit}</span>
                <span className="small muted">Requested {fmtShortDateTime(request.requestedAt)}</span>
                {blockers.length > 0 && <span className="small error-text">{blockers[0]}</span>}
                {declining === request.id && (
                  <div className="inline-form renewal-reason">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (sent to the student)" aria-label="Reason for declining" autoFocus />
                    <button type="button" className="btn btn-danger" onClick={() => decide(request, false)}>Decline</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setDeclining(null)}>Back</button>
                  </div>
                )}
              </div>
              {declining !== request.id && (
                <div className="renewal-actions">
                  <button type="button" className="btn btn-primary" onClick={() => decide(request, true)} disabled={blockers.length > 0}><Icon name="check" />Approve</button>
                  <button type="button" className="btn" onClick={() => { setDeclining(request.id); setReason('') }}>Decline</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
