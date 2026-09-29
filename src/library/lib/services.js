import { bus, toast } from './bus.js'
import {
  activeTxForCopy, activeTxForStudent, categoryName, copyById, copyByRfid, now, store,
  studentById, studentByRfid, titleById,
} from './store.js'
import { DAY, HOUR, MINUTE, fmtDate, fmtDateTime, fmtTime, startOfDay } from './time.js'

// Service layer. Every hardware device goes through `api.request()`, which
// authenticates the device key, rate-limits, validates input and then calls
// the same services the librarian web app uses. Nothing touches the store
// except these services, so the website, stations, readers and turnstile
// always share one current book status.

const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// ---------- Logging & notifications ----------
function log(s, entry) {
  s.logs.unshift({ id: uid('lg'), at: now(), user: 'System', device: 'Web', copyId: null, studentId: null, result: 'Success', ...entry })
  if (s.logs.length > 1500) s.logs.length = 1500
}

function notify(s, { audience, studentId = null, kind, title, body, channels, silent = false, tone = 'info' }) {
  const enabled = s.settings.channels
  const via = audience === 'student'
    ? (channels ?? ['email', 'sms', 'inapp']).filter((c) => enabled[c])
    : ['inapp']
  const n = { id: uid('nt'), at: now(), audience, studentId, kind, title, body, channels: via, read: false }
  s.notifications.unshift(n)
  if (s.notifications.length > 600) s.notifications.length = 600
  if (audience === 'student') {
    const student = studentById(s, studentId)
    via.filter((c) => c !== 'inapp').forEach((channel) => {
      s.notificationLogs.unshift({
        id: uid('nl'), at: now(), notificationId: n.id, channel, studentId, kind,
        to: channel === 'email' ? student?.email : student?.phone, status: 'Delivered', provider: channel === 'email' ? 'SMTP (simulated)' : 'SMS gateway (simulated)',
      })
    })
    if (via.length) log(s, { user: 'Notification service', action: 'Reminder sent', device: 'Scheduler', studentId, result: `${title} · ${via.join(', ')}` })
  }
  if (!silent) bus.emit('notification', n)
  if (!silent && audience === 'librarian') toast(tone, title, body)
  return n
}

// ---------- Rules ----------
export function borrowRules(s, copy) {
  const title = titleById(s, copy.titleId)
  const rule = s.settings.categoryRules[title.category] ?? {}
  const maxDays = Math.min(s.settings.maxDays, rule.maxDays ?? s.settings.maxDays)
  return { maxDays, durations: s.settings.durations.filter((d) => d <= maxDays), renewable: rule.renewable ?? true, lendable: rule.lendable ?? true }
}

export function studentProblems(s, student) {
  const problems = []
  if (!student) return ['Card not registered to any student.']
  if (student.status !== 'active') problems.push('Student account is suspended. Please see the librarian.')
  const open = activeTxForStudent(s, student.id)
  if (open.length >= s.settings.maxBooks) problems.push(`Borrowing limit reached (${s.settings.maxBooks} books).`)
  if (s.settings.blockWhenOverdue && open.some((tx) => now() > tx.dueAt)) problems.push('Student has an overdue book. Return it before borrowing again.')
  return problems
}

export function copyProblems(s, copy, student) {
  if (!copy) return ['Unknown RFID tag. This tag is not assigned to any book copy.']
  const problems = []
  const title = titleById(s, copy.titleId)
  if (title.archived || copy.status === 'archived') problems.push('This copy is archived.')
  if (copy.status === 'borrowed') problems.push('This copy is already borrowed.')
  if (copy.status === 'lost') problems.push('This copy is marked lost.')
  if (copy.status === 'maintenance') problems.push('This copy is under maintenance.')
  if (copy.status === 'reserved') {
    const res = s.reservations.find((r) => r.titleId === copy.titleId)
    if (!res || res.studentId !== student?.id) problems.push('This copy is on hold for another student.')
  }
  if (!borrowRules(s, copy).lendable) problems.push(`${categoryName(s, title.category)} books cannot be borrowed.`)
  return problems
}

