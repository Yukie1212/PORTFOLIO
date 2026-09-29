import { DAY, HOUR, MINUTE, startOfDay } from './time.js'

// Deterministic PRNG so the seeded history looks the same on every reset.
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const CATEGORIES = [
  { id: 'ce', name: 'Computer Engineering' },
  { id: 'net', name: 'Networking' },
  { id: 'prog', name: 'Programming' },
  { id: 'elec', name: 'Electronics' },
  { id: 'math', name: 'Mathematics' },
  { id: 'sci', name: 'Science' },
  { id: 'lit', name: 'Literature' },
  { id: 'ref', name: 'Reference' },
]

// Cover art is generated (colour + motif) unless a librarian uploads an image.
const TITLES = [
  ['Introduction to Computer Engineering', 'Maria Santos', 'ce', 'Rex Book Store', 2024, '#1f5f4b', 'circuit', 2],
  ['Computer Networks', 'Andrew S. Tanenbaum', 'net', 'Pearson', 2021, '#27425a', 'rings', 2],
  ['Digital Design', 'M. Morris Mano', 'ce', 'Pearson', 2018, '#7a3b2e', 'grid', 2],
  ['The C Programming Language', 'Brian W. Kernighan & Dennis M. Ritchie', 'prog', 'Prentice Hall', 1988, '#2d2f33', 'type', 3],
  ['Clean Code', 'Robert C. Martin', 'prog', 'Prentice Hall', 2008, '#3a5a40', 'stripes', 1],
  ['Operating System Concepts', 'Abraham Silberschatz', 'ce', 'Wiley', 2018, '#5b4a8a', 'dino', 2],
  ['Microelectronic Circuits', 'Adel S. Sedra', 'elec', 'Oxford University Press', 2019, '#8a5a12', 'circuit', 1],
  ['The Art of Electronics', 'Paul Horowitz', 'elec', 'Cambridge University Press', 2015, '#6b2f3a', 'wave', 1],
  ['Calculus: Early Transcendentals', 'James Stewart', 'math', 'Cengage', 2020, '#1c4e80', 'curve', 2],
  ['Discrete Mathematics and Its Applications', 'Kenneth H. Rosen', 'math', 'McGraw-Hill', 2018, '#35524a', 'grid', 1],
  ['Engineering Physics', 'Hugh D. Young', 'sci', 'Pearson', 2019, '#4a4e69', 'wave', 2],
  ['Chemistry: The Central Science', 'Theodore L. Brown', 'sci', 'Pearson', 2017, '#84522c', 'rings', 1],
  ['Noli Me Tángere', 'José Rizal', 'lit', 'Penguin Classics', 2006, '#5c1f24', 'stripes', 2],
  ['El Filibusterismo', 'José Rizal', 'lit', 'Penguin Classics', 2011, '#2f3e2f', 'stripes', 1],
  ['Data Communications and Networking', 'Behrouz A. Forouzan', 'net', 'McGraw-Hill', 2012, '#1e5b6b', 'rings', 1],
  ['Python Crash Course', 'Eric Matthes', 'prog', 'No Starch Press', 2023, '#2b4f81', 'type', 2],
  ['Arduino Projects Handbook', 'Mark Geddes', 'elec', 'No Starch Press', 2016, '#1f6f6a', 'circuit', 1],
  ['Oxford Dictionary of Computer Science', 'Andrew Butterfield', 'ref', 'Oxford University Press', 2016, '#243b53', 'type', 1],
  ['Philippine Engineering Standards Handbook', 'PICE Committee', 'ref', 'PICE', 2022, '#3d3d3d', 'grid', 1],
  ['Embedded Systems with ESP32', 'Kolban & Reyes', 'ce', 'Leanpub', 2023, '#4f6d2f', 'circuit', 1],
]

const COPY_RFIDS = {
  'Computer Networks': ['B8239CAF', 'B8239D10'],
  'The C Programming Language': ['A83019FF', 'A8301A22', 'A8301B91'],
  'Digital Design': ['C1D20A44', 'C1D20A91'],
}

const SHELVES = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'D1', 'R1']

const hex = (rand, n = 8) => Array.from({ length: n }, () => '0123456789ABCDEF'[Math.floor(rand() * 16)]).join('')

