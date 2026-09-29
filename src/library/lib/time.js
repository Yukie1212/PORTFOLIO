// Date helpers. The whole demo reads "now" from the store's clock so the
// device simulator can fast-forward time to show reminders and overdue logic.
export const MINUTE = 60 * 1000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const secFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export const fmtDate = (t) => dateFmt.format(new Date(t))
export const fmtShortDate = (t) => shortDateFmt.format(new Date(t))
export const fmtTime = (t) => timeFmt.format(new Date(t))
export const fmtTimeSec = (t) => secFmt.format(new Date(t))
export const fmtDay = (t) => dayFmt.format(new Date(t))
export const fmtDateTime = (t) => `${fmtDate(t)} – ${fmtTime(t)}`
export const fmtShortDateTime = (t) => `${fmtShortDate(t)}, ${fmtTime(t)}`

export const startOfDay = (t) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Calendar-day difference, so "due tomorrow" means tomorrow on the calendar.
export const dayDiff = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY)

/**
 * Human countdown for a due date, e.g. "3 days remaining", "Due tomorrow",
 * "Due today at 10:00 AM", "2 days overdue".
 */
export function dueLabel(dueAt, now) {
  if (now > dueAt) {
    const days = Math.floor((now - dueAt) / DAY)
    if (days < 1) {
      const hours = Math.max(1, Math.floor((now - dueAt) / HOUR))
      return { text: `${hours} hour${hours === 1 ? '' : 's'} overdue`, tone: 'overdue' }
    }
    return { text: `${days} day${days === 1 ? '' : 's'} overdue`, tone: 'overdue' }
  }
  const days = dayDiff(now, dueAt)
  if (days === 0) return { text: `Due today at ${fmtTime(dueAt)}`, tone: 'soon' }
  if (days === 1) return { text: 'Due tomorrow', tone: 'soon' }
  return { text: `${days} days remaining`, tone: days <= 3 ? 'soon' : 'ok' }
}

export const remainingDays = (dueAt, now) => (now > dueAt ? -Math.floor((now - dueAt) / DAY) : dayDiff(now, dueAt))