export function renewProblems(s, tx) {
  const copy = copyById(s, tx.copyId)
  const student = studentById(s, tx.studentId)
  const problems = []
  if (tx.returnedAt) problems.push('This loan is already closed.')
  if (student.status !== 'active') problems.push('Your account is suspended.')
  if (tx.renewals >= s.settings.renewalLimit) problems.push(`Renewal limit reached (${s.settings.renewalLimit}).`)
  if (!borrowRules(s, copy).renewable) problems.push('Books in this category cannot be renewed.')
  if (s.reservations.some((r) => r.titleId === copy.titleId && r.studentId !== tx.studentId)) problems.push('Another student has reserved this book.')
  if (now() > tx.dueAt + s.settings.graceHours * HOUR) problems.push('Overdue books must be returned, not renewed.')
  return problems
}

// ---------- Scan tracking (suspicious repeated scans) ----------
function trackScan(s, uidValue, device) {
  const t = now()
  s.scanHistory = (s.scanHistory ?? []).filter((x) => t - x.at < MINUTE)
  s.scanHistory.push({ uid: uidValue, device, at: t })
  const repeats = s.scanHistory.filter((x) => x.uid === uidValue).length
  if (repeats === 4) {
    notify(s, { audience: 'librarian', kind: 'suspicious', tone: 'warn', title: 'Suspicious repeated RFID scans', body: `Tag ${uidValue} was scanned ${repeats} times in under a minute at ${device}.` })
    log(s, { user: device, action: 'Suspicious repeated RFID scans', device, result: `${repeats} scans / 60 s` })
  }
}

