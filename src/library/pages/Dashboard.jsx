import { useMemo, useState } from 'react'
import { BarList, ColumnChart, LineChart } from '../components/charts.jsx'
import { Avatar, Badge, Icon, PageHeader, Panel, Segmented, Stat } from '../components/ui.jsx'
import { categoryName, now, txView, useStore } from '../lib/store.js'
import { DAY, dueLabel, fmtDay, fmtShortDateTime, fmtTimeSec, startOfDay } from '../lib/time.js'

export function useLibraryStats(s) {
  const t = now()
  const today = startOfDay(t)
  const open = s.transactions.filter((tx) => tx.returnedAt == null)
  const copies = s.copies.filter((c) => c.status !== 'archived')
  return {
    total: copies.length,
    available: copies.filter((c) => c.status === 'available').length,
    borrowed: open.length,
    overdue: open.filter((tx) => t > tx.dueAt).length,
    dueToday: open.filter((tx) => startOfDay(tx.dueAt) === today && tx.dueAt >= t).length,
    dueTomorrow: open.filter((tx) => startOfDay(tx.dueAt) === today + DAY).length,
    activeStudents: s.students.filter((st) => st.status === 'active').length,
    alarmsToday: s.gateEvents.filter((g) => g.result !== 'allowed' && g.at >= today).length,
    openAlarms: s.gateEvents.filter((g) => g.result !== 'allowed' && !g.resolved).length,
  }
}

function borrowSeries(s, period) {
  const t = now()
  if (period === 'day') {
    return Array.from({ length: 14 }, (_, i) => {
      const start = startOfDay(t) - (13 - i) * DAY
      return { label: fmtDay(start), short: fmtDay(start).replace(/^\w+ /, ''), value: s.transactions.filter((tx) => tx.borrowedAt >= start && tx.borrowedAt < start + DAY).length }
    })
  }
  if (period === 'week') {
    return Array.from({ length: 8 }, (_, i) => {
      const start = startOfDay(t) - (7 - i) * 7 * DAY - 6 * DAY
      return { label: `Week of ${fmtDay(start)}`, short: fmtDay(start), value: s.transactions.filter((tx) => tx.borrowedAt >= start && tx.borrowedAt < start + 7 * DAY).length }
    })
  }
  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(t)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    d.setMonth(d.getMonth() - (3 - i))
    const start = d.getTime()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    return { label, short: d.toLocaleString('en-US', { month: 'short' }), value: s.transactions.filter((tx) => tx.borrowedAt >= start && tx.borrowedAt < end).length }
  })
}

