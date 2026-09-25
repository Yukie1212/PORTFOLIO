/* Static port of the TimeClock Filament admin panel (app/Filament/Admin).
   Resources, columns, badges, and dashboard widgets mirror the originals; data
   comes from demo-data.js and nothing is sent to a server. */
(() => {
    'use strict'

    const D = window.TimeclockDemo
    const $ = (id) => document.getElementById(id)
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

        employees: () => listPage('Employees', 'New employee', 'employees', {
            plural: 'employees',
            rows: () => D.employees,
            columns: [
                col('employee_id', 'Employee ID', (r) => r.employee_id, { searchable: true, sortable: true }),
                col('fingerprint', 'Fingerprint', (r) => r.has_fingerprint, { html: (r) => `<span class="fi-fingerprint${r.has_fingerprint ? '' : ' none'}" title="${r.has_fingerprint ? 'Fingerprint enrolled' : 'No fingerprint'}">${h('finger-print')}</span>` }),
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
            actions: (r) => viewLink(`#/employees/${r.employee_id}`) + editLink,
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
        return header({ heading: title, crumbs: [[opts.crumb ?? title, `#/${key}`], ['List']], actions: newLabel ? newButton(newLabel) : '' })
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
            return header({ heading: `View ${e.employee_id}`, crumbs: [['Employees', '#/employees'], [e.employee_id], ['View']], actions: editButton })
                + `<div class="fi-page-content">
                <div class="fi-wi-stats four">
                    ${stat('Present', records.length, 'Total present records', 'check-circle', 'success', 'calendar-days')}
                    ${stat('Late', records.filter((r) => r.is_late).length, 'Total late records', 'clock', 'warning', 'exclamation-triangle')}
                    ${stat('Overtime', records.filter((r) => r.is_overtime).length, 'Total overtime records', 'arrow-trending-up', 'info', 'briefcase')}
                    ${stat('Undertime', records.filter((r) => r.is_undertime).length, 'Total undertime records', 'arrow-trending-down', 'danger', 'calendar')}
                </div>
                ${section('Employee information', `<div class="fi-profile" style="margin-bottom: 1.25rem"><div class="fi-avatar">${initials(D.fullName(e))}</div><div><strong>${esc(D.fullName(e))}</strong><span>${esc(e.position)} · ${esc(e.department)}</span></div></div>
                    ${entries([
                        ['Employee ID', esc(e.employee_id)], ['RFID UID', esc(e.rfid_uid)], ['Department', esc(e.department)],
                        ['First name', esc(e.first_name)], ['Middle name', esc(e.middle_name)], ['Last name', esc(e.last_name)],
                        ['Date of birth', esc(fmtLongDate(e.date_of_birth)) + (D.isBirthday(e) ? ` ${badge('Birthday today', 'warning')}` : '')],
                        ['Position', esc(e.position)],
                        ['Biometrics', `${e.has_fingerprint ? badge('Fingerprint enrolled', 'success', 'finger-print') : badge('No fingerprint', 'gray', 'finger-print')} ${badge('Face registered', 'success', 'face-smile')}`],
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

        const [resource = '', id] = currentRoute()
        renderNav(resource)
        const focused = keepFocus ? document.activeElement : null
        const focusSel = focused?.dataset?.act === 'search' ? `[data-ta="${focused.dataset.ta}"][data-act="search"]` : null
        const caret = focused?.selectionStart

        let html
        if (resource === '') html = pages.dashboard()
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
        if (t.dataset.act === 'search') {
            const st = tables[t.dataset.ta]
            st.search = t.value
            st.page = 1
            render({ keepFocus: true })
        }
    })
    main.addEventListener('change', (e) => {
        const t = e.target
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
        for (const st of Object.values(tables)) st.panel = null
        $('userMenuPanel').hidden = true
        $('searchResults').hidden = true
        document.body.classList.remove('sidebar-open')
        if (storage.get(SIGNED_IN_KEY) === '1') render()
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