// ---------- Core services ----------
export const services = {
  studentScan(s, { uid: tag, device }) {
    trackScan(s, tag, device)
    const student = studentByRfid(s, tag)
    log(s, { user: device, action: 'Student RFID scanned', device, studentId: student?.id ?? null, result: student ? 'Identified' : `Unknown card ${tag}` })
    if (!student) return { status: 404, body: { error: 'Card not registered.', uid: tag } }
    if (student.status !== 'active') notify(s, { audience: 'librarian', kind: 'account', tone: 'warn', title: 'Student account problem', body: `${student.name} (${student.studentId}) tapped a suspended card at ${device}.` })
    return { status: 200, body: { student: publicStudent(student), problems: studentProblems(s, student), activeLoans: activeTxForStudent(s, student.id).length } }
  },

  bookScan(s, { uid: tag, device }) {
    trackScan(s, tag, device)
    const copy = copyByRfid(s, tag)
    log(s, { user: device, action: 'Book RFID scanned', device, copyId: copy?.id ?? null, result: copy ? 'Identified' : `Unknown tag ${tag}` })
    if (!copy) return { status: 404, body: { error: 'Unknown RFID tag.', uid: tag } }
    const tx = activeTxForCopy(s, copy.id)
    return { status: 200, body: { copy, title: titleById(s, copy.titleId), activeTransaction: tx ?? null } }
  },

  facialVerification(s, { studentId, outcome, context = 'Borrowing', device = 'BORROW-01', manualBy = null }) {
    const student = studentById(s, studentId)
    if (!student) return { status: 404, body: { error: 'Student not found.' } }
    let result
    let confidence = null
    if (manualBy) {
      result = 'manual'
    } else if (!student.face) {
      result = 'manual-required'
    } else if (outcome === 'no-camera' || outcome === 'no-face') {
      result = 'manual-required'
    } else {
      confidence = outcome === 'match' ? 0.9 + Math.random() * 0.08 : 0.3 + Math.random() * 0.25
      confidence = Math.round(confidence * 100) / 100
      result = confidence >= s.settings.faceThreshold ? 'verified' : 'failed'
    }
    s.faceLogs.unshift({ id: uid('fv'), at: now(), studentId, context, device, result: result === 'manual-required' ? 'manual' : result, confidence, approvedBy: manualBy })
    const action = { verified: 'Facial verification succeeded', failed: 'Facial verification failed', manual: 'Librarian manually approved transaction', 'manual-required': 'Manual verification required' }[result]
    log(s, { user: manualBy ?? device, action, device, studentId, result: confidence != null ? `Confidence ${Math.round(confidence * 100)}%` : (manualBy ? 'Approved' : outcome ?? 'No template') })
    if (result === 'failed') notify(s, { audience: 'librarian', kind: 'face', tone: 'warn', title: 'Failed facial verification', body: `${student.name}'s card was used at ${device} but the face did not match (${Math.round(confidence * 100)}%).` })
    return { status: 200, body: { result, confidence, reason: result === 'manual-required' ? (student.face ? 'Camera unavailable or no face detected.' : 'No facial reference enrolled.') : null } }
  },

  borrow(s, { studentId, copyId, days, verification, device = 'BORROW-01', user = 'Student' }) {
    const student = studentById(s, studentId)
    const copy = copyById(s, copyId)
    const problems = [...studentProblems(s, student), ...copyProblems(s, copy, student)]
    if (s.settings.requireFace && !['verified', 'manual'].includes(verification)) problems.push('Identity has not been verified.')
    const rules = copy && borrowRules(s, copy)
    if (rules && !rules.durations.includes(Number(days))) problems.push(`Choose a borrowing period of up to ${rules.maxDays} day${rules.maxDays === 1 ? '' : 's'}.`)
    if (problems.length) return { status: 422, body: { error: problems[0], problems } }
    const t = now()
    const tx = { id: uid('tx'), copyId, studentId, borrowedAt: t, dueAt: t + days * DAY, duration: Number(days), returnedAt: null, renewals: 0, status: 'active', device, verification }
    s.transactions.push(tx)
    copy.status = 'borrowed'
    s.reservations = s.reservations.filter((r) => !(r.titleId === copy.titleId && r.studentId === studentId))
    const title = titleById(s, copy.titleId)
    log(s, { user, action: 'Book borrowed', device, copyId, studentId, result: `Due ${fmtDateTime(tx.dueAt)}` })
    notify(s, { audience: 'student', studentId, kind: 'borrowed', title: 'Borrowing confirmed', body: `You borrowed '${title.title}'. Please return it by ${fmtDate(tx.dueAt)} at ${fmtTime(tx.dueAt)}.`, channels: ['email', 'inapp'] })
    return { status: 201, body: { transaction: tx, gateAuthorized: true } }
  },

  returnBook(s, { copyId, studentId = null, device = 'RETURN-01', user = 'Student', condition = 'good' }) {
    const copy = copyById(s, copyId)
    if (!copy) return { status: 404, body: { error: 'Unknown book copy.' } }
    const tx = activeTxForCopy(s, copyId)
    if (!tx) return { status: 409, body: { error: 'This copy has no active borrowing transaction.' } }
    if (studentId && tx.studentId !== studentId) return { status: 409, body: { error: 'This book was borrowed by a different student. Please see the librarian.' } }
    const t = now()
    tx.returnedAt = t
    tx.returnDevice = device
    tx.lateReturn = t > tx.dueAt + s.settings.graceHours * HOUR
    tx.status = 'returned'
    const reservation = s.reservations.find((r) => r.titleId === copy.titleId)
    copy.status = condition === 'damaged' ? 'maintenance' : reservation ? 'reserved' : 'available'
    const title = titleById(s, copy.titleId)
    log(s, { user, action: 'Book returned', device, copyId, studentId: tx.studentId, result: tx.lateReturn ? 'Returned late' : 'On time' })
    notify(s, { audience: 'student', studentId: tx.studentId, kind: 'returned', title: 'Return received', body: `Thanks! '${title.title}' was returned ${tx.lateReturn ? 'late' : 'on time'} on ${fmtDateTime(t)}.`, channels: ['email', 'inapp'] })
    if (reservation && copy.status === 'reserved') notify(s, { audience: 'student', studentId: reservation.studentId, kind: 'reserved', title: 'Your reserved book is ready', body: `'${title.title}' is on the hold shelf for you. Borrow it at the circulation desk.` })
    return { status: 200, body: { transaction: tx, onTime: !tx.lateReturn, copyStatus: copy.status } }
  },

  renew(s, { txId, user = 'Student' }) {
    const tx = s.transactions.find((x) => x.id === txId)
    if (!tx) return { status: 404, body: { error: 'Loan not found.' } }
    const problems = renewProblems(s, tx)
    if (problems.length) return { status: 422, body: { error: problems[0], problems } }
    tx.renewals += 1
    tx.dueAt += tx.duration * DAY
    tx.status = 'active'
    const title = titleById(s, copyById(s, tx.copyId).titleId)
    log(s, { user, action: 'Book renewed', device: 'Web', copyId: tx.copyId, studentId: tx.studentId, result: `New due date ${fmtDateTime(tx.dueAt)}` })
    notify(s, { audience: 'student', studentId: tx.studentId, kind: 'renewed', title: 'Renewal confirmed', body: `'${title.title}' is now due ${fmtDate(tx.dueAt)} at ${fmtTime(tx.dueAt)}.`, channels: ['email', 'inapp'] })
    return { status: 200, body: { transaction: tx } }
  },

  /** The core RFID rule: a copy may exit only with an active, valid loan. */
  gateCheck(s, { rfid, gate = 'EXIT-01', personStudentId = null }) {
    trackScan(s, rfid, gate)
    const copy = copyByRfid(s, rfid)
    const t = now()
    let event
    if (!copy) {
      event = { result: 'unknown', reason: 'Unknown RFID tag', copyId: null, studentId: personStudentId }
    } else {
      const tx = activeTxForCopy(s, copy.id)
      if (tx && (!personStudentId || personStudentId === tx.studentId)) {
        event = { result: 'allowed', reason: 'Active borrowing transaction', copyId: copy.id, studentId: tx.studentId, txId: tx.id }
      } else if (tx) {
        event = { result: 'alarm', reason: 'Borrowed by another student', copyId: copy.id, studentId: personStudentId, borrowerId: tx.studentId }
      } else {
        event = { result: 'alarm', reason: `Not checked out (status: ${copy.status})`, copyId: copy.id, studentId: personStudentId }
      }
    }
    const record = { id: uid('ge'), at: t, gate, rfid: String(rfid).toUpperCase(), camera: event.result === 'allowed' ? null : 'CAM-01 frame captured', resolved: false, resolution: '', ...event }
    s.gateEvents.unshift(record)
    if (event.result === 'allowed') {
      log(s, { user: gate, action: 'Authorized exit', device: gate, copyId: copy.id, studentId: event.studentId, result: 'Exit allowed' })
    } else {
      s.securityEvents.unshift(record.id)
      const title = copy && titleById(s, copy.titleId)
      log(s, { user: gate, action: event.result === 'unknown' ? 'Unknown RFID at exit' : 'RFID turnstile alarm activated', device: gate, copyId: copy?.id ?? null, studentId: event.studentId, result: 'Alarm · gate locked' })
      notify(s, {
        audience: 'librarian', kind: 'alarm', tone: 'danger',
        title: event.result === 'unknown' ? 'Unknown RFID tag at exit' : 'Unauthorized book exit',
        body: event.result === 'unknown' ? `Tag ${record.rfid} detected at ${gate}.` : `'${title.title}' (${record.rfid}) · ${event.reason}. ${gate} locked.`,
      })
      bus.emit('alarm', record)
    }
    return { status: 200, body: { decision: event.result === 'allowed' ? 'ALLOW_EXIT' : 'ALARM', gateAction: event.result === 'allowed' ? 'unlock' : 'lock', event: record } }
  },

  gateAlarm(s, { gate = 'EXIT-01', rfid = '', reason = 'Manual alarm from controller' }) {
    const record = { id: uid('ge'), at: now(), gate, rfid, copyId: null, studentId: null, result: 'alarm', reason, resolved: false, resolution: '' }
    s.gateEvents.unshift(record)
    s.securityEvents.unshift(record.id)
    log(s, { user: gate, action: 'RFID turnstile alarm activated', device: gate, result: reason })
    notify(s, { audience: 'librarian', kind: 'alarm', tone: 'danger', title: 'Turnstile alarm', body: `${gate}: ${reason}` })
    bus.emit('alarm', record)
    return { status: 201, body: { event: record } }
  },

  sendReminderNow(s, txId) {
    const tx = s.transactions.find((x) => x.id === txId)
    const title = titleById(s, copyById(s, tx.copyId).titleId)
    const overdue = now() > tx.dueAt
    notify(s, { audience: 'student', studentId: tx.studentId, kind: overdue ? 'overdue' : 'reminder', title: overdue ? 'Library Overdue Notice' : 'Library Reminder', body: reminderText(title.title, tx.dueAt, overdue ? 1 : -1) })
  },
}