const STUDENTS = [
  ['2026-00123', 'Juan Dela Cruz', 'BS Computer Engineering', 4, '04A1B2C3'],
  ['2026-00124', 'Maria Clara Reyes', 'BS Computer Engineering', 3, '04A1B2C4'],
  ['2026-00131', 'Jose Mercado', 'BS Information Technology', 2, '04A1B2D1'],
  ['2026-00142', 'Andrea Villanueva', 'BS Electronics Engineering', 4, '04A1B2E2'],
  ['2026-00156', 'Paolo Bautista', 'BS Computer Science', 1, '04A1B2F6'],
  ['2026-00160', 'Katrina Lim', 'BS Civil Engineering', 2, '04A1B300'],
  ['2026-00177', 'Miguel Santos', 'BS Computer Engineering', 3, '04A1B317'],
  ['2026-00183', 'Bea Gonzales', 'BS Information Technology', 1, '04A1B323'],
  ['2026-00194', 'Carlo Ramos', 'BS Electronics Engineering', 2, '04A1B334'],
  ['2026-00201', 'Isabel Navarro', 'BS Computer Science', 4, '04A1B341'],
  ['2026-00215', 'Rafael Torres', 'BS Mechanical Engineering', 3, '04A1B355'],
  ['2026-00222', 'Lara Mendoza', 'BS Computer Engineering', 1, '04A1B362'],
]

export const DEFAULT_SETTINGS = {
  durations: [1, 3, 7, 14],
  maxDays: 14,
  maxBooks: 3,
  graceHours: 1,
  renewalLimit: 2,
  blockWhenOverdue: true,
  requireFace: true,
  faceThreshold: 0.8,
  categoryRules: {
    ref: { maxDays: 1, renewable: false, lendable: true },
    lit: { maxDays: 14, renewable: true, lendable: true },
  },
  reminders: [
    { id: 'd-3', offsetDays: -3, label: '3 days before', enabled: false },
    { id: 'd-1', offsetDays: -1, label: '1 day before', enabled: true },
    { id: 'd0', offsetDays: 0, label: 'On the due date', enabled: true },
    { id: 'd+1', offsetDays: 1, label: '1 day overdue', enabled: true },
    { id: 'd+3', offsetDays: 3, label: '3 days overdue', enabled: true },
    { id: 'd+7', offsetDays: 7, label: '7 days overdue', enabled: false },
  ],
  channels: { email: true, sms: true, inapp: true },
}

export const DEVICES = [
  { id: 'BORROW-01', name: 'Borrowing station', type: 'Borrow kiosk (Raspberry Pi 5 + RC522 + camera)', location: 'Circulation desk', key: 'dev_live_7f3a' },
  { id: 'RETURN-01', name: 'Return station', type: 'Return kiosk (Raspberry Pi 4 + UHF reader)', location: 'Book drop', key: 'dev_live_19c2' },
  { id: 'EXIT-01', name: 'Exit gate', type: 'Turnstile controller (ESP32 + UHF gate antennas)', location: 'Main exit', key: 'dev_live_c08e' },
  { id: 'CAM-01', name: 'Gate camera', type: 'IP camera (face capture)', location: 'Main exit', key: 'dev_live_5b61' },
  { id: 'ENTRY-01', name: 'Entrance reader', type: 'RFID ID reader (Arduino + PN532)', location: 'Main entrance', key: 'dev_live_a4d9' },
]