export default function Dashboard({ go }) {
  const s = useStore()
  const [period, setPeriod] = useState('day')
  const stats = useLibraryStats(s)
  const t = now()

  const charts = useMemo(() => {
    const titleCount = new Map()
    const studentCount = new Map()
    s.transactions.forEach((tx) => {
      const copy = s.copies.find((c) => c.id === tx.copyId)
      titleCount.set(copy.titleId, (titleCount.get(copy.titleId) ?? 0) + 1)
      studentCount.set(tx.studentId, (studentCount.get(tx.studentId) ?? 0) + 1)
    })
    const top = (map, name) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, value]) => ({ label: name(id), value }))
    const days = Array.from({ length: 14 }, (_, i) => startOfDay(t) - (13 - i) * DAY)
    return {
      mostBorrowed: top(titleCount, (id) => s.titles.find((x) => x.id === id).title),
      mostActive: top(studentCount, (id) => s.students.find((x) => x.id === id).name),
      overdueTrend: days.map((d) => {
        const end = Math.min(d + DAY, t)
        return { label: fmtDay(d), short: fmtDay(d).replace(/^\w+ /, ''), value: s.transactions.filter((tx) => tx.borrowedAt < end && tx.dueAt < end && (tx.returnedAt == null || tx.returnedAt > end)).length }
      }),
      categories: s.categories.map((c) => ({ label: c.name, value: s.copies.filter((cp) => cp.status !== 'archived' && s.titles.find((x) => x.id === cp.titleId).category === c.id).length })).sort((a, b) => b.value - a.value),
      incidents: days.map((d) => ({ label: fmtDay(d), short: fmtDay(d).replace(/^\w+ /, ''), value: s.gateEvents.filter((g) => g.result !== 'allowed' && g.at >= d && g.at < d + DAY).length })),
    }
  }, [s, t])

  const recentBorrows = [...s.transactions].sort((a, b) => b.borrowedAt - a.borrowedAt).slice(0, 5).map((tx) => txView(s, tx))
  const recentReturns = s.transactions.filter((tx) => tx.returnedAt).sort((a, b) => b.returnedAt - a.returnedAt).slice(0, 5).map((tx) => txView(s, tx))
  const gateFeed = s.gateEvents.slice(0, 6)

  return (
    <div className="page">
      <PageHeader eyebrow="01 / Overview" title="Library dashboard">
        <button type="button" className="btn" onClick={() => go('borrowing')}><Icon name="borrow" />Borrowing station</button>
        <button type="button" className="btn btn-primary" onClick={() => go('gate')}><Icon name="gate" />RFID gate</button>
      </PageHeader>

      {stats.openAlarms > 0 && (
        <button type="button" className="alarm-banner" onClick={() => go('security')}>
          <Icon name="alert" /><strong>{stats.openAlarms} unresolved security alarm{stats.openAlarms === 1 ? '' : 's'}</strong><span>Review in Security Events</span><Icon name="chevron" />
        </button>
      )}

      <div className="stats">
        <Stat label="Total books" value={stats.total} note="Physical copies" icon="books" onClick={() => go('books')} />
        <Stat label="Available" value={stats.available} note="On the shelves" icon="checkCircle" />
        <Stat label="Borrowed" value={stats.borrowed} note="Active loans" icon="book" onClick={() => go('borrowing')} />
        <Stat label="Overdue" value={stats.overdue} note="Past due date" tone="danger" icon="alert" onClick={() => go('overdue')} />
        <Stat label="Due today" value={stats.dueToday} note={`${stats.dueTomorrow} due tomorrow`} tone="warn" icon="clock" onClick={() => go('overdue')} />
        <Stat label="Active students" value={stats.activeStudents} note="Accounts in good standing" icon="users" onClick={() => go('students')} />
      </div>

      <div className="grid-2">
        <Panel className="span-2">
          <div className="chart-toolbar"><Segmented label="Borrowings period" value={period} onChange={setPeriod} options={[['day', 'Day'], ['week', 'Week'], ['month', 'Month']]} /></div>
          <ColumnChart title="Borrowings" sub={period === 'day' ? 'Loans started per day, last 14 days' : period === 'week' ? 'Loans per week, last 8 weeks' : 'Loans per month'} data={borrowSeries(s, period)} valueLabel="Loans" />
        </Panel>
        <Panel><BarList title="Most borrowed books" sub="All loans on record" data={charts.mostBorrowed} valueLabel="Loans" /></Panel>
        <Panel><BarList title="Most active borrowers" sub="All loans on record" data={charts.mostActive} valueLabel="Loans" /></Panel>
        <Panel><LineChart title="Overdue trend" sub="Loans overdue at the end of each day" data={charts.overdueTrend} valueLabel="Overdue" tone="warn" /></Panel>
        <Panel><ColumnChart title="Security incidents" sub="Gate alarms per day, last 14 days" data={charts.incidents} valueLabel="Alarms" tone="danger" /></Panel>
        <Panel className="span-2"><BarList title="Books by category" sub="Physical copies in the collection" data={charts.categories} valueLabel="Copies" /></Panel>
      </div>

      <div className="grid-3">
        <Panel title="Recent borrowings" flush>
          <ul className="feed">
            {recentBorrows.map(({ tx, title, student }) => (
              <li key={tx.id}>
                <Avatar student={student} size={32} />
                <div><strong>{title.title}</strong><span>{student.name} · {fmtShortDateTime(tx.borrowedAt)}</span></div>
                {tx.returnedAt ? <Badge status="returned" /> : <Badge status={t > tx.dueAt ? 'overdue' : 'borrowed'} />}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Recent returns" flush>
          <ul className="feed">
            {recentReturns.map(({ tx, title, student }) => (
              <li key={tx.id}>
                <Avatar student={student} size={32} />
                <div><strong>{title.title}</strong><span>{student.name} · {fmtShortDateTime(tx.returnedAt)}</span></div>
                <Badge status={tx.lateReturn ? 'overdue' : 'available'}>{tx.lateReturn ? 'Late' : 'On time'}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Turnstile activity" actions={<button type="button" className="link-btn" onClick={() => go('gate')}>Open gate</button>} flush>
          <ul className="feed">
            {gateFeed.map((g) => {
              const copy = g.copyId && s.copies.find((c) => c.id === g.copyId)
              const title = copy && s.titles.find((x) => x.id === copy.titleId)
              return (
                <li key={g.id} className={g.result !== 'allowed' ? 'feed-alarm' : ''}>
                  <div><strong>{title?.title ?? `Unknown tag ${g.rfid}`}</strong><span className="mono">{fmtTimeSec(g.at)} · {g.gate}</span></div>
                  <Badge status={g.result} />
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Overdue & due soon" sub="Overdue loans and loans due in the next 48 hours" flush>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Book</th><th>Student</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {s.transactions.filter((tx) => tx.returnedAt == null && tx.dueAt - t < 2 * DAY).sort((a, b) => a.dueAt - b.dueAt).map((tx) => {
                const v = txView(s, tx)
                const due = dueLabel(tx.dueAt, t)
                return (
                  <tr key={tx.id}>
                    <td>{v.title.title}<span className="sub">{categoryName(s, v.title.category)}</span></td>
                    <td>{v.student.name}<span className="sub">{v.student.studentId}</span></td>
                    <td>{fmtShortDateTime(tx.dueAt)}</td>
                    <td><Badge status={due.tone === 'overdue' ? 'overdue' : 'soon'}>{due.text}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