const publicStudent = (st) => ({ id: st.id, studentId: st.studentId, name: st.name, program: st.program, year: st.year, status: st.status, faceEnrolled: Boolean(st.face) })

export function reminderText(title, dueAt, offsetDays) {
  if (offsetDays > 0) return `Library Overdue Notice: Your borrowed book '${title}' was due on ${fmtDate(dueAt)} at ${fmtTime(dueAt)}. Please return the book to the library as soon as possible.`
  if (offsetDays === 0) return `Library Reminder: Your borrowed book '${title}' is due today, ${fmtDate(dueAt)} at ${fmtTime(dueAt)}. Please return or renew the book before the deadline.`
  const when = offsetDays === -1 ? 'tomorrow' : `in ${-offsetDays} days`
  return `Library Reminder: Your borrowed book '${title}' is due ${when}, ${fmtDate(dueAt)} at ${fmtTime(dueAt)}. Please return or renew the book before the deadline.`
}

/**
 * Scheduler: marks loans overdue and sends reminders on the configured
 * schedule. Idempotent, so it can run every few seconds (a cron job in
 * production). `silent` backfills a fresh seed without popping toasts.
 */
export function runScheduler(silent = false) {
  store.update((s) => {
    const t = now()
    const sent = s.sentReminders
    s.transactions.filter((tx) => tx.returnedAt == null).forEach((tx) => {
      const copy = copyById(s, tx.copyId)
      const title = titleById(s, copy.titleId)
      const student = studentById(s, tx.studentId)
      if (t > tx.dueAt + s.settings.graceHours * HOUR && tx.status !== 'overdue') {
        tx.status = 'overdue'
        log(s, { user: 'Scheduler', action: 'Book overdue', device: 'Scheduler', copyId: copy.id, studentId: tx.studentId, result: `Due ${fmtDateTime(tx.dueAt)}` })
        notify(s, { audience: 'librarian', kind: 'overdue', tone: 'warn', silent, title: 'Book overdue', body: `'${title.title}' borrowed by ${student.name} was due ${fmtDateTime(tx.dueAt)}.` })
      }
      s.settings.reminders.filter((r) => r.enabled).forEach((r) => {
        const key = `${tx.id}:${r.id}:${tx.dueAt}`
        const at = r.offsetDays === 0 ? startOfDay(tx.dueAt) + 7 * HOUR : tx.dueAt + r.offsetDays * DAY
        if (sent[key] || t < at || at < tx.borrowedAt) return
        sent[key] = t
        if (t - at > DAY) return // Missed window (e.g. clock jumped): don't spam stale reminders.
        notify(s, { audience: 'student', studentId: tx.studentId, kind: r.offsetDays > 0 ? 'overdue' : 'reminder', silent, title: r.offsetDays > 0 ? 'Library Overdue Notice' : 'Library Reminder', body: reminderText(title.title, tx.dueAt, r.offsetDays) })
      })
    })
    const dayKey = `due-today:${startOfDay(t)}`
    if (!sent[dayKey]) {
      sent[dayKey] = t
      const dueToday = s.transactions.filter((tx) => tx.returnedAt == null && startOfDay(tx.dueAt) === startOfDay(t))
      if (dueToday.length) notify(s, { audience: 'librarian', kind: 'due-today', silent, title: `${dueToday.length} book${dueToday.length === 1 ? '' : 's'} due today`, body: dueToday.map((tx) => titleById(s, copyById(s, tx.copyId).titleId).title).join(', ') })
    }
  })
}

