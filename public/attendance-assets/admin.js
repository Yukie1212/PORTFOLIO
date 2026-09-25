/* Static port of the TimeClock Filament admin panel (app/Filament/Admin).
   Resources, columns, badges, and dashboard widgets mirror the originals; data
   comes from demo-data.js and nothing is sent to a server. */
(() => {
    'use strict'

    const D = window.TimeclockDemo
    const $ = (id) => document.getElementById(id)
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const SIGNED_IN_KEY = 'timeclock-admin-signed-in'

    /* ---------------- Helpers ---------------- */
    const h = (name, cls = 'hi') => `<svg class="${cls}" aria-hidden="true"><use href="#h-${name}"/></svg>`
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    const dash = '<span class="fi-ta-muted">-</span>'
    const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null)
    const fmtLongDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : null)
    const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null)
    const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${new Date(d).toLocaleTimeString('en-GB')}` : null)
    const fmtDateTimeShort = (d) => (d ? `${fmtDate(d)} ${fmtTime(d)}` : null)
    const orDash = (v) => (v === null || v === undefined || v === '' ? dash : esc(v))
    const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    const storage = {
        get: (key) => { try { return sessionStorage.getItem(key) } catch { return null } },
        set: (key, value) => { try { sessionStorage.setItem(key, value) } catch { /* ignore */ } },
        remove: (key) => { try { sessionStorage.removeItem(key) } catch { /* ignore */ } },
    }

    const badge = (label, color = 'gray', icon) => `<span class="fi-badge ${color}">${icon ? h(icon) : ''}${esc(label)}</span>`
    const bool = (value) => (value ? h('check-circle', 'hi c-success') : h('x-circle', 'hi c-danger'))

    // Enum labels, colours and icons from app/Enums.
    const enums = {
        status: { present: ['Present', 'success'], absent: ['Absent', 'danger'], late: ['Late', 'warning'], half_day: ['Half Day', 'gray'], on_leave: ['On Leave', 'gray'], holiday: ['Holiday', 'gray'] },
        type: { 'time-in': ['Time In', 'gray', 'arrow-right-end-on-rectangle'], 'time-out': ['Time Out', 'gray', 'arrow-right-start-on-rectangle'] },
        method: { rfid: ['RFID', 'gray', 'identification'], keypad: ['Keypad', 'gray', 'cursor-arrow-rays'], fingerprint: ['Fingerprint', 'gray', 'finger-print'], face: ['Facial Recognition', 'gray', 'face-smile'] },
        overtime: { pending: ['Pending', 'warning'], approved: ['Approved', 'success'], rejected: ['Rejected', 'danger'] },
        announcementType: { general: ['General', 'primary', 'cog-6-tooth'], urgent: ['Urgent', 'warning', 'clock'], event: ['Event', 'success', 'calendar'], holiday: ['Holiday', 'danger', 'calendar-days'], policy: ['Policy', 'info', 'clipboard-document-list'] },
        announcementStatus: { draft: ['Draft', 'gray', 'pencil'], published: ['Published', 'success', 'calendar'], archived: ['Archived', 'info', 'archive-box'] },
        policy: { strict: ['Strict - must be inside this zone', 'danger', 'no-symbol'], relaxed: ['Relaxed - log only, never enforced', 'success', 'check-circle'] },
        unlockMethod: { rfid: ['RFID', 'info'], fingerprint: ['Fingerprint', 'success'] },
    }
    const enumBadge = (group, value) => {
        const e = enums[group][value]
        return e ? badge(e[0], e[1], e[2]) : dash
    }
    const enumOptions = (group) => Object.entries(enums[group]).map(([value, [label]]) => [value, label])

    const totalMinutes = (r) => (r.time_in && r.time_out ? Math.max(0, Math.round((r.time_out - r.time_in) / 60000)) : null)
    const formatTotal = (minutes) => {
        if (minutes === null) return null
        const hours = Math.floor(minutes / 60)
        const rest = minutes % 60
        if (hours === 0) return `${rest} min`
        return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
    }

    /* ---------------- Notifications (Filament style) ---------------- */
    const notify = ({ title, body, icon = 'check-circle', color = 'success' }) => {
        const el = document.createElement('div')
        el.className = 'fi-notification'
        el.setAttribute('role', 'status')
        el.innerHTML = `${h(icon, `hi hi-lg c-${color}`)}<div class="body"><strong>${esc(title)}</strong>${body ? `<p>${esc(body)}</p>` : ''}</div><button type="button" class="fi-icon-btn" aria-label="Close">${h('x-mark')}</button>`
        el.querySelector('button').addEventListener('click', () => el.remove())
        $('notifications').appendChild(el)
        setTimeout(() => el.remove(), 6000)
    }
    const readOnly = () => notify({ title: 'Demo mode', body: 'Creating and editing records is turned off in this demo.', icon: 'exclamation-triangle', color: 'warning' })

    /* ---------------- Navigation ---------------- */
    const nav = [
        { items: [
            ['', 'Dashboard', 'home'],
            ['announcements', 'Announcements', 'rectangle-stack'],
            ['attendances', 'Attendances', 'rectangle-stack'],
            ['departments', 'Departments', 'rectangle-stack'],
            ['employees', 'Employees', 'rectangle-stack'],
            ['users', 'Users', 'rectangle-stack'],
            ['zones', 'Zones', 'map-pin'],
        ] },
        { label: 'Administrator', items: [
            ['timeclock-unlockers', 'Timeclock Unlockers', 'lock-closed'],
            ['unlock-logs', 'Unlock Logs', 'lock-open'],
        ] },
        { label: 'Settings', items: [
            ['general-settings', 'General Settings', 'cog'],
            ['activity-logs', 'Activity Log', 'shield-check'],
        ] },
    ]
    const renderNav = (route) => {
        $('sidebarNav').innerHTML = nav.map((group) => `<div class="fi-sidebar-group">
            ${group.label ? `<p class="fi-sidebar-group-label">${group.label}</p>` : ''}
            ${group.items.map(([path, label, icon]) => `<a class="fi-sidebar-item${route === path ? ' active' : ''}" href="#/${path}" title="${label}"${route === path ? ' aria-current="page"' : ''}>${h(icon)}<span>${label}</span></a>`).join('')}
        </div>`).join('')
    }

    /* ---------------- Page chrome ---------------- */
    const header = ({ heading, crumbs = [], actions = '' }) => `<header class="fi-header">
        <div>${crumbs.length ? `<nav class="fi-breadcrumbs" aria-label="Breadcrumb">${crumbs.map(([label, href], i) => `${i ? h('chevron-right') : ''}${href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`}`).join('')}</nav>` : ''}
        <h1 class="fi-header-heading">${esc(heading)}</h1></div>
        ${actions ? `<div class="fi-header-actions">${actions}</div>` : ''}
    </header>`
    const newButton = (label) => `<button type="button" class="fi-btn fi-btn-primary" data-readonly>${esc(label)}</button>`
    const editButton = '<button type="button" class="fi-btn fi-btn-primary" data-readonly>Edit</button>'
    const section = (title, body, description) => `<section class="fi-section"><div class="fi-section-header"><h2>${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ''}</div><div class="fi-section-content">${body}</div></section>`
    const entries = (list, cols = '') => `<dl class="fi-in ${cols}">${list.map(([label, value, full]) => `<div class="fi-in-entry${full ? ' full' : ''}"><dt>${esc(label)}</dt><dd>${value ?? dash}</dd></div>`).join('')}</dl>`
    const viewLink = (href) => `<a class="fi-link gray" href="${href}">${h('eye', 'hi hi-sm')}View</a>`
    const editLink = `<button type="button" class="fi-link" data-readonly>${h('pencil-square', 'hi hi-sm')}Edit</button>`

    /* ---------------- Tables ---------------- */
    const tables = {}
    const tableState = (key, cfg) => {
        tables[key] ??= {
            search: '', page: 1, perPage: cfg.perPage ?? 10, filters: {}, panel: null,
            hidden: new Set(cfg.columns.filter((c) => c.toggle === 'hidden').map((c) => c.key)),
            sort: cfg.defaultSort ?? null,
        }
        return tables[key]
    }
    const tableConfigs = {}

    const table = (key, cfg) => {
        tableConfigs[key] = cfg
        const st = tableState(key, cfg)
        const columns = cfg.columns.filter((c) => !st.hidden.has(c.key))
        let rows = cfg.rows()
        const q = st.search.trim().toLowerCase()
        if (q) rows = rows.filter((r) => cfg.columns.some((c) => c.search && String(c.search(r) ?? '').toLowerCase().includes(q)))
        for (const f of cfg.filters ?? []) {
            const v = st.filters[f.key]
            if (v !== undefined && v !== '') rows = rows.filter((r) => f.test(r, v))
        }
        if (st.sort) {
            const col = cfg.columns.find((c) => c.key === st.sort.key)
            if (col?.sort) rows = [...rows].sort((a, b) => {
                const x = col.sort(a)
                const y = col.sort(b)
                const cmp = x === y ? 0 : x === null || x === undefined ? 1 : y === null || y === undefined ? -1 : x > y ? 1 : -1
                return st.sort.dir === 'asc' ? cmp : -cmp
            })
        }
        const total = rows.length
        const perPage = st.perPage === 'all' ? Math.max(total, 1) : st.perPage
        const pages = Math.max(1, Math.ceil(total / perPage))
        st.page = Math.min(st.page, pages)
        const pageRows = rows.slice((st.page - 1) * perPage, st.page * perPage)
        const activeFilters = Object.values(st.filters).filter((v) => v !== undefined && v !== '').length
        const toggleable = cfg.columns.filter((c) => c.toggle)

        const filterPanel = cfg.filters?.length ? `<div class="fi-ta-popover">
            <button type="button" class="fi-icon-btn" data-ta="${key}" data-act="panel" data-value="filters" aria-label="Filter" aria-expanded="${st.panel === 'filters'}">${h('funnel')}${activeFilters ? `<span class="count">${activeFilters}</span>` : ''}</button>
            ${st.panel === 'filters' ? `<div class="fi-dropdown-panel"><div class="fi-ta-popover-head"><strong>Filters</strong><button type="button" class="fi-link danger" data-ta="${key}" data-act="reset">Reset</button></div>
                ${cfg.filters.map((f) => `<div class="fi-field"><label for="f-${key}-${f.key}">${esc(f.label)}</label>${f.kind === 'date'
                    ? `<input class="fi-input" type="date" id="f-${key}-${f.key}" data-ta="${key}" data-act="filter" data-value="${f.key}" value="${esc(st.filters[f.key] ?? '')}">`
                    : `<select class="fi-input" id="f-${key}-${f.key}" data-ta="${key}" data-act="filter" data-value="${f.key}"><option value="">${f.placeholder ?? 'All'}</option>${f.options().map(([v, l]) => `<option value="${esc(v)}"${String(st.filters[f.key] ?? '') === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`}</div>`).join('')}
            </div>` : ''}</div>` : ''
        const columnPanel = toggleable.length ? `<div class="fi-ta-popover">
            <button type="button" class="fi-icon-btn" data-ta="${key}" data-act="panel" data-value="columns" aria-label="Toggle columns" aria-expanded="${st.panel === 'columns'}">${h('view-columns')}</button>
            ${st.panel === 'columns' ? `<div class="fi-dropdown-panel"><div class="fi-ta-popover-head"><strong>Columns</strong></div>${toggleable.map((c) => `<label class="fi-checkbox"><input type="checkbox" data-ta="${key}" data-act="column" data-value="${c.key}"${st.hidden.has(c.key) ? '' : ' checked'}>${esc(c.label)}</label>`).join('')}</div>` : ''}</div>` : ''

        const head = columns.map((c) => {
            const sorted = st.sort?.key === c.key
            const label = c.sort ? `<button type="button" data-ta="${key}" data-act="sort" data-value="${c.key}">${esc(c.label)}${h(sorted && st.sort.dir === 'asc' ? 'chevron-down' : 'chevron-down', `hi${sorted ? '' : ' fi-ta-muted'}`)}</button>` : esc(c.label)
            return `<th scope="col"${sorted ? ` aria-sort="${st.sort.dir === 'asc' ? 'ascending' : 'descending'}"` : ''}${sorted && st.sort.dir === 'asc' ? ' class="asc"' : ''}>${label}</th>`
        }).join('') + (cfg.actions ? '<th><span class="sr-only">Actions</span></th>' : '')

        const body = pageRows.length
            ? pageRows.map((r) => `<tr${cfg.rowUrl ? ` class="clickable" data-href="${cfg.rowUrl(r)}"` : ''}>${columns.map((c) => `<td>${c.html(r)}</td>`).join('')}${cfg.actions ? `<td><div class="fi-ta-actions">${cfg.actions(r)}</div></td>` : ''}</tr>`).join('')
            : ''
        const from = total ? (st.page - 1) * perPage + 1 : 0
        const to = Math.min(total, st.page * perPage)
        const pageButtons = []
        for (let p = 1; p <= pages; p++) {
            if (pages > 7 && p > 2 && p < pages - 1 && Math.abs(p - st.page) > 1) {
                if (pageButtons[pageButtons.length - 1] !== '…') pageButtons.push('…')
                continue
            }
            pageButtons.push(p)
        }

        return `<div class="fi-ta" data-table="${key}">
            <div class="fi-ta-header">${cfg.heading ? `<h3>${esc(cfg.heading)}</h3>` : ''}
                <div class="fi-ta-toolbar">
                    <label class="fi-ta-search">${h('magnifying-glass', 'hi hi-sm')}<span class="sr-only">Search</span><input type="search" placeholder="Search" data-ta="${key}" data-act="search" value="${esc(st.search)}"></label>
                    ${filterPanel}${columnPanel}
                </div>
            </div>
            ${pageRows.length ? `<div class="fi-ta-scroll"><table class="fi-ta-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` : `<div class="fi-ta-empty"><div class="icon-wrap">${h('x-mark', 'hi hi-lg')}</div><strong>No ${esc(cfg.plural ?? 'records')}</strong></div>`}
            <div class="fi-ta-footer">
                <span>Showing ${from} to ${to} of ${total} results</span>
                <label>Per page <select data-ta="${key}" data-act="perpage">${(cfg.perPageOptions ?? [5, 10, 25, 50]).concat('all').map((n) => `<option value="${n}"${String(st.perPage) === String(n) ? ' selected' : ''}>${n === 'all' ? 'All' : n}</option>`).join('')}</select></label>
                ${pages > 1 ? `<nav class="fi-pagination" aria-label="Pagination">
                    <button type="button" data-ta="${key}" data-act="page" data-value="${st.page - 1}"${st.page === 1 ? ' disabled' : ''} aria-label="Previous">${h('chevron-left', 'hi hi-sm')}</button>
                    ${pageButtons.map((p) => (p === '…' ? '<button type="button" disabled>…</button>' : `<button type="button" data-ta="${key}" data-act="page" data-value="${p}"${p === st.page ? ' class="active" aria-current="page"' : ''}>${p}</button>`)).join('')}
                    <button type="button" data-ta="${key}" data-act="page" data-value="${st.page + 1}"${st.page === pages ? ' disabled' : ''} aria-label="Next">${h('chevron-right', 'hi hi-sm')}</button>
                </nav>` : ''}
            </div>
        </div>`
    }

    /* ---------------- Column builders ---------------- */
    const col = (key, label, value, opts = {}) => ({
        key, label,
        html: opts.html ?? ((r) => orDash(value(r))),
        sort: opts.sortable ? (opts.sortValue ?? value) : null,
        search: opts.searchable ? value : null,
        toggle: opts.toggle,
    })
    const employeeName = (r) => (r.employee ? D.fullName(r.employee) : null)

    const attendanceColumns = (withEmployee = true) => [
        ...(withEmployee ? [col('employee', 'Employee', employeeName, { searchable: true, sortable: true })] : []),
        col('rfid_uid', 'RFID', (r) => r.rfid_uid, { searchable: true }),
        col('attendance_type', 'Type', (r) => r.attendance_type, { html: (r) => enumBadge('type', r.attendance_type) }),
        col('attendance_method', 'Method', (r) => r.attendance_method, { html: (r) => enumBadge('method', r.attendance_method) }),
        col('attendance_date', 'Attendance date', (r) => fmtDate(r.attendance_date), { sortable: true, sortValue: (r) => r.attendance_date.getTime() }),
        col('time_in', 'Time in', (r) => fmtTime(r.time_in), { sortable: true, sortValue: (r) => r.time_in?.getTime() ?? null }),
        col('time_out', 'Time out', (r) => fmtTime(r.time_out), { sortable: true, sortValue: (r) => r.time_out?.getTime() ?? null }),
        col('total_hours', 'Total hours', (r) => formatTotal(totalMinutes(r)), { html: (r) => esc(formatTotal(totalMinutes(r)) ?? '-') }),
        col('status', 'Status', (r) => r.status, { html: (r) => enumBadge('status', r.status), toggle: 'hidden' }),
        col('is_late', 'Is late', (r) => r.is_late, { html: (r) => bool(r.is_late), toggle: 'hidden' }),
        col('late_minutes', 'Late minutes', (r) => r.late_minutes, { toggle: 'hidden' }),
        col('is_undertime', 'Is undertime', (r) => r.is_undertime, { html: (r) => bool(r.is_undertime), toggle: 'hidden' }),
        col('undertime_minutes', 'Undertime minutes', (r) => r.undertime_minutes, { toggle: 'hidden' }),
        col('is_overtime', 'Is overtime', (r) => r.is_overtime, { html: (r) => bool(r.is_overtime), toggle: 'hidden' }),
        col('overtime_minutes', 'Overtime minutes', (r) => r.overtime_minutes, { toggle: 'hidden' }),
        col('overtime_status', 'Overtime status', (r) => r.overtime_status, { html: (r) => (r.overtime_status ? enumBadge('overtime', r.overtime_status) : dash), toggle: 'hidden' }),
        col('location', 'Location', (r) => r.location, { toggle: 'hidden' }),
        col('latitude', 'Latitude', (r) => r.latitude?.toFixed(6), { toggle: 'hidden' }),
        col('longitude', 'Longitude', (r) => r.longitude?.toFixed(6), { toggle: 'hidden' }),
    ]
    const sortedAttendances = () => D.attendances().sort((a, b) => b.attendance_date - a.attendance_date || (b.time_in ?? 0) - (a.time_in ?? 0))

    /* ---------------- Pages ---------------- */
    let dashboardDate = D.dateKey(D.today)
    let chart = null

    const pages = {
        dashboard() {
            const day = new Date(`${dashboardDate}T00:00:00`)
            const records = D.attendances()
            const onDay = (d) => records.filter((r) => D.dateKey(r.attendance_date) === D.dateKey(d))
            const daily = onDay(day)
            const clockedIn = daily.filter((r) => r.time_in).length
            const late = daily.filter((r) => r.is_late).length
            const pending = daily.filter((r) => r.overtime_status === 'pending').length
            const employeeCount = D.employees.length
            const rate = employeeCount ? Math.round((clockedIn / employeeCount) * 100) : 0
            const week = Array.from({ length: 7 }, (_, i) => D.addDays(day, i - 6))
            const trend = week.map((d) => onDay(d).filter((r) => r.time_in).length)

            const stat = ({ label, value, desc, descIcon, color, icon, chartData }) => `<div class="fi-wi-widget fi-wi-stat${chartData ? ' has-chart' : ''}">
                <div class="fi-wi-stat-label">${h(icon)}<span>${esc(label)}</span></div>
                <div class="fi-wi-stat-value">${esc(value)}</div>
                <div class="fi-wi-stat-desc c-${color}"><span>${esc(desc)}</span>${h(descIcon)}</div>
                ${chartData ? sparkline(chartData, color) : ''}
            </div>`

            return header({ heading: 'Dashboard' }) + `<div class="fi-page-content">
                ${section('Filters', `<div class="fi-field" style="max-width: 20rem"><label for="dashDate">Attendance date</label><input class="fi-input" type="date" id="dashDate" value="${dashboardDate}"></div>`)}
                <div><h2 class="fi-wi-heading">Attendance at a glance</h2><div class="fi-wi-stats">
                    ${stat({ label: 'Employees clocked in', value: clockedIn.toLocaleString(), desc: `${rate}% of ${employeeCount} employees`, descIcon: 'arrow-trending-up', color: 'success', icon: 'users', chartData: trend })}
                    ${stat({ label: 'Late arrivals', value: late.toLocaleString(), desc: 'Records marked late for selected date', descIcon: 'clock', color: late > 0 ? 'warning' : 'success', icon: 'exclamation-triangle' })}
                    ${stat({ label: 'Pending overtime', value: pending.toLocaleString(), desc: 'Overtime requests on selected date', descIcon: 'clipboard-document-check', color: pending > 0 ? 'info' : 'gray', icon: 'calendar-days' })}
                </div></div>
                ${section('Attendance trend', `<div class="fi-chart" style="padding: 0"><canvas id="trendChart" aria-label="Attendance trend chart"></canvas></div>`, 'Clock-ins, late arrivals, and overtime records from the last 7 days.')}
                ${table('dashboard-recent', {
                    heading: 'Attendance records', plural: 'attendance records', perPage: 5, perPageOptions: [5, 10, 25],
                    rows: () => daily.sort((a, b) => (b.time_in ?? 0) - (a.time_in ?? 0)),
                    columns: [
                        col('employee', 'Employee', employeeName, { searchable: true }),
                        col('attendance_date', 'Date', (r) => fmtDate(r.attendance_date), { sortable: true, sortValue: (r) => r.attendance_date.getTime() }),
                        col('time_in', 'Time in', (r) => fmtTime(r.time_in), { sortable: true, sortValue: (r) => r.time_in?.getTime() ?? null }),
                        col('time_out', 'Time out', (r) => fmtTime(r.time_out), { sortable: true, sortValue: (r) => r.time_out?.getTime() ?? null }),
                        col('status', 'Status', (r) => r.status, { html: (r) => enumBadge('status', r.status) }),
                        col('is_late', 'Late', (r) => r.is_late, { html: (r) => bool(r.is_late) }),
                    ],
                    actions: (r) => viewLink(`#/attendances/${r.id}`),
                    rowUrl: (r) => `#/attendances/${r.id}`,
                })}
            </div>`
        },

        announcements: () => listPage('Announcements', 'New announcement', 'announcements', {
            plural: 'announcements',
            rows: () => D.announcements,
            columns: [
                col('title', 'Title', (r) => r.title, { searchable: true, sortable: true }),
                col('type', 'Type', (r) => r.type, { html: (r) => enumBadge('announcementType', r.type) }),
                col('status', 'Status', (r) => r.status, { html: (r) => enumBadge('announcementStatus', r.status) }),
                col('created_by', 'Created By', (r) => r.created_by, { searchable: true, sortable: true }),
                col('is_pinned', 'Is pinned', (r) => r.is_pinned, { html: (r) => bool(r.is_pinned) }),
                col('created_at', 'Created at', (r) => fmtDateTime(r.created_at), { sortable: true, sortValue: (r) => r.created_at.getTime(), toggle: 'hidden' }),
                col('updated_at', 'Updated at', (r) => fmtDateTime(r.updated_at), { toggle: 'hidden' }),
            ],
            actions: (r) => viewLink(`#/announcements/${r.id}`) + editLink,
            rowUrl: (r) => `#/announcements/${r.id}`,
        }),

        attendances: () => listPage('Attendances', 'New attendance', 'attendances', {
            plural: 'attendances',
            rows: sortedAttendances,
            columns: attendanceColumns(),
            filters: [
                { key: 'status', label: 'Status', options: () => enumOptions('status'), test: (r, v) => r.status === v },
                { key: 'type', label: 'Type', options: () => enumOptions('type'), test: (r, v) => r.attendance_type === v },
                { key: 'method', label: 'Method', options: () => enumOptions('method'), test: (r, v) => r.attendance_method === v },
                { key: 'employee', label: 'Employee', options: () => D.employees.map((e) => [e.employee_id, D.fullName(e)]), test: (r, v) => r.employee_id === v },
                { key: 'from', label: 'Attendance date from', kind: 'date', test: (r, v) => D.dateKey(r.attendance_date) >= v },
                { key: 'until', label: 'Attendance date until', kind: 'date', test: (r, v) => D.dateKey(r.attendance_date) <= v },
            ],
            actions: (r) => viewLink(`#/attendances/${r.id}`) + editLink,
            rowUrl: (r) => `#/attendances/${r.id}`,
        }),

        departments: () => listPage('Departments', 'New department', 'departments', {
            plural: 'departments',
            rows: () => D.departments,
            columns: [
                col('name', 'Name', (r) => r.name, { searchable: true, sortable: true }),
                col('employees', 'Employees', (r) => D.employees.filter((e) => e.department_id === r.id).length, { sortable: true }),
                col('created_at', 'Created at', (r) => fmtDateTime(r.created_at), { toggle: 'hidden' }),
                col('updated_at', 'Updated at', (r) => fmtDateTime(r.created_at), { toggle: 'hidden' }),
                col('deleted_at', 'Deleted at', () => null, { toggle: 'hidden' }),
            ],
            filters: [{ key: 'trashed', label: 'Deleted records', placeholder: 'Without deleted records', options: () => [['with', 'With deleted records'], ['only', 'Only deleted records']], test: (r, v) => v !== 'only' }],
            actions: () => editLink,
        }),

        employees: () => listPage('Employees', { label: 'New employee', href: '#/employees/create' }, 'employees', {
            plural: 'employees',
            rows: () => D.employees,
            columns: [
                col('employee_id', 'Employee ID', (r) => r.employee_id, { searchable: true, sortable: true }),
                col('fingerprint', 'Fingerprint', (r) => r.fingerprints.length, { html: (r) => `<span class="fi-fingerprint${r.fingerprints.length ? '' : ' none'}" title="${r.fingerprints.length ? `${r.fingerprints.length} fingerprint(s) enrolled` : 'No fingerprint'}">${h('finger-print')}</span>` }),
                col('rfid_uid', 'RFID UID', (r) => r.rfid_uid, { searchable: true, toggle: 'shown' }),
                col('first_name', 'First name', (r) => r.first_name, { searchable: true, sortable: true }),
                col('last_name', 'Last name', (r) => r.last_name, { searchable: true, sortable: true }),
                col('middle_name', 'Middle name', (r) => r.middle_name, { searchable: true }),
                col('date_of_birth', 'Date of birth', (r) => fmtLongDate(r.date_of_birth), { sortable: true, sortValue: (r) => r.date_of_birth }),
                col('position', 'Position', (r) => r.position, { searchable: true, sortable: true }),
                col('department', 'Department', (r) => r.department, { searchable: true, sortable: true }),
                col('created_at', 'Created at', (r) => fmtDateTime(r.created_at), { toggle: 'hidden' }),
            ],
            filters: [
                { key: 'department', label: 'Department', options: () => D.departments.map((d) => [d.id, d.name]), test: (r, v) => String(r.department_id) === String(v) },
                { key: 'position', label: 'Position', options: () => [...new Set(D.employees.map((e) => e.position))].sort().map((p) => [p, p]), test: (r, v) => r.position === v },
            ],
            actions: (r) => viewLink(`#/employees/${r.employee_id}`) + `<a class="fi-link" href="#/employees/${r.employee_id}/edit">${h('pencil-square', 'hi hi-sm')}Edit</a>`,
            rowUrl: (r) => `#/employees/${r.employee_id}`,
        }),

        users: () => listPage('Users', 'New user', 'users', {
            plural: 'users',
            rows: () => D.users,
            columns: [
                col('name', 'Name', (r) => r.name, { searchable: true, sortable: true }),
                col('email', 'Email address', (r) => r.email, { searchable: true, sortable: true }),
                col('email_verified_at', 'Email verified at', (r) => fmtDateTime(r.email_verified_at), { sortable: true, sortValue: (r) => r.email_verified_at?.getTime() ?? null }),
                col('created_at', 'Created at', (r) => fmtDateTime(r.created_at), { toggle: 'hidden' }),
            ],
            actions: () => editLink,
        }),

        zones: () => listPage('Zones', 'New zone', 'zones', {
            plural: 'zones',
            rows: () => D.zones,
            columns: [
                col('name', 'Name', (r) => r.name, { searchable: true, sortable: true }),
                col('latitude', 'Latitude', (r) => r.latitude.toFixed(6)),
                col('longitude', 'Longitude', (r) => r.longitude.toFixed(6)),
                col('radius_meters', 'Radius', (r) => `${r.radius_meters} m`, { sortable: true, sortValue: (r) => r.radius_meters }),
                col('policy', 'Policy', (r) => r.policy, { html: (r) => enumBadge('policy', r.policy) }),
                col('is_active', 'Active', (r) => r.is_active, { html: (r) => badge(r.is_active ? 'Yes' : 'No', r.is_active ? 'success' : 'gray') }),
                col('assigned_employees', 'Assigned Employees', (r) => r.assigned_employees, { sortable: true }),
            ],
            actions: () => editLink,
        }),

        'timeclock-unlockers': () => listPage('Timeclock Unlockers', 'New timeclock unlocker', 'timeclock-unlockers', {
            plural: 'timeclock unlockers',
            rows: () => D.unlockers.map((u) => ({ ...u, employee: D.findEmployee(u.employee_id) })),
            columns: [
                col('employee', 'Employee', employeeName, { searchable: true, sortable: true }),
                col('employee_id', 'Employee ID', (r) => r.employee_id, { searchable: true }),
                col('rfid_uid', 'RFID UID', (r) => r.employee.rfid_uid, { searchable: true }),
                col('is_active', 'Active', (r) => r.is_active, { html: (r) => bool(r.is_active) }),
                col('unlocks', 'Unlocks', (r) => r.unlocks, { sortable: true }),
            ],
            actions: () => editLink,
        }, { crumb: 'Timeclock Unlockers' }),

        'unlock-logs': () => listPage('Unlock Logs', null, 'unlock-logs', {
            plural: 'unlock logs',
            rows: () => D.unlockLogs.map((l) => ({ ...l, employee: D.findEmployee(D.unlockers.find((u) => u.id === l.timeclock_authorized_user_id).employee_id) })),
            defaultSort: { key: 'unlocked_at', dir: 'desc' },
            columns: [
                col('employee', 'Employee', employeeName, { searchable: true }),
                col('employee_id', 'Employee ID', (r) => r.employee.employee_id, { searchable: true }),
                col('method', 'Method', (r) => r.method, { html: (r) => enumBadge('unlockMethod', r.method) }),
                col('ip_address', 'IP Address', (r) => r.ip_address, { searchable: true }),
                col('unlocked_at', 'Unlocked At', (r) => fmtDateTimeShort(r.unlocked_at), { sortable: true, sortValue: (r) => r.unlocked_at.getTime() }),
            ],
            filters: [
                { key: 'method', label: 'Method', options: () => enumOptions('unlockMethod'), test: (r, v) => r.method === v },
                { key: 'unlocker', label: 'Unlocker', options: () => D.unlockers.map((u) => [u.id, D.fullName(D.findEmployee(u.employee_id))]), test: (r, v) => String(r.timeclock_authorized_user_id) === String(v) },
            ],
        }),

        'activity-logs': () => listPage('Activity Log', null, 'activity-logs', {
            plural: 'activity logs',
            rows: () => D.activity,
            defaultSort: { key: 'created_at', dir: 'desc' },
            columns: [
                col('subject_type', 'Type', (r) => r.subject_type, { html: (r) => badge(r.subject_type, 'primary'), searchable: true }),
                col('event', 'Event', (r) => r.event, { html: (r) => badge(r.event, r.event === 'Created' ? 'success' : r.event === 'Updated' ? 'warning' : 'info'), searchable: true }),
                col('subject', 'Subject', (r) => r.subject, { searchable: true }),
                col('causer', 'User', (r) => r.causer, { searchable: true }),
                col('created_at', 'Logged at', (r) => fmtDateTimeShort(r.created_at), { sortable: true, sortValue: (r) => r.created_at.getTime() }),
            ],
        }),

        'general-settings'() {
            const field = (id, label, value, type = 'text') => `<div class="fi-field"><label for="${id}">${label}</label><input class="fi-input" id="${id}" type="${type}" value="${esc(value)}"></div>`
            return header({ heading: 'General Settings' }) + `<div class="fi-page-content"><form class="fi-form" id="settingsForm">
                ${section('Application', `<div class="fi-grid cols-2">${field('siteName', 'Site name', 'TimeClock')}${field('siteEmail', 'Support email', 'support@timeclock.example', 'email')}
                    <div class="fi-field span-full"><label for="siteDescription">Description</label><textarea class="fi-input" id="siteDescription">Attendance monitoring with RFID, keypad, fingerprint, and facial recognition.</textarea></div></div>`)}
                ${section('Attendance schedule', `<div class="fi-grid cols-2">${field('timeInStart', 'Time in starts', '05:00', 'time')}${field('timeInEnd', 'Time in ends', '11:59', 'time')}${field('timeOutStart', 'Time out starts', '12:00', 'time')}${field('timeOutEnd', 'Time out ends', '23:59', 'time')}</div>`, 'Used by the TimeClock to pick Time In or Time Out when an employee scans without choosing.')}
                <div><button type="submit" class="fi-btn fi-btn-primary">Save</button></div>
            </form></div>`
        },
    }

    function listPage(title, newLabel, key, cfg, opts = {}) {
        const action = !newLabel ? '' : typeof newLabel === 'object' ? `<a class="fi-btn fi-btn-primary" href="${newLabel.href}">${esc(newLabel.label)}</a>` : newButton(newLabel)
        return header({ heading: title, crumbs: [[opts.crumb ?? title, `#/${key}`], ['List']], actions: action })
            + `<div class="fi-page-content">${table(key, cfg)}</div>`
    }

    const detailPages = {
        attendances(id) {
            const r = D.attendances().find((a) => String(a.id) === id)
            if (!r) return notFound('attendances')
            const name = employeeName(r)
            const mapBox = `${r.longitude - 0.004},${r.latitude - 0.0025},${r.longitude + 0.004},${r.latitude + 0.0025}`
            return header({ heading: 'View Attendance', crumbs: [['Attendances', '#/attendances'], [`${name} · ${fmtDate(r.attendance_date)}`], ['View']], actions: editButton })
                + `<div class="fi-page-content">
                ${section('Attendance', entries([
                    ['Employee', `<a class="fi-link" href="#/employees/${r.employee_id}">${esc(name)}</a>`],
                    ['Employee ID', esc(r.employee_id)],
                    ['Type', enumBadge('type', r.attendance_type)],
                    ['Method', enumBadge('method', r.attendance_method)],
                    ['Attendance date', esc(fmtDate(r.attendance_date))],
                    ['Status', enumBadge('status', r.status)],
                    ['Time in', orDash(fmtTime(r.time_in))],
                    ['Time out', orDash(fmtTime(r.time_out))],
                    ['Total hours', orDash(formatTotal(totalMinutes(r)))],
                    ['RFID', orDash(r.rfid_uid)],
                    ['Late', `${bool(r.is_late)}${r.is_late ? `<span class="fi-ta-sub">${r.late_minutes} minutes</span>` : ''}`],
                    ['Overtime', r.overtime_status ? `${enumBadge('overtime', r.overtime_status)}<span class="fi-ta-sub">${r.overtime_minutes} minutes</span>` : dash],
                ], 'cols-3'))}
                <div class="fi-grid cols-2">
                    ${section('Attendance photo', `<div class="fi-photo">${h('face-smile')}<span>Photo captured at ${esc(fmtTime(r.time_out ?? r.time_in) ?? '-')}</span><span>(hidden in demo)</span></div>`)}
                    ${section('Location', `${entries([['Location', orDash(r.location)], ['Coordinates', `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`]])}
                        <iframe class="fi-map" style="margin-top: 1rem" title="Attendance location map" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${mapBox}&amp;layer=mapnik&amp;marker=${r.latitude},${r.longitude}"></iframe>`)}
                </div>
            </div>`
        },

        employees(id) {
            const e = D.findEmployee(id)
            if (!e) return notFound('employees')
            const records = D.attendances().filter((r) => r.employee_id === e.employee_id)
            const stat = (label, value, desc, descIcon, color, icon) => `<div class="fi-wi-widget fi-wi-stat"><div class="fi-wi-stat-label">${h(icon)}<span>${label}</span></div><div class="fi-wi-stat-value">${value}</div><div class="fi-wi-stat-desc c-${color}"><span>${desc}</span>${h(descIcon)}</div></div>`
            return header({ heading: `View ${e.employee_id}`, crumbs: [['Employees', '#/employees'], [e.employee_id], ['View']], actions: `<a class="fi-btn fi-btn-primary" href="#/employees/${e.employee_id}/edit">Edit</a>` })
                + `<div class="fi-page-content">
                <div class="fi-wi-stats four">
                    ${stat('Present', records.length, 'Total present records', 'check-circle', 'success', 'calendar-days')}
                    ${stat('Late', records.filter((r) => r.is_late).length, 'Total late records', 'clock', 'warning', 'exclamation-triangle')}
                    ${stat('Overtime', records.filter((r) => r.is_overtime).length, 'Total overtime records', 'arrow-trending-up', 'info', 'briefcase')}
                    ${stat('Undertime', records.filter((r) => r.is_undertime).length, 'Total undertime records', 'arrow-trending-down', 'danger', 'calendar')}
                </div>
                ${section('Employee information', `<div class="fi-profile" style="margin-bottom: 1.25rem"><div class="fi-avatar">${e.face_photo ? `<img src="${e.face_photo}" alt="">` : initials(D.fullName(e))}</div><div><strong>${esc(D.fullName(e))}</strong><span>${esc(e.position)} · ${esc(e.department)}</span></div></div>
                    ${entries([
                        ['Employee ID', esc(e.employee_id)], ['RFID UID', orDash(e.rfid_uid)], ['Department', esc(e.department)],
                        ['First name', esc(e.first_name)], ['Middle name', esc(e.middle_name)], ['Last name', esc(e.last_name)],
                        ['Date of birth', esc(fmtLongDate(e.date_of_birth)) + (D.isBirthday(e) ? ` ${badge('Birthday today', 'warning')}` : '')],
                        ['Position', esc(e.position)],
                        ['RFID / keypad', `${e.rfid_uid ? badge('RFID card', 'success', 'identification') : badge('No RFID card', 'gray', 'identification')} ${badge('Keypad password', 'success', 'cursor-arrow-rays')}`],
                        ['Biometrics', `${e.fingerprints.length ? badge(`${e.fingerprints.length} fingerprint${e.fingerprints.length === 1 ? '' : 's'}`, 'success', 'finger-print') : badge('No fingerprint', 'gray', 'finger-print')} ${e.has_face ? badge('Face registered', 'success', 'face-smile') : badge('No face', 'gray', 'face-smile')}`],
                    ], 'cols-3')}`)}
                ${table(`employee-${e.employee_id}`, {
                    heading: 'Attendances', plural: 'attendances',
                    rows: () => records.sort((a, b) => b.attendance_date - a.attendance_date),
                    columns: attendanceColumns(false),
                    actions: (r) => viewLink(`#/attendances/${r.id}`),
                    rowUrl: (r) => `#/attendances/${r.id}`,
                })}
            </div>`
        },

        announcements(id) {
            const a = D.announcements.find((x) => String(x.id) === id)
            if (!a) return notFound('announcements')
            return header({ heading: `View ${a.title}`, crumbs: [['Announcements', '#/announcements'], [a.title], ['View']], actions: editButton })
                + `<div class="fi-page-content">${section('Announcement', entries([
                    ['Title', esc(a.title)], ['Type', enumBadge('announcementType', a.type)], ['Status', enumBadge('announcementStatus', a.status)],
                    ['Is pinned', bool(a.is_pinned)], ['Published at', orDash(fmtDate(a.published_at))], ['Created By', esc(a.created_by)],
                    ['Content', `<div class="fi-prose">${a.content}</div>`, true],
                ], 'cols-3'))}</div>`
        },
    }

    const notFound = (resource) => header({ heading: 'Not found', crumbs: [[resource[0].toUpperCase() + resource.slice(1), `#/${resource}`]] })
        + `<div class="fi-page-content">${section('404', '<p>This record does not exist in the demo data.</p>')}</div>`

    /* ---------------- Employee registration (EmployeeForm wizard) ---------------- */
    const FINGERS = ['Left Thumb', 'Left Index', 'Left Middle', 'Left Ring', 'Left Little', 'Right Thumb', 'Right Index', 'Right Middle', 'Right Ring', 'Right Little']
        .map((label, i) => ({ index: i + 1, label }))
    const STEPS = ['Employee Information', 'RFID', 'Keypad', 'Fingerprint', 'Facial Recognition']
    let wizard = null

    const startWizard = (routeKey, employee) => {
        wizard = {
            routeKey,
            step: 0,
            reached: employee ? STEPS.length - 1 : 0,
            employeeId: employee?.employee_id ?? null,
            revealPassword: false,
            errors: {},
            data: employee
                ? { department_id: String(employee.department_id), first_name: employee.first_name, last_name: employee.last_name, middle_name: employee.middle_name ?? '', date_of_birth: employee.date_of_birth ?? '', position: employee.position, rfid_uid: employee.rfid_uid ?? '', password: '' }
                : { department_id: '', first_name: '', last_name: '', middle_name: '', date_of_birth: '', position: '', rfid_uid: '', password: '' },
        }
    }
    const wizardEmployee = () => (wizard?.employeeId ? D.findEmployee(wizard.employeeId) : null)

    const field = (name, label, { type = 'text', required = false, helper = '', attrs = '' } = {}) => {
        const error = wizard.errors[name]
        return `<div class="fi-field${error ? ' has-error' : ''}">
            <label for="w-${name}">${esc(label)}${required ? '<sup>*</sup>' : ''}</label>
            <input class="fi-input" id="w-${name}" type="${type}" data-wizard="${name}" value="${esc(wizard.data[name])}" ${attrs}${error ? ` aria-invalid="true" aria-describedby="w-${name}-error"` : ''}>
            ${error ? `<p class="fi-field-error" id="w-${name}-error">${esc(error)}</p>` : ''}
            ${helper ? `<p class="fi-hint">${esc(helper)}</p>` : ''}
        </div>`
    }

    const fingerprintSummary = (e) => `<div class="fi-summary"><p class="fi-summary-label">Registered fingerprint</p>
        ${e.fingerprints?.length
            ? `<div class="fi-chips">${e.fingerprints.map((f) => `<span class="fi-chip">${esc(f.label)} · ${esc(fmtDateTimeShort(f.enrolled_at))}</span>`).join('')}</div>`
            : '<p style="margin-top: 0.5rem; font-weight: 500; color: #0f172a">No fingerprint registered yet.</p>'}</div>`
    const faceSummary = (e) => `<div class="fi-summary"><p class="fi-summary-label">Registered face</p>
        <div class="fi-profile" style="margin-top: 0.75rem">${e.face_photo ? `<img class="fi-face-thumb" src="${e.face_photo}" alt="${esc(D.fullName(e))}">` : ''}
        <div><strong style="font-size: 0.875rem">${esc(D.fullName(e))}</strong><span style="font-size: 0.75rem">${e.has_face ? 'Registered face exists' : 'No face registered yet'}</span></div></div></div>`

    const stepContent = () => {
        const e = wizardEmployee()
        switch (wizard.step) {
            case 0:
                return `<div class="fi-grid cols-2">
                    <div class="fi-field${wizard.errors.department_id ? ' has-error' : ''}"><label for="w-department_id">Department<sup>*</sup></label>
                        <select class="fi-input" id="w-department_id" data-wizard="department_id"><option value="">Select an option</option>${D.departments.map((d) => `<option value="${d.id}"${String(d.id) === wizard.data.department_id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
                        ${wizard.errors.department_id ? `<p class="fi-field-error">${esc(wizard.errors.department_id)}</p>` : ''}</div>
                    ${field('first_name', 'First name', { required: true })}
                    ${field('last_name', 'Last name', { required: true })}
                    ${field('middle_name', 'Middle name')}
                    ${field('date_of_birth', 'Date of birth', { type: 'date', required: true })}
                    ${field('position', 'Position', { required: true })}
                </div>`
            case 1:
                return `<div style="max-width: 28rem">${field('rfid_uid', 'RFID UIDs', { helper: 'Used for RFID attendance and timeclock unlock.', attrs: 'inputmode="numeric" autocomplete="off"' })}</div>`
            case 2:
                return `<div class="fi-stack" style="max-width: 28rem">
                    <div class="fi-field${wizard.errors.password ? ' has-error' : ''}"><label for="w-password">Keypad Password</label>
                        <div class="fi-input-group"><input class="fi-input" id="w-password" type="${wizard.revealPassword ? 'text' : 'password'}" inputmode="numeric" autocomplete="new-password" data-wizard="password" value="${esc(wizard.data.password)}">
                        <button type="button" data-wizard-action="reveal" aria-label="${wizard.revealPassword ? 'Hide' : 'Show'} password">${h(wizard.revealPassword ? 'eye' : 'eye')}</button></div>
                        ${wizard.errors.password ? `<p class="fi-field-error">${esc(wizard.errors.password)}</p>` : ''}
                        <p class="fi-hint">Used for manual keypad attendance. Leave blank to keep the current password.${e ? ` Current password in this demo: ${esc(e.keypad_password)}.` : ''}</p></div>
                    <div class="fi-keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button type="button" data-keypad="${d}">${d}</button>`).join('')}
                        <button type="button" class="util" data-keypad="clear">Clear</button><button type="button" data-keypad="0">0</button><button type="button" class="util" data-keypad="delete">Delete</button></div>
                </div>`
            case 3:
                return e ? `<div class="fi-stack">${fingerprintSummary(e)}<div><button type="button" class="fi-btn fi-btn-primary" data-wizard-action="fingerprint">${h('finger-print', 'hi hi-sm')}Enroll fingerprint</button></div></div>`
                    : needsEmployee('Save this employee before enrolling a fingerprint.')
            case 4:
                return e ? `<div class="fi-stack">${faceSummary(e)}<div><button type="button" class="fi-btn fi-btn-primary" data-wizard-action="face">${h('face-smile', 'hi hi-sm')}Register face</button></div></div>`
                    : needsEmployee('Save this employee before registering a face.')
        }
        return ''
    }

    const registrationPage = (routeKey, employee) => {
        if (!wizard || wizard.routeKey !== routeKey) startWizard(routeKey, employee)
        const e = wizardEmployee()
        const creating = !employee
        const last = wizard.step === STEPS.length - 1
        const heading = creating ? 'Create Employee' : `Edit ${employee.employee_id}`
        const crumbs = creating ? [['Employees', '#/employees'], ['Create']] : [['Employees', '#/employees'], [employee.employee_id, `#/employees/${employee.employee_id}`], ['Edit']]
        const actions = creating ? '' : `<a class="fi-btn fi-btn-gray" href="#/employees/${employee.employee_id}">View</a>`
        return header({ heading, crumbs, actions }) + `<div class="fi-page-content">
            ${creating && e ? `<div class="fi-alert success">Employee ${esc(e.employee_id)} was created. Continue to add RFID, keypad, fingerprint, and face credentials.</div>` : ''}
            <section class="fi-section">
                <nav class="fi-wizard-steps" aria-label="Registration steps">${STEPS.map((label, i) => `<button type="button" class="fi-wizard-step${i === wizard.step ? ' active' : ''}${i < wizard.step || (i <= wizard.reached && i !== wizard.step && e) ? ' done' : ''}" data-wizard-step="${i}"${i === wizard.step ? ' aria-current="step"' : ''}>
                    <span class="num">${i < wizard.step || (i <= wizard.reached && i !== wizard.step && e) ? h('check-circle') : pad2(i + 1)}</span><span>${label}</span></button>`).join('')}</nav>
                <div class="fi-wizard-body">${stepContent()}</div>
                <div class="fi-wizard-footer">
                    ${wizard.step > 0 ? '<button type="button" class="fi-btn fi-btn-gray" data-wizard-action="back">Back</button>' : ''}
                    ${last ? `<button type="button" class="fi-btn fi-btn-primary" data-wizard-action="finish">${creating ? 'Create' : 'Save changes'}</button>` : '<button type="button" class="fi-btn fi-btn-primary" data-wizard-action="next">Next</button>'}
                    <a class="fi-btn fi-btn-gray" href="${e ? `#/employees/${e.employee_id}` : '#/employees'}">Cancel</a>
                </div>
            </section>
        </div>`
    }
    const pad2 = (n) => String(n).padStart(2, '0')
    const needsEmployee = (text) => `<div class="fi-stack" style="align-items: flex-start"><p class="fi-muted-text">${text}</p><button type="button" class="fi-btn fi-btn-gray" data-wizard-step="0">Go to Employee Information</button></div>`

    // Validation mirrors the rules in EmployeeForm.php.
    const validateStep = () => {
        const d = wizard.data
        const errors = {}
        if (wizard.step === 0) {
            if (!d.department_id) errors.department_id = 'The department field is required.'
            for (const [key, label] of [['first_name', 'first name'], ['last_name', 'last name'], ['date_of_birth', 'date of birth'], ['position', 'position']]) {
                if (!String(d[key]).trim()) errors[key] = `The ${label} field is required.`
            }
        }
        if (wizard.step === 1 && d.rfid_uid.trim()) {
            if (!/^\d+$/.test(d.rfid_uid.trim()) || Number(d.rfid_uid) < 1) errors.rfid_uid = 'The rfid uid field must be a number.'
            else if (D.employees.some((x) => x.rfid_uid === d.rfid_uid.trim() && x.employee_id !== wizard.employeeId)) errors.rfid_uid = 'The rfid uid has already been taken.'
        }
        if (wizard.step === 2 && d.password.trim()) {
            if (!/^\d+$/.test(d.password.trim())) errors.password = 'The keypad password field must be a number.'
            else if (D.employees.some((x) => x.keypad_password === d.password.trim() && x.employee_id !== wizard.employeeId)) errors.password = 'This keypad password is already used by another employee.'
        }
        wizard.errors = errors
        return Object.keys(errors).length === 0
    }

    // Like createFromEmployeeInformationStep(), the record is saved as soon as
    // step 1 passes, so fingerprint and face enrollment have an employee to attach to.
    const persistStep = () => {
        const d = wizard.data
        const existing = wizardEmployee()
        const base = existing ?? {
            employee_id: D.nextEmployeeId(), rfid_uid: '', keypad_password: '', fingerprints: [], has_face: false, face_photo: null,
            created_at: new Date(), registered_in_demo: true,
        }
        const record = {
            ...base,
            department_id: Number(d.department_id),
            first_name: d.first_name.trim(), last_name: d.last_name.trim(), middle_name: d.middle_name.trim(),
            date_of_birth: d.date_of_birth, position: d.position.trim(),
        }
        record.rfid_uid = d.rfid_uid.trim() || null
        if (d.password.trim()) record.keypad_password = d.password.trim()
        if (!record.keypad_password) record.keypad_password = record.employee_id
        const saved = D.saveEmployee(record)
        if (!existing) {
            wizard.employeeId = saved.employee_id
            notify({ title: 'Created', body: `${D.fullName(saved)} was saved as employee ${saved.employee_id}.` })
        }
        return saved
    }

    const goToStep = (target) => {
        if (target === wizard.step) return
        const valid = validateStep()
        // A malformed RFID or keypad entry has to be fixed first; step 1 can be left unfinished.
        if (!valid && wizard.step !== 0) { render(); return }
        if (valid && wizard.step <= 2 && (wizard.step === 0 || wizardEmployee())) persistStep()
        wizard.errors = {}
        wizard.step = target
        wizard.reached = Math.max(wizard.reached, target)
        render()
    }

    const wizardAction = (action) => {
        if (action === 'reveal') { wizard.revealPassword = !wizard.revealPassword; render(); return }
        if (action === 'back') { goToStep(Math.max(0, wizard.step - 1)); return }
        if (action === 'fingerprint') { openFingerprintModal(); return }
        if (action === 'face') { openFaceModal(); return }
        if (action === 'next' || action === 'finish') {
            if (!validateStep()) { render(); return }
            if (wizard.step <= 2 && (wizard.step === 0 || wizardEmployee())) persistStep()
            if (action === 'finish' && !wizardEmployee()) {
                // Finishing needs the employee information; send the user back there.
                wizard.step = 0
                if (!validateStep()) {
                    notify({ title: 'Employee information required', body: 'Fill in the required fields before creating the employee.', icon: 'exclamation-triangle', color: 'warning' })
                    render()
                    return
                }
                persistStep()
            }
            if (action === 'finish') {
                const e = wizardEmployee()
                const creating = wizard.routeKey === 'create'
                wizard = null
                notify({ title: creating ? 'Created' : 'Saved', body: creating ? 'Registration complete.' : 'Employee changes were saved.' })
                location.hash = `#/employees/${e.employee_id}`
                return
            }
            wizard.step += 1
            wizard.reached = Math.max(wizard.reached, wizard.step)
            render()
        }
    }

    /* ---------- Action modals ---------- */
    const modalRoot = () => $('modalRoot')
    const openModal = (title, body, onClose) => {
        modalRoot().innerHTML = `<div class="fi-modal" id="actionModal"><div class="fi-modal-window lg" role="dialog" aria-modal="true" aria-labelledby="actionModalTitle">
            <div class="fi-modal-head"><h2 id="actionModalTitle">${esc(title)}</h2><button type="button" class="fi-icon-btn" data-modal-close aria-label="Close">${h('x-mark')}</button></div>
            <div class="fi-modal-body" id="actionModalBody">${body}</div>
            <div class="fi-modal-foot"><button type="button" class="fi-btn fi-btn-gray" data-modal-close>Close</button></div>
        </div></div>`
        modalRoot().onclose = onClose
        modalRoot().querySelector('[data-modal-close]').focus()
    }
    const closeModal = () => {
        const onClose = modalRoot().onclose
        modalRoot().onclose = null
        modalRoot().innerHTML = ''
        onClose?.()
        render()
    }
    const employeeHeader = (e) => `<div class="fi-summary"><strong style="color: #0f172a">${esc(D.fullName(e))}</strong><p class="fi-muted-text" style="margin-top: 0.25rem">${esc(e.employee_id)} · ${esc(e.position)}</p></div>`

    /* Fingerprint enrollment (filament-fingerprint-enrollment.js, ZKTeco bridge simulated) */
    let fp = null
    const openFingerprintModal = () => {
        const e = wizardEmployee()
        fp = { selected: null, busy: false, scans: 0, message: '', success: false, removing: null }
        openModal(`Enroll fingerprint for ${D.fullName(e)}`, '', () => { fp = null })
        renderFingerprint()
    }
    const renderFingerprint = () => {
        const body = $('actionModalBody')
        if (!body || !fp) return
        const e = wizardEmployee()
        const registered = e.fingerprints ?? []
        const limit = registered.length >= 3
        const isRegistered = (f) => registered.some((t) => t.finger_index === f.index)
        body.innerHTML = `<div class="fi-stack">
            ${employeeHeader(e)}
            <div class="fi-summary"><div class="row"><p class="fi-summary-label">Registered fingerprint</p><span class="fi-pill">${registered.length}/3 registered</span></div>
                ${registered.length ? `<div class="fi-chips">${registered.map((t) => `<span class="fi-chip">${esc(t.label)} · ${esc(fmtDateTimeShort(t.enrolled_at))}<button type="button" data-fp-remove="${t.finger_index}"${fp.busy ? ' disabled' : ''}>${fp.removing === t.finger_index ? 'Removing...' : 'Remove'}</button></span>`).join('')}</div>`
                    : '<p style="margin-top: 0.5rem; font-weight: 500; color: #0f172a">No fingerprint registered yet.</p>'}</div>
            ${fp.message ? `<div class="fi-alert ${fp.success ? 'success' : 'warning'}" role="status">${esc(fp.message)}</div>` : ''}
            ${limit ? '<div class="fi-alert warning">This employee already has 3 registered fingers. Remove one before registering another.</div>' : ''}
            <div class="fi-stack" style="gap: 0.75rem"><p style="font-weight: 600; color: #0f172a">Select finger</p>
                <div class="fi-fingers">${FINGERS.map((f) => `<button type="button" class="fi-finger${fp.selected === f.index ? ' selected' : isRegistered(f) ? ' registered' : ''}" data-fp-finger="${f.index}"${fp.busy || isRegistered(f) || limit ? ' disabled' : ''}>${f.label}${isRegistered(f) ? '<small>Registered</small>' : fp.selected === f.index ? '<small>Selected</small>' : ''}</button>`).join('')}</div></div>
            ${fp.busy || fp.scans ? `<div class="fi-scan-progress" aria-label="Scan ${fp.scans} of 3">${[1, 2, 3].map((n) => `<span class="${n <= fp.scans ? 'on' : ''}"></span>`).join('')}</div>` : ''}
            <div><button type="button" class="fi-btn fi-btn-primary" data-fp-scan${fp.busy || !fp.selected || limit ? ' disabled' : ''}>${fp.busy ? 'Reading fingerprint...' : 'Scan fingerprint'}</button></div>
        </div>`
    }
    const fingerLabel = (index) => FINGERS.find((f) => f.index === index)?.label
    const scanFingerprint = async () => {
        const e = wizardEmployee()
        const label = fingerLabel(fp.selected)
        Object.assign(fp, { busy: true, scans: 0, success: false, message: `Opening the fingerprint scanner. Scan ${label} 3 times when it is ready.` })
        renderFingerprint()
        await wait(1200)
        for (let n = 1; n <= 3; n++) {
            if (!fp) return
            fp.message = n < 3 ? `Place ${label} on the scanner (${n} of 3)...` : `Place ${label} on the scanner one last time (3 of 3)...`
            renderFingerprint()
            await wait(1000)
            if (!fp) return
            fp.scans = n
            renderFingerprint()
            await wait(350)
        }
        if (!fp) return
        const saved = D.saveEmployee({ ...e, fingerprints: [...(e.fingerprints ?? []), { finger_index: fp.selected, label, enrolled_at: new Date().toISOString() }] })
        Object.assign(fp, { busy: false, selected: null, success: true, message: 'Fingerprint successfully Registered!' })
        wizard.employeeId = saved.employee_id
        renderFingerprint()
    }
    const removeFinger = async (index) => {
        const e = wizardEmployee()
        Object.assign(fp, { busy: true, removing: index, message: '' })
        renderFingerprint()
        await wait(700)
        if (!fp) return
        D.saveEmployee({ ...e, fingerprints: e.fingerprints.filter((t) => t.finger_index !== index) })
        Object.assign(fp, { busy: false, removing: null, success: true, message: `${fingerLabel(index)} was removed.` })
        renderFingerprint()
    }

    /* Face registration (filament-face-registration.js, face-api.js detection simulated) */
    let face = null
    const openFaceModal = () => {
        const e = wizardEmployee()
        face = { stream: null, ready: false, status: 'Start the camera and center one face.', faces: 0, clear: false, countdown: 0, reviewing: false, preview: null, message: '', success: false, saving: false, run: 0 }
        openModal(`Register face for ${D.fullName(e)}`, `<div class="fi-stack">
            ${employeeHeader(e)}
            <div id="faceSummary">${faceSummary(e)}</div>
            <div class="fi-face-grid">
                <div class="fi-face-stage">
                    <div class="fi-face-cover" id="faceCover"></div>
                    <video id="faceVideo" autoplay muted playsinline></video>
                    <div class="fi-face-blur" id="faceBlur"></div>
                    <div class="fi-face-oval" id="faceOval"></div>
                    <div class="fi-face-count" id="faceCount" hidden><b></b><span>Hold still</span></div>
                    <div class="fi-face-review" id="faceReview" hidden>
                        <header><div><small>Captured</small><strong>Review this photo before saving</strong></div><span class="fi-pill">Clear face</span></header>
                        <div class="img"><img id="facePreview" alt="Captured face preview"></div>
                        <footer>Save this image if the face is clear, centered, and unobstructed.</footer>
                    </div>
                </div>
                <div class="fi-stack">
                    <div class="fi-summary"><p class="fi-summary-label">Status</p><p style="margin-top: 0.25rem; font-weight: 500; color: #0f172a" id="faceStatus" role="status"></p>
                        <p style="margin-top: 0.5rem; font-size: 0.75rem; font-weight: 500; color: #d97706">Remove eyeglasses, shades, masks, or any object covering the face before saving.</p></div>
                    <div class="fi-face-stats"><div><b id="faceFaces">0</b><span>Faces</span></div><div><b id="faceClear">Check</b><span>Face</span></div></div>
                    <div id="faceMessage"></div>
                    <div class="fi-alert success" id="faceReady" hidden><strong>Ready to save?</strong><p style="margin-top: 0.25rem; font-size: 0.75rem">Choose retake if the photo is blurry, cropped badly, or the employee is not looking straight.</p></div>
                    <div class="fi-grid cols-2" id="faceButtons" hidden style="gap: 0.75rem">
                        <button type="button" class="fi-btn fi-btn-gray" data-face="retake">Retake photo</button>
                        <button type="button" class="fi-btn fi-btn-primary" data-face="save">Save this photo</button>
                    </div>
                </div>
            </div>
        </div>`, () => {
            face?.stream?.getTracks().forEach((t) => t.stop())
            face = null
        })
        updateFace()
        startFaceCamera()
    }
    const updateFace = () => {
        if (!face || !$('faceStatus')) return
        $('faceStatus').textContent = face.status
        $('faceCover').hidden = face.ready
        $('faceCover').textContent = face.status
        $('faceVideo').classList.toggle('ready', face.ready && !face.reviewing)
        $('faceBlur').hidden = face.reviewing
        $('faceOval').hidden = face.reviewing
        $('faceOval').className = `fi-face-oval${face.clear ? ' clear' : face.faces ? ' found' : ''}`
        $('faceCount').hidden = !(face.countdown > 0 && !face.reviewing)
        $('faceCount').querySelector('b').textContent = face.countdown
        $('faceReview').hidden = !face.reviewing
        if (face.preview) $('facePreview').src = face.preview
        $('faceFaces').textContent = face.faces
        $('faceClear').textContent = face.clear ? 'Clear' : 'Check'
        $('faceClear').className = face.clear ? 'ok' : ''
        $('faceMessage').innerHTML = face.message ? `<div class="fi-alert ${face.success ? 'success' : 'warning'}">${esc(face.message)}</div>` : ''
        $('faceReady').hidden = !face.reviewing || face.success
        $('faceButtons').hidden = !face.reviewing || face.success
        const save = document.querySelector('[data-face="save"]')
        if (save) { save.disabled = face.saving; save.textContent = face.saving ? 'Saving...' : 'Save this photo' }
        const retake = document.querySelector('[data-face="retake"]')
        if (retake) retake.disabled = face.saving
    }
    const startFaceCamera = async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable')
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' }, audio: false })
            if (!face) { stream.getTracks().forEach((t) => t.stop()); return }
            face.stream = stream
            $('faceVideo').srcObject = stream
            await $('faceVideo').play().catch(() => null)
        } catch {
            if (!face) return
            face.cameraless = true
        }
        if (!face) return
        face.ready = true
        runFaceCapture()
    }
    const runFaceCapture = async () => {
        const run = ++face.run
        const alive = () => face && face.run === run
        Object.assign(face, { faces: 0, clear: false, countdown: 0, reviewing: false, preview: null, message: '', success: false,
            status: face.cameraless ? 'Camera unavailable. Using a sample photo for this demo.' : 'Center your face inside the oval.' })
        updateFace()
        await wait(1300)
        if (!alive()) return
        Object.assign(face, { faces: 1, status: 'Center your face inside the oval.' })
        updateFace()
        await wait(1200)
        if (!alive()) return
        Object.assign(face, { clear: true, status: 'Face clear. Capturing for review...' })
        updateFace()
        await wait(600)
        for (let s = 3; s >= 1; s--) {
            if (!alive()) return
            Object.assign(face, { countdown: s, status: `Hold still. Capturing in ${s}...` })
            updateFace()
            await wait(900)
        }
        if (!alive()) return
        Object.assign(face, { countdown: 0, reviewing: true, preview: captureFace(), status: 'Review the captured face image.', message: 'Save this image or retake if it is not clear.' })
        updateFace()
    }
    // Crops the oval area of the live frame; without a camera, draws a placeholder portrait.
    const captureFace = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 240
        canvas.height = 300
        const ctx = canvas.getContext('2d')
        const video = $('faceVideo')
        if (!face.cameraless && video?.videoWidth) {
            const sh = video.videoHeight * 0.85
            const sw = sh * 0.8
            ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height)
        } else {
            const e = wizardEmployee()
            ctx.fillStyle = '#abd1c6'
            ctx.fillRect(0, 0, 240, 300)
            ctx.fillStyle = '#004643'
            ctx.beginPath(); ctx.arc(120, 120, 58, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.ellipse(120, 290, 100, 90, 0, Math.PI, 0); ctx.fill()
            ctx.fillStyle = '#fffffe'
            ctx.font = 'bold 44px "Mona Sans", sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(initials(D.fullName(e)), 120, 122)
        }
        return canvas.toDataURL('image/jpeg', 0.72)
    }
    const saveFace = async () => {
        const e = wizardEmployee()
        Object.assign(face, { saving: true, message: '', status: 'Saving face registration...' })
        updateFace()
        await wait(900)
        if (!face) return
        D.saveEmployee({ ...e, has_face: true, face_photo: face.preview })
        Object.assign(face, { saving: false, success: true, message: 'Face registered successfully.', status: 'Face saved.' })
        face.stream?.getTracks().forEach((t) => t.stop())
        $('faceSummary').innerHTML = faceSummary(wizardEmployee())
        updateFace()
    }

    /* ---------------- Sparkline + chart ---------------- */
    function sparkline(values, color) {
        const max = Math.max(...values, 1)
        const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 24 - (v / max) * 20 - 2])
        const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
        const stroke = { success: '#10b981', warning: '#f59e0b', info: '#0ea5e9', danger: '#f43f5e', gray: '#94a3b8' }[color]
        return `<svg class="fi-wi-stat-chart" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><path d="${line} L100,24 L0,24 Z" fill="${stroke}" fill-opacity="0.1"/><path d="${line}" fill="none" stroke="${stroke}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`
    }

    function drawChart() {
        const canvas = $('trendChart')
        chart?.destroy?.()
        chart = null
        if (!canvas) return
        if (!window.Chart) {
            canvas.parentElement.innerHTML = '<div class="fi-chart-fallback">Chart unavailable offline.</div>'
            return
        }
        const day = new Date(`${dashboardDate}T00:00:00`)
        const days = Array.from({ length: 7 }, (_, i) => D.addDays(day, i - 6))
        const records = D.attendances()
        const count = (d, test) => records.filter((r) => D.dateKey(r.attendance_date) === D.dateKey(d) && test(r)).length
        const dataset = (label, data, color, fill) => ({ label, data, borderColor: color, backgroundColor: fill, tension: 0.35, fill: true, pointRadius: 2, pointBackgroundColor: color, borderWidth: 2 })
        chart = new window.Chart(canvas, {
            type: 'line',
            data: {
                labels: days.map((d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                datasets: [
                    dataset('Clock-ins', days.map((d) => count(d, (r) => r.time_in)), '#004643', 'rgba(0, 70, 67, 0.15)'),
                    dataset('Late', days.map((d) => count(d, (r) => r.is_late)), '#f59e0b', 'rgba(245, 158, 11, 0.12)'),
                    dataset('Overtime', days.map((d) => count(d, (r) => r.is_overtime)), '#0ea5e9', 'rgba(14, 165, 233, 0.12)'),
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Mona Sans' } } } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef3f1' } }, x: { grid: { display: false } } },
            },
        })
    }

    /* ---------------- Global search ---------------- */
    const globalSearch = (query) => {
        const q = query.trim().toLowerCase()
        const box = $('searchResults')
        if (q.length < 2) { box.hidden = true; return }
        const groups = [
            ['Employees', D.employees.filter((e) => `${D.fullName(e)} ${e.employee_id} ${e.rfid_uid}`.toLowerCase().includes(q)).map((e) => [`#/employees/${e.employee_id}`, e.employee_id, `${D.fullName(e)} · ${e.department}`])],
            ['Announcements', D.announcements.filter((a) => a.title.toLowerCase().includes(q)).map((a) => [`#/announcements/${a.id}`, a.title, enums.announcementType[a.type][0]])],
            ['Departments', D.departments.filter((d) => d.name.toLowerCase().includes(q)).map((d) => ['#/departments', d.name, 'Department'])],
            ['Users', D.users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q)).map((u) => ['#/users', u.name, u.email])],
        ].filter(([, items]) => items.length)
        box.innerHTML = groups.length
            ? groups.map(([label, items]) => `<h4>${label}</h4>${items.slice(0, 5).map(([href, title, sub]) => `<a href="${href}"><strong>${esc(title)}</strong><span>${esc(sub)}</span></a>`).join('')}`).join('')
            : '<p>No search results found.</p>'
        box.hidden = false
    }

    /* ---------------- Router ---------------- */
    const currentRoute = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)

    function render({ keepFocus } = {}) {
        const signedIn = storage.get(SIGNED_IN_KEY) === '1'
        $('login').hidden = signedIn
        $('app').hidden = !signedIn
        if (!signedIn) return

        const [resource = '', id, sub] = currentRoute()
        renderNav(resource)
        const focused = keepFocus ? document.activeElement : null
        const focusSel = focused?.dataset?.act === 'search' ? `[data-ta="${focused.dataset.ta}"][data-act="search"]` : null
        const caret = focused?.selectionStart

        let html
        if (resource === '') html = pages.dashboard()
        else if (resource === 'employees' && id === 'create') html = registrationPage('create', null)
        else if (resource === 'employees' && sub === 'edit' && D.findEmployee(id)) html = registrationPage(`edit-${id}`, D.findEmployee(id))
        else if (id && detailPages[resource]) html = detailPages[resource](id)
        else if (pages[resource]) html = pages[resource]()
        else html = notFound('dashboard')
        $('main').innerHTML = html
        document.title = `${document.querySelector('.fi-header-heading')?.textContent ?? 'Admin'} - TimeClock`

        if (resource === '') drawChart()
        if (focusSel) {
            const input = document.querySelector(focusSel)
            input?.focus()
            if (input && caret !== undefined) input.setSelectionRange(caret, caret)
        }
    }

    window.addEventListener('hashchange', () => {
        document.body.classList.remove('sidebar-open')
        $('searchResults').hidden = true
        render()
        window.scrollTo(0, 0)
    })

    /* ---------------- Events ---------------- */
    const main = $('main')
    main.addEventListener('input', (e) => {
        const t = e.target
        if (t.dataset.wizard && wizard) { wizard.data[t.dataset.wizard] = t.value; return }
        if (t.dataset.act === 'search') {
            const st = tables[t.dataset.ta]
            st.search = t.value
            st.page = 1
            render({ keepFocus: true })
        }
    })
    main.addEventListener('change', (e) => {
        const t = e.target
        if (t.dataset.wizard && wizard) { wizard.data[t.dataset.wizard] = t.value; return }
        if (t.id === 'dashDate') {
            dashboardDate = t.value || D.dateKey(D.today)
            render()
            return
        }
        const st = tables[t.dataset.ta]
        if (!st) return
        if (t.dataset.act === 'filter') { st.filters[t.dataset.value] = t.value; st.page = 1 }
        if (t.dataset.act === 'perpage') { st.perPage = t.value === 'all' ? 'all' : Number(t.value); st.page = 1 }
        if (t.dataset.act === 'column') {
            if (t.checked) st.hidden.delete(t.dataset.value)
            else st.hidden.add(t.dataset.value)
        }
        render()
    })
    main.addEventListener('click', (e) => {
        if (e.target.closest('[data-readonly]')) { readOnly(); return }
        const wizardButton = e.target.closest('[data-wizard-action]')
        if (wizardButton && wizard) { wizardAction(wizardButton.dataset.wizardAction); return }
        const stepButton = e.target.closest('[data-wizard-step]')
        if (stepButton && wizard) { goToStep(Number(stepButton.dataset.wizardStep)); return }
        const key = e.target.closest('[data-keypad]')
        if (key && wizard) {
            const value = key.dataset.keypad
            wizard.data.password = value === 'clear' ? '' : value === 'delete' ? wizard.data.password.slice(0, -1) : wizard.data.password + value
            $('w-password').value = wizard.data.password
            return
        }
        const btn = e.target.closest('button[data-ta]')
        if (btn) {
            const st = tables[btn.dataset.ta]
            const act = btn.dataset.act
            if (act === 'panel') st.panel = st.panel === btn.dataset.value ? null : btn.dataset.value
            if (act === 'reset') { st.filters = {}; st.page = 1 }
            if (act === 'page') st.page = Number(btn.dataset.value)
            if (act === 'sort') {
                const key = btn.dataset.value
                st.sort = st.sort?.key !== key ? { key, dir: 'asc' } : st.sort.dir === 'asc' ? { key, dir: 'desc' } : null
            }
            render()
            return
        }
        const row = e.target.closest('tr[data-href]')
        if (row && !e.target.closest('a, button, input, select')) location.hash = row.dataset.href
    })
    main.addEventListener('submit', (e) => {
        if (e.target.id !== 'settingsForm') return
        e.preventDefault()
        notify({ title: 'Saved', body: 'Settings are not stored in this demo.' })
    })
    document.addEventListener('click', (e) => {
        // Close popovers when clicking outside them.
        if (!e.target.closest('.fi-ta-popover')) {
            let changed = false
            for (const st of Object.values(tables)) if (st.panel) { st.panel = null; changed = true }
            if (changed) render()
        }
        if (!e.target.closest('.fi-user-menu')) { $('userMenuPanel').hidden = true; $('userMenuButton').setAttribute('aria-expanded', 'false') }
        if (!e.target.closest('.fi-global-search')) $('searchResults').hidden = true
    })
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return
        if ($('actionModal')) { closeModal(); return }
        for (const st of Object.values(tables)) st.panel = null
        $('userMenuPanel').hidden = true
        $('searchResults').hidden = true
        document.body.classList.remove('sidebar-open')
        if (storage.get(SIGNED_IN_KEY) === '1') render()
    })

    $('modalRoot').addEventListener('click', (e) => {
        if (e.target.closest('[data-modal-close]') || e.target.id === 'actionModal') { closeModal(); return }
        const finger = e.target.closest('[data-fp-finger]')
        if (finger && fp && !finger.disabled) { fp.selected = Number(finger.dataset.fpFinger); fp.message = ''; fp.scans = 0; renderFingerprint(); return }
        if (e.target.closest('[data-fp-scan]') && fp && !fp.busy) { scanFingerprint(); return }
        const remove = e.target.closest('[data-fp-remove]')
        if (remove && fp && !fp.busy) { removeFinger(Number(remove.dataset.fpRemove)); return }
        const faceButton = e.target.closest('[data-face]')
        if (faceButton && face && !face.saving) {
            if (faceButton.dataset.face === 'retake') runFaceCapture()
            else saveFace()
        }
    })

    $('loginForm').addEventListener('submit', (e) => {
        e.preventDefault()
        storage.set(SIGNED_IN_KEY, '1')
        render()
    })
    $('sidebarToggle').addEventListener('click', () => {
        if (window.matchMedia('(max-width: 1023px)').matches) document.body.classList.toggle('sidebar-open')
        else document.body.classList.toggle('collapsed')
    })
    $('sidebarBackdrop').addEventListener('click', () => document.body.classList.remove('sidebar-open'))
    $('globalSearch').addEventListener('input', (e) => globalSearch(e.target.value))
    $('globalSearch').addEventListener('focus', (e) => globalSearch(e.target.value))
    $('searchResults').addEventListener('click', () => { $('globalSearch').value = ''; $('searchResults').hidden = true })
    $('userMenuButton').addEventListener('click', () => {
        const panel = $('userMenuPanel')
        panel.hidden = !panel.hidden
        $('userMenuButton').setAttribute('aria-expanded', String(!panel.hidden))
    })
    $('signOut').addEventListener('click', () => {
        storage.remove(SIGNED_IN_KEY)
        $('userMenuPanel').hidden = true
        location.hash = '#/'
        render()
    })
    $('resetDemo').addEventListener('click', () => {
        D.resetLog()
        $('userMenuPanel').hidden = true
        notify({ title: 'Demo records cleared', body: 'Clock-ins made on the TimeClock were removed.' })
        render()
    })

    // Clock-ins made on the TimeClock demo in another tab show up live.
    window.addEventListener('storage', (e) => {
        if (e.key === D.EMPLOYEES_KEY) { D.refreshEmployees(); render(); return }
        if (e.key !== D.STORAGE_KEY) return
        try {
            const log = JSON.parse(e.newValue || '[]')
            const latest = log[log.length - 1]
            const employee = latest && D.findEmployee(latest.employee_id)
            if (employee) notify({ title: `${latest.type === 'time-out' ? 'Time out' : 'Time in'} recorded`, body: `${D.fullName(employee)} via ${enums.method[latest.method]?.[0] ?? latest.method} on the TimeClock.`, icon: 'clock', color: 'info' })
        } catch { /* ignore */ }
        render()
    })

    // ?demo-login skips the sign-in screen (used for direct links and screenshots).
    if (new URLSearchParams(location.search).has('demo-login')) storage.set(SIGNED_IN_KEY, '1')
    render()
})()
