import { useMemo, useState } from 'react'
import { Avatar, Badge, Empty, Field, Icon, Modal, PageHeader, Panel, readImage } from '../components/ui.jsx'
import { toast } from '../lib/bus.js'
import { webAction, writeLog } from '../lib/services.js'
import { activeTxForStudent, now, useStore } from '../lib/store.js'
import { dueLabel, fmtDate, fmtShortDate, fmtShortDateTime } from '../lib/time.js'

const PROGRAMS = ['BS Computer Engineering', 'BS Information Technology', 'BS Computer Science', 'BS Electronics Engineering', 'BS Civil Engineering', 'BS Mechanical Engineering']

export default function Students({ go }) {
  const s = useStore()
  const [q, setQ] = useState('')
  const [program, setProgram] = useState('')
  const [adding, setAdding] = useState(false)
  const t = now()
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return s.students.filter((st) => (!program || st.program === program) && (!needle || [st.name, st.studentId, st.rfid, st.email].some((v) => v.toLowerCase().includes(needle))))
  }, [s, q, program])

  return (
    <div className="page">
      <PageHeader eyebrow="03 / Borrowers" title="Students">
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" />Add student</button>
      </PageHeader>
      <div className="filters">
        <label className="search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, student ID, RFID or email" aria-label="Search students" /></label>
        <select value={program} onChange={(e) => setProgram(e.target.value)} aria-label="Program">
          <option value="">All programs</option>
          {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <Panel flush>
        <div className="table-wrap">
          <table className="clickable">
            <thead><tr><th>Student</th><th>Program</th><th>RFID UID</th><th>Loans</th><th>Face</th><th>Account</th></tr></thead>
            <tbody>
              {list.map((st) => {
                const loans = activeTxForStudent(s, st.id)
                const overdue = loans.filter((tx) => t > tx.dueAt).length
                return (
                  <tr key={st.id} onClick={() => go(`students/${st.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`students/${st.id}`)}>
                    <td><div className="cell-person"><Avatar student={st} size={34} /><div>{st.name}<span className="sub mono">{st.studentId}</span></div></div></td>
                    <td>{st.program}<span className="sub">Year {st.year}</span></td>
                    <td className="mono">{st.rfid}</td>
                    <td>{loans.length}{overdue > 0 && <Badge status="overdue">{overdue} overdue</Badge>}</td>
                    <td>{st.face ? <Badge status="verified">Enrolled</Badge> : <Badge status="manual">Not enrolled</Badge>}</td>
                    <td><Badge status={st.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {adding && <StudentForm onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); go(`students/${id}`) }} />}
    </div>
  )
}

function StudentForm({ student = null, onClose, onSaved }) {
  const s = useStore()
  const [form, setForm] = useState(() => student ? { ...student } : { studentId: '', name: '', email: '', phone: '+63 ', program: PROGRAMS[0], year: 1, rfid: '', photo: null })
  const [errors, setErrors] = useState({})
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const save = (e) => {
    e.preventDefault()
    const err = {}
    if (!/^\d{4}-\d{5}$/.test(form.studentId.trim())) err.studentId = 'Use the format 2026-00123.'
    else if (s.students.some((x) => x.studentId === form.studentId.trim() && x.id !== student?.id)) err.studentId = 'Student ID already exists.'
    if (form.name.trim().length < 3) err.name = 'Enter the full name.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) err.email = 'Enter a valid school email.'
    if (!/^\+?[0-9 ]{10,16}$/.test(form.phone.trim())) err.phone = 'Enter a valid phone number.'
    const rfid = form.rfid.trim().toUpperCase()
    if (!/^[A-F0-9]{8,14}$/.test(rfid)) err.rfid = 'RFID UID must be 8–14 hex characters.'
    else if (s.students.some((x) => x.rfid === rfid && x.id !== student?.id) || s.copies.some((c) => c.rfid === rfid)) err.rfid = 'This RFID UID is already assigned.'
    setErrors(err)
    if (Object.keys(err).length) return
    let id = student?.id
    webAction((st) => {
      const data = { studentId: form.studentId.trim(), name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), program: form.program, year: Number(form.year), rfid, photo: form.photo }
      if (student) {
        Object.assign(st.students.find((x) => x.id === student.id), data)
        writeLog(st, { user: 'Librarian', action: 'Student edited', studentId: student.id, result: data.name })
      } else {
        id = `s${Date.now().toString(36)}`
        st.students.push({ id, ...data, face: null, status: 'active' })
        writeLog(st, { user: 'Librarian', action: 'Student registered', studentId: id, result: `${data.name} · RFID ${rfid}` })
      }
    })
    toast('good', student ? 'Student updated' : 'Student registered', form.name)
    onSaved(id)
  }
  const err = (k) => errors[k] && <span className="error-text">{errors[k]}</span>
  return (
    <Modal title={student ? 'Edit student' : 'Register student'} onClose={onClose} wide footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="submit" form="student-form" className="btn btn-primary">Save</button></>}>
      <form id="student-form" className="form-split" onSubmit={save} noValidate>
        <div className="cover-editor">
          <Avatar student={{ ...form, id: student?.id ?? 's0', name: form.name || '?' }} size={120} />
          <label className="btn btn-sm"><Icon name="upload" size={15} />Upload photo<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('photo', await readImage(f, 240)) }} /></label>
          {form.photo && <button type="button" className="link-btn" onClick={() => set('photo', null)}>Remove photo</button>}
        </div>
        <div className="form-grid">
          <Field label="Student ID"><input className="mono" value={form.studentId} onChange={(e) => set('studentId', e.target.value)} placeholder="2026-00123" />{err('studentId')}</Field>
          <Field label="Full name"><input value={form.name} onChange={(e) => set('name', e.target.value)} />{err('name')}</Field>
          <Field label="School email"><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />{err('email')}</Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} />{err('phone')}</Field>
          <Field label="Program"><select value={form.program} onChange={(e) => set('program', e.target.value)}>{PROGRAMS.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Year level"><select value={form.year} onChange={(e) => set('year', e.target.value)}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></Field>
          <Field label="RFID school ID UID" hint="Tap the ID on the enrollment reader or type its UID."><input className="mono" value={form.rfid} onChange={(e) => set('rfid', e.target.value.toUpperCase())} placeholder="04A1B3A0" />{err('rfid')}</Field>
        </div>
      </form>
    </Modal>
  )
}

export function StudentDetail({ id, go }) {
  const s = useStore()
  const [editing, setEditing] = useState(false)
  const student = s.students.find((st) => st.id === id)
  if (!student) return <div className="page"><Empty title="Student not found" /></div>
  const t = now()
  const loans = activeTxForStudent(s, id)
  const history = s.transactions.filter((tx) => tx.studentId === id && tx.returnedAt).sort((a, b) => b.returnedAt - a.returnedAt)
  const faceLogs = s.faceLogs.filter((f) => f.studentId === id).slice(0, 8)
  const bookOf = (tx) => s.titles.find((x) => x.id === s.copies.find((c) => c.id === tx.copyId).titleId)

  const toggleStatus = () => {
    webAction((st) => {
      const x = st.students.find((y) => y.id === id)
      x.status = x.status === 'active' ? 'suspended' : 'active'
      writeLog(st, { user: 'Librarian', action: x.status === 'active' ? 'Account reactivated' : 'Account suspended', studentId: id, result: 'Success' })
    })
  }
  const enroll = () => {
    webAction((st) => {
      st.students.find((y) => y.id === id).face = { templateId: `fv_${Math.random().toString(36).slice(2, 12)}`, enrolledAt: now() }
      writeLog(st, { user: 'Librarian', action: 'Face template enrolled', studentId: id, result: 'Template stored (encrypted)' })
    })
    toast('good', 'Face template enrolled', student.name)
  }
  const deleteFace = () => {
    if (!confirm('Delete this student\'s face template? They will need manual verification until re-enrolled.')) return
    webAction((st) => {
      st.students.find((y) => y.id === id).face = null
      writeLog(st, { user: 'Librarian', action: 'Biometric data deleted', studentId: id, result: 'Template removed' })
    })
    toast('info', 'Face template deleted')
  }

  return (
    <div className="page">
      <button type="button" className="back-link" onClick={() => go('students')}><Icon name="chevron" size={14} className="flip" />All students</button>
      <div className="profile-head">
        <Avatar student={student} size={96} />
        <div>
          <p className="eyebrow mono">{student.studentId}</p>
          <h1>{student.name}</h1>
          <p className="muted">{student.program} · Year {student.year}</p>
          <div className="btn-row">
            <Badge status={student.status} />
            <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}><Icon name="edit" size={15} />Edit</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={toggleStatus}>{student.status === 'active' ? 'Suspend account' : 'Reactivate account'}</button>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <Panel title="Account">
          <dl className="meta-grid">
            <div><dt>RFID UID</dt><dd className="mono">{student.rfid}</dd></div>
            <div><dt>Email</dt><dd>{student.email}</dd></div>
            <div><dt>Phone</dt><dd>{student.phone}</dd></div>
            <div><dt>Active loans</dt><dd>{loans.length} of {s.settings.maxBooks}</dd></div>
          </dl>
        </Panel>
        <Panel title="Facial verification" sub="Restricted: visible to administrators only">
          {student.face ? (
            <>
              <p><Badge status="verified">Template enrolled</Badge> <span className="muted small">on {fmtDate(student.face.enrolledAt)}</span></p>
              <p className="muted small">Only an encrypted face template (<span className="mono">{student.face.templateId}</span>) is stored. No face images are kept.</p>
              <div className="btn-row"><button type="button" className="btn btn-sm btn-ghost btn-danger-text" onClick={deleteFace}><Icon name="trash" size={15} />Delete biometric data</button></div>
            </>
          ) : (
            <>
              <p><Badge status="manual">Not enrolled</Badge></p>
              <p className="muted small">This student is verified manually by a librarian until a template is enrolled.</p>
              <button type="button" className="btn btn-sm" onClick={enroll}><Icon name="face" size={15} />Enroll face (simulated)</button>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Currently borrowed" flush>
        {loans.length === 0 ? <Empty title="No active loans" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Book</th><th>Borrowed</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>{loans.map((tx) => { const d = dueLabel(tx.dueAt, t); return (
              <tr key={tx.id}><td>{bookOf(tx).title}</td><td>{fmtShortDateTime(tx.borrowedAt)}</td><td>{fmtShortDateTime(tx.dueAt)}</td><td><Badge status={d.tone === 'overdue' ? 'overdue' : d.tone === 'soon' ? 'soon' : 'borrowed'}>{d.text}</Badge></td></tr>
            ) })}</tbody>
          </table></div>
        )}
      </Panel>
      <div className="grid-2">
        <Panel title="Borrowing history" flush>
          {history.length === 0 ? <Empty title="No past loans" /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Book</th><th>Borrowed</th><th>Returned</th></tr></thead>
              <tbody>{history.slice(0, 12).map((tx) => <tr key={tx.id}><td>{bookOf(tx).title}</td><td>{fmtShortDate(tx.borrowedAt)}</td><td>{fmtShortDate(tx.returnedAt)}{tx.lateReturn && <Badge status="overdue">Late</Badge>}</td></tr>)}</tbody>
            </table></div>
          )}
        </Panel>
        <Panel title="Verification attempts" sub="Every attempt is logged for audit" flush>
          {faceLogs.length === 0 ? <Empty title="No attempts yet" /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>When</th><th>Context</th><th>Result</th></tr></thead>
              <tbody>{faceLogs.map((f) => <tr key={f.id}><td>{fmtShortDateTime(f.at)}</td><td>{f.context}<span className="sub">{f.device}</span></td><td><Badge status={f.result} />{f.confidence != null && <span className="sub">{Math.round(f.confidence * 100)}%</span>}</td></tr>)}</tbody>
            </table></div>
          )}
        </Panel>
      </div>
      {editing && <StudentForm student={student} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
    </div>
  )
}