export function createSeed(now = Date.now()) {
  const rand = mulberry32(20260910)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  let n = 0
  const id = (p) => `${p}_${(++n).toString(36)}`

  const titles = []
  const copies = []
  TITLES.forEach(([title, author, category, publisher, year, color, motif, count], i) => {
    const titleId = `t${i + 1}`
    titles.push({
      id: titleId, title, author, category, publisher, year,
      isbn: `978-${Math.floor(rand() * 9) + 1}-${String(Math.floor(rand() * 99999)).padStart(5, '0')}-${String(Math.floor(rand() * 999)).padStart(3, '0')}-${Math.floor(rand() * 9)}`,
      description: `${title} by ${author}. A core ${CATEGORIES.find((c) => c.id === category).name.toLowerCase()} title kept in the circulation collection.`,
      cover: { color, motif, image: null },
      addedAt: startOfDay(now) - Math.floor(200 + rand() * 500) * DAY,
      archived: false,
    })
    const rfids = COPY_RFIDS[title] ?? []
    for (let c = 0; c < count; c++) {
      copies.push({
        id: `${titleId}-c${c + 1}`, titleId, copyNo: String(c + 1).padStart(3, '0'),
        rfid: rfids[c] ?? hex(rand), shelf: `${pick(SHELVES)}-${String(Math.floor(rand() * 40) + 1).padStart(2, '0')}`,
        status: 'available',
      })
    }
  })
  // One copy in maintenance and one lost, so every status appears.
  copies.find((c) => c.titleId === 't12').status = 'maintenance'
  copies.find((c) => c.titleId === 't8').status = 'lost'

  const students = STUDENTS.map(([studentId, name, program, year, rfid], i) => ({
    id: `s${i + 1}`, studentId, name, program, year, rfid,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@school.edu.ph`,
    phone: `+63 9${String(10 + i).padStart(2, '0')} ${String(100 + i * 7).padStart(3, '0')} ${String(4000 + i * 13).padStart(4, '0')}`,
    photo: null,
    face: i === 11 ? null : { templateId: `fv_${hex(rand, 10).toLowerCase()}`, enrolledAt: now - (120 + i) * DAY },
    status: i === 9 ? 'suspended' : 'active',
  }))

  const transactions = []
  const borrowedCopy = new Set()

  // History: returned loans spread over the last 60 days.
  for (let d = 60; d >= 2; d--) {
    const perDay = Math.floor(rand() * 4) + (d % 7 === 0 || d % 7 === 6 ? 0 : 1)
    for (let k = 0; k < perDay; k++) {
      const copy = pick(copies.filter((c) => c.status === 'available'))
      const student = pick(students.slice(0, 9))
      const duration = pick([1, 3, 7, 7, 14])
      const borrowedAt = startOfDay(now) - d * DAY + (8 + Math.floor(rand() * 9)) * HOUR + Math.floor(rand() * 59) * MINUTE
      const dueAt = borrowedAt + duration * DAY
      const late = rand() < 0.15
      const returnedAt = late ? dueAt + Math.floor(1 + rand() * 3) * DAY : borrowedAt + Math.floor(rand() * duration * 0.9 * DAY)
      if (returnedAt > now - HOUR) continue
      transactions.push({ id: id('tx'), copyId: copy.id, studentId: student.id, borrowedAt, dueAt, duration, returnedAt, renewals: 0, status: 'returned', device: 'BORROW-01', returnDevice: 'RETURN-01', lateReturn: late })
    }
  }

  // Active loans chosen to show every countdown state.
  const active = [
    ['s1', 't1', -6 * DAY, 7, 0], // Juan: Introduction to Computer Engineering, due tomorrow
    ['s2', 't3', -3 * DAY, 3, 0], // due today
    ['s3', 't6', -9 * DAY, 7, 0], // 2 days overdue
    ['s4', 't9', -2 * DAY, 14, 0], // 12 days remaining
    ['s5', 't16', -4 * DAY, 7, 1], // renewed once
    ['s7', 't11', -12 * DAY, 7, 0], // 5 days overdue
    ['s2', 't13', -1 * DAY, 3, 0], // due in 2 days
    ['s8', 't4', -5 * DAY, 7, 0],
  ]
  active.forEach(([studentId, titleId, ago, duration, renewals]) => {
    const copy = copies.find((c) => c.titleId === titleId && c.status === 'available' && !borrowedCopy.has(c.id))
    borrowedCopy.add(copy.id)
    const borrowedAt = Math.floor((now + ago) / HOUR) * HOUR
    const dueAt = borrowedAt + (duration + renewals * duration) * DAY
    copy.status = 'borrowed'
    transactions.push({ id: id('tx'), copyId: copy.id, studentId, borrowedAt, dueAt, duration, returnedAt: null, renewals, status: dueAt < now ? 'overdue' : 'active', device: 'BORROW-01' })
  })

  const heldCopy = copies.find((c) => c.titleId === 't3' && c.status === 'available')
  heldCopy.status = 'reserved'
  const reservations = [{ id: id('rs'), titleId: 't3', studentId: 's6', createdAt: now - 20 * HOUR, copyId: heldCopy.id, readyAt: now - 20 * HOUR, expiresAt: now + 28 * HOUR }]

  // A renewal request waiting for the librarian (Maria Clara Reyes · Noli Me Tángere).
  const noliTx = transactions.find((tx) => tx.studentId === 's2' && tx.returnedAt == null && copies.find((c) => c.id === tx.copyId).titleId === 't13')
  const renewalRequests = [{ id: id('rr'), txId: noliTx.id, studentId: 's2', copyId: noliTx.copyId, requestedAt: now - 40 * MINUTE, currentDueAt: noliTx.dueAt, proposedDueAt: noliTx.dueAt + noliTx.duration * DAY, status: 'pending' }]

  // Gate history over the last two weeks.
  const gateEvents = []
  for (let d = 14; d >= 0; d--) {
    const exits = Math.floor(rand() * 5) + 2
    for (let k = 0; k < exits; k++) {
      const tx = pick(transactions)
      const at = startOfDay(now) - d * DAY + (8 + Math.floor(rand() * 10)) * HOUR + Math.floor(rand() * 3599) * 1000
      if (at > now) continue
      gateEvents.push({ id: id('ge'), at, gate: 'EXIT-01', rfid: copies.find((c) => c.id === tx.copyId).rfid, copyId: tx.copyId, studentId: tx.studentId, result: 'allowed', reason: 'Active borrowing transaction' })
    }
    if (rand() < 0.45) {
      const copy = pick(copies.filter((c) => !borrowedCopy.has(c.id)))
      const at = startOfDay(now) - d * DAY + (9 + Math.floor(rand() * 8)) * HOUR + Math.floor(rand() * 3599) * 1000
      if (at < now) gateEvents.push({ id: id('ge'), at, gate: 'EXIT-01', rfid: copy.rfid, copyId: copy.id, studentId: null, result: 'alarm', reason: `Book is ${copy.status === 'borrowed' ? 'borrowed by another student' : copy.status}`, resolved: d > 1, resolution: d > 1 ? 'Book recovered at the gate; student returned to the circulation desk.' : '' })
    }
  }
  gateEvents.sort((a, b) => b.at - a.at)

  const securityEvents = gateEvents.filter((g) => g.result !== 'allowed').map((g) => g.id)

  const faceLogs = transactions.slice(-40).map((tx) => ({
    id: id('fv'), at: tx.borrowedAt - 40 * 1000, studentId: tx.studentId, context: 'Borrowing', device: 'BORROW-01',
    result: rand() < 0.9 ? 'verified' : 'manual', confidence: Math.round((0.82 + rand() * 0.16) * 100) / 100,
  }))
  faceLogs.push({ id: id('fv'), at: now - 26 * HOUR, studentId: 's3', context: 'Borrowing', device: 'BORROW-01', result: 'failed', confidence: 0.41 })

  const logs = []
  const log = (at, user, action, device, copyId, studentId, result) => logs.push({ id: id('lg'), at, user, action, device, copyId, studentId, result })
  transactions.forEach((tx) => {
    log(tx.borrowedAt, 'Student', 'Book borrowed', tx.device, tx.copyId, tx.studentId, 'Success')
    if (tx.returnedAt) log(tx.returnedAt, 'Student', 'Book returned', tx.returnDevice, tx.copyId, tx.studentId, tx.lateReturn ? 'Returned late' : 'On time')
  })
  gateEvents.forEach((g) => log(g.at, 'EXIT-01', g.result === 'allowed' ? 'Authorized exit' : 'RFID turnstile alarm activated', g.gate, g.copyId, g.studentId, g.result === 'allowed' ? 'Exit allowed' : 'Alarm'))
  log(now - 30 * DAY, 'Librarian', 'Book created', 'Web', 't20-c1', null, 'Success')
  log(now - 30 * DAY + 5 * MINUTE, 'Librarian', 'RFID assigned', 'Web', 't20-c1', null, 'Success')
  logs.sort((a, b) => b.at - a.at)

  return {
    version: 2,
    clockOffset: 0,
    settings: structuredClone(DEFAULT_SETTINGS),
    categories: CATEGORIES,
    titles, copies, students, transactions, reservations, renewalRequests, gateEvents, securityEvents,
    notifications: [], notificationLogs: [], sentReminders: {}, faceLogs, logs,
    devices: DEVICES.map((d, i) => ({ ...d, status: i === 4 ? 'offline' : 'online', lastSeen: now - (i === 4 ? 3 * HOUR : Math.floor(rand() * 90) * 1000) })),
    scanHistory: [],
  }
}
