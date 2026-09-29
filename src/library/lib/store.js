import { useSyncExternalStore } from 'react'
import { createSeed } from './seed.js'

// Single source of truth for the demo. In production this is the database
// behind the API; here it lives in the browser so the demo runs on GitHub Pages.
const STORAGE_KEY = 'smart-library-demo-v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.version === 2) return parsed
    }
  } catch {
    // Storage blocked (private mode, sandbox): fall back to a fresh seed.
  }
  return null
}

let state = load() ?? createSeed()
let fresh = !load()
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota or blocked storage: the demo keeps working in memory.
  }
}

// Another tab (e.g. the student portal) changed the data: pick it up here.
try {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return
    try {
      const next = JSON.parse(e.newValue)
      if (next?.version !== 2) return
      state = next
      listeners.forEach((fn) => fn())
    } catch {
      // Ignore a half-written value.
    }
  })
} catch {
  // No window (tests): nothing to sync.
}

export const store = {
  get: () => state,
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  /** Apply a mutation and notify subscribers. */
  update(mutator) {
    mutator(state)
    state = { ...state }
    persist()
    listeners.forEach((fn) => fn())
  },
  reset() {
    state = createSeed()
    fresh = true
    persist()
    listeners.forEach((fn) => fn())
  },
  /** True once after a fresh seed, so the scheduler can backfill silently. */
  takeFresh() {
    const was = fresh
    fresh = false
    return was
  },
}

export const now = () => Date.now() + (state.clockOffset ?? 0)

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.get)
}

// ---------- Selectors ----------
export const titleById = (s, id) => s.titles.find((t) => t.id === id)
export const copyById = (s, id) => s.copies.find((c) => c.id === id)
export const copyByRfid = (s, rfid) => s.copies.find((c) => c.rfid.toUpperCase() === String(rfid).trim().toUpperCase())
export const studentById = (s, id) => s.students.find((st) => st.id === id)
export const studentByRfid = (s, rfid) => s.students.find((st) => st.rfid.toUpperCase() === String(rfid).trim().toUpperCase())
export const categoryName = (s, id) => s.categories.find((c) => c.id === id)?.name ?? id

export const openTx = (tx) => tx.returnedAt == null
export const activeTxForCopy = (s, copyId) => s.transactions.find((tx) => tx.copyId === copyId && openTx(tx))
export const activeTxForStudent = (s, studentId) => s.transactions.filter((tx) => tx.studentId === studentId && openTx(tx))

/** Display status for a physical copy, with Overdue derived from its loan. */
export function copyStatus(s, copy, t = now()) {
  if (copy.status === 'borrowed') {
    const tx = activeTxForCopy(s, copy.id)
    if (tx && t > tx.dueAt) return 'overdue'
  }
  return copy.status
}

/** Status for a title: available if any copy can be borrowed. */
export function titleAvailability(s, titleId) {
  const copies = s.copies.filter((c) => c.titleId === titleId && c.status !== 'archived')
  const available = copies.filter((c) => c.status === 'available').length
  return { total: copies.length, available, copies }
}

export const txView = (s, tx) => {
  const copy = copyById(s, tx.copyId)
  return { tx, copy, title: copy && titleById(s, copy.titleId), student: studentById(s, tx.studentId) }
}