// ---------- API gateway for hardware ----------
const rate = new Map()
const ROUTES = [
  ['POST', /^\/api\/rfid\/student-scan$/, 'studentScan', ['uid']],
  ['POST', /^\/api\/rfid\/book-scan$/, 'bookScan', ['uid']],
  ['POST', /^\/api\/facial-verification$/, 'facialVerification', ['studentId']],
  ['POST', /^\/api\/borrow$/, 'borrow', ['studentId', 'copyId', 'days']],
  ['POST', /^\/api\/return$/, 'returnBook', ['copyId']],
  ['POST', /^\/api\/gate\/check$/, 'gateCheck', ['rfid']],
  ['POST', /^\/api\/gate\/alarm$/, 'gateAlarm', []],
  ['GET', /^\/api\/books\/([A-Za-z0-9]+)$/, 'getBook', []],
  ['GET', /^\/api\/students\/([A-Za-z0-9]+)$/, 'getStudent', []],
]

export const API_DOCS = [
  ['POST', '/api/rfid/student-scan', 'Identify a student from their RFID school ID.', { uid: '04A1B2C3' }],
  ['POST', '/api/rfid/book-scan', 'Identify a physical book copy from its RFID tag.', { uid: 'B8239CAF' }],
  ['POST', '/api/facial-verification', 'Compare the live capture with the enrolled reference.', { studentId: 's1', outcome: 'match', context: 'Borrowing' }],
  ['POST', '/api/borrow', 'Create a borrowing transaction and authorize the tag at the exit.', { studentId: 's1', copyId: 't2-c1', days: 7, verification: 'verified' }],
  ['POST', '/api/return', 'Close the active transaction for a copy.', { copyId: 't2-c1' }],
  ['POST', '/api/gate/check', 'Exit reader asks whether a detected tag may leave.', { rfid: 'B8239CAF' }],
  ['POST', '/api/gate/alarm', 'Turnstile controller raises a manual alarm.', { reason: 'Gate forced open' }],
  ['GET', '/api/books/{rfid}', 'Look up a book copy by RFID UID.', null],
  ['GET', '/api/students/{rfid}', 'Look up a student by RFID UID.', null],
]

export const api = {
  /** Simulated HTTP call from a device: `{ status, body }`. */
  request(method, path, body = {}, { device, key } = {}) {
    const s = store.get()
    const dev = s.devices.find((d) => d.id === device)
    if (!dev || dev.key !== key) return { status: 401, body: { error: 'Invalid or missing device API key.' } }
    const t = Date.now()
    const window = (rate.get(device) ?? []).filter((x) => t - x < MINUTE)
    window.push(t)
    rate.set(device, window)
    if (window.length > 60) return { status: 429, body: { error: 'Rate limit exceeded (60 requests per minute per device).' } }
    const route = ROUTES.find(([m, re]) => m === method && re.test(path))
    if (!route) return { status: 404, body: { error: `No route for ${method} ${path}` } }
    const [, re, handler, required] = route
    const missing = required.filter((f) => body?.[f] == null || body[f] === '')
    if (missing.length) return { status: 422, body: { error: `Missing field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` } }
    if (body?.uid && !/^[A-Fa-f0-9]{8,14}$/.test(body.uid)) return { status: 422, body: { error: 'RFID UID must be 8–14 hex characters.' } }
    let res
    store.update((st) => {
      const d = st.devices.find((x) => x.id === device)
      d.lastSeen = now()
      d.status = 'online'
      if (handler === 'getBook') {
        const copy = copyByRfid(st, path.match(re)[1])
        res = copy ? { status: 200, body: { copy, title: titleById(st, copy.titleId), activeTransaction: activeTxForCopy(st, copy.id) ?? null } } : { status: 404, body: { error: 'Unknown RFID tag.' } }
      } else if (handler === 'getStudent') {
        const student = studentByRfid(st, path.match(re)[1])
        res = student ? { status: 200, body: { student: publicStudent(student) } } : { status: 404, body: { error: 'Card not registered.' } }
      } else {
        res = services[handler](st, { ...body, device: body.device ?? device, gate: body.gate ?? device })
      }
    })
    return res
  },
  deviceKey: (device) => store.get().devices.find((d) => d.id === device)?.key,
}

/** Convenience for stations: call the API as the named device. */
export const deviceCall = (device, method, path, body) => api.request(method, path, body, { device, key: api.deviceKey(device) })

/** Librarian (web session) actions go through the same services. */
export function webAction(fn) {
  let res
  store.update((s) => {
    res = fn(s)
  })
  return res
}

export { log as writeLog, notify }
