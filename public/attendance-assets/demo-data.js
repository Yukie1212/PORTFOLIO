/* Shared sample data for the TimeClock and admin demos. Everything is generated
   in the browser; clock-ins made on the TimeClock are kept in localStorage so the
   admin panel (opened in another tab) can show them. */
window.TimeclockDemo = (() => {
    'use strict'

    const STORAGE_KEY = 'timeclock-demo-log-v1'
    const SHIFT = { start: 8 * 60, end: 17 * 60 }

    const pad = (n) => String(n).padStart(2, '0')
    const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
    const at = (day, minutes) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60)

    // Small deterministic PRNG so the sample history is identical on every load.
    let seed = 20260525
    const random = () => {
        seed |= 0
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const between = (min, max) => Math.round(min + random() * (max - min))

    const departments = [
        { id: 1, name: 'Information Technology' },
        { id: 2, name: 'Operations' },
        { id: 3, name: 'Human Resources' },
        { id: 4, name: 'Finance' },
        { id: 5, name: 'Sales' },
        { id: 6, name: 'Logistics' },
    ].map((d) => ({ ...d, created_at: addDays(today, -210) }))

    const birthdayToday = `1996-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    const employees = [
        ['1001', 'Alex', 'Morgan', 'Reyes', birthdayToday, 'IT Specialist', 1],
        ['1002', 'Jamie', 'Lee', 'Santos', '1993-02-14', 'Operations Supervisor', 2],
        ['1003', 'Sam', 'Rivera', 'Cruz', '1998-07-09', 'HR Associate', 3],
        ['1004', 'Taylor', 'Cruz', 'Lim', '1995-11-23', 'Accounting Staff', 4],
        ['1005', 'Jordan', 'Bautista', 'Garcia', '1990-04-02', 'Sales Executive', 5],
        ['1006', 'Casey', 'Navarro', 'Tan', '1997-09-18', 'Warehouse Lead', 6],
        ['1007', 'Riley', 'Mendoza', 'Ramos', '1994-01-30', 'Payroll Officer', 4],
        ['1008', 'Morgan', 'Villanueva', 'Chua', '1992-06-11', 'Network Administrator', 1],
        ['1009', 'Avery', 'Domingo', 'Aquino', '1999-12-05', 'Recruitment Specialist', 3],
        ['1010', 'Quinn', 'Castillo', 'Lopez', '1991-08-27', 'Delivery Coordinator', 6],
        ['1011', 'Drew', 'Fernandez', 'Uy', '1996-03-16', 'Account Manager', 5],
        ['1012', 'Skyler', 'Pascual', 'Dela Cruz', '1998-10-08', 'Operations Analyst', 2],
    ].map(([employee_id, first_name, last_name, middle_name, date_of_birth, position, department_id], index) => ({
        id: index + 1,
        employee_id,
        rfid_uid: `00123456${pad(78 + index)}`,
        first_name,
        last_name,
        middle_name,
        date_of_birth,
        position,
        department_id,
        department: departments.find((d) => d.id === department_id).name,
        has_fingerprint: index % 4 !== 3,
        has_face: true,
        created_at: addDays(today, -200 + index * 3),
    }))
    const fullName = (e) => `${e.first_name} ${e.last_name}`
    const isBirthday = (e) => e.date_of_birth.slice(5) === birthdayToday.slice(5)
    const findEmployee = (identifier) => employees.find((e) => e.employee_id === identifier || e.rfid_uid === identifier)

    /* ---------- Seeded attendance history (last 7 days) ---------- */
    const methods = ['rfid', 'rfid', 'fingerprint', 'face', 'keypad']
    const presentToday = new Set(['1002', '1003', '1005', '1006', '1008', '1011'])
    const seeded = []
    let nextId = 1
    for (let offset = -13; offset <= 0; offset++) {
        const day = addDays(today, offset)
        if (day.getDay() === 0) continue // no Sunday shift
        for (const employee of employees) {
            const isToday = offset === 0
            if (isToday ? !presentToday.has(employee.employee_id) : random() > 0.88) continue
            const inMinutes = between(7 * 60 + 25, 8 * 60 + 20)
            let outMinutes = isToday ? null : between(17 * 60, 19 * 60 + 15)
            if (!isToday && random() < 0.08) outMinutes = between(15 * 60 + 30, 16 * 60 + 50)
            seeded.push(buildRecord(nextId++, employee, day, inMinutes, outMinutes, methods[between(0, methods.length - 1)]))
        }
    }

    function buildRecord(id, employee, day, inMinutes, outMinutes, method) {
        const lateMinutes = inMinutes != null ? Math.max(0, inMinutes - SHIFT.start) : 0
        const undertime = outMinutes != null ? Math.max(0, SHIFT.end - outMinutes) : 0
        const overtime = outMinutes != null ? Math.max(0, outMinutes - (SHIFT.end + 60)) : 0
        return {
            id,
            employee_id: employee.employee_id,
            rfid_uid: method === 'rfid' ? employee.rfid_uid : null,
            attendance_type: outMinutes != null ? 'time-out' : 'time-in',
            attendance_method: method,
            attendance_date: day,
            time_in: inMinutes != null ? at(day, inMinutes) : null,
            time_out: outMinutes != null ? at(day, outMinutes) : null,
            status: lateMinutes > 0 ? 'late' : 'present',
            is_late: lateMinutes > 0,
            late_minutes: lateMinutes,
            is_undertime: undertime > 0,
            undertime_minutes: undertime,
            is_overtime: overtime > 0,
            overtime_minutes: overtime,
            overtime_status: overtime > 0 ? (day < addDays(today, -2) ? 'approved' : 'pending') : null,
            location: 'Head Office, Makati City',
            latitude: 14.554729 + (random() - 0.5) / 5000,
            longitude: 121.024445 + (random() - 0.5) / 5000,
        }
    }

    /* ---------- Clock-ins made on the TimeClock demo ---------- */
    const readLog = () => {
        try {
            const log = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
            return Array.isArray(log) ? log.filter((entry) => entry.date === dateKey(today)) : []
        } catch {
            return []
        }
    }
    const record = (employee, type, method) => {
        const entry = { employee_id: employee.employee_id, type, method, at: new Date().toISOString(), date: dateKey(today) }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...readLog(), entry]))
        } catch {
            memoryLog.push(entry)
        }
        return entry
    }
    const memoryLog = []
    const resetLog = () => {
        memoryLog.length = 0
        try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }

    const attendances = () => {
        const records = seeded.map((r) => ({ ...r }))
        let id = seeded.length + 1
        for (const entry of [...readLog(), ...memoryLog]) {
            const employee = findEmployee(entry.employee_id)
            if (!employee) continue
            const time = new Date(entry.at)
            const minutes = time.getHours() * 60 + time.getMinutes()
            const existing = records.find((r) => r.employee_id === entry.employee_id && dateKey(r.attendance_date) === dateKey(today))
            if (entry.type === 'time-in') {
                if (!existing) records.push({ ...buildRecord(id++, employee, today, minutes, null, entry.method), time_in: time, from_timeclock: true })
                continue
            }
            const base = existing ?? buildRecord(id++, employee, today, null, minutes, entry.method)
            const updated = { ...buildRecord(base.id, employee, today, base.time_in ? base.time_in.getHours() * 60 + base.time_in.getMinutes() : null, minutes, base.attendance_method), time_in: base.time_in, time_out: time, from_timeclock: true }
            if (existing) records[records.indexOf(existing)] = updated
            else records.push(updated)
        }
        return records.map((r) => ({ ...r, employee: findEmployee(r.employee_id) }))
    }

    const presentOn = (day = today) => attendances()
        .filter((r) => r.time_in && dateKey(r.attendance_date) === dateKey(day))
        .sort((a, b) => a.time_in - b.time_in)

    /* ---------- Other admin resources ---------- */
    const announcements = [
        { id: 1, type: 'general', status: 'published', is_pinned: true, created_by: 'HR Admin', published_at: today, title: 'Welcome to TimeClock', content: '<p>Record your attendance with your RFID card, keypad password, fingerprint, or face.</p><p>Choose <strong>Time In</strong> or <strong>Time Out</strong> first, then scan or enter your password.</p>' },
        { id: 2, type: 'event', status: 'published', is_pinned: false, created_by: 'HR Admin', published_at: addDays(today, -1), title: 'Quarterly town hall', content: '<p>Join the quarterly town hall this Friday at 3:00 PM in the main conference room.</p><ul><li>Company updates</li><li>Recognition awards</li><li>Open forum</li></ul>' },
        { id: 3, type: 'policy', status: 'published', is_pinned: false, created_by: 'System Administrator', published_at: addDays(today, -3), title: 'Attendance photo policy', content: '<p>A photo is captured with every attendance record for verification. Please face the camera clearly when clocking in or out.</p>' },
        { id: 4, type: 'holiday', status: 'draft', is_pinned: false, created_by: 'HR Admin', published_at: null, title: 'Upcoming holiday schedule', content: '<p>The office will be closed on the next public holiday. Draft pending approval.</p>' },
    ].map((a, i) => ({ ...a, created_at: a.published_at ?? addDays(today, -i), updated_at: a.published_at ?? addDays(today, -i) }))

    const users = [
        { id: 1, name: 'System Administrator', email: 'admin@timeclock.example', email_verified_at: addDays(today, -210) },
        { id: 2, name: 'HR Admin', email: 'hr@timeclock.example', email_verified_at: addDays(today, -180) },
        { id: 3, name: 'Payroll Reviewer', email: 'payroll@timeclock.example', email_verified_at: null },
    ].map((u) => ({ ...u, created_at: u.email_verified_at ?? addDays(today, -30) }))

    const zones = [
        { id: 1, name: 'Head Office', latitude: 14.554729, longitude: 121.024445, radius_meters: 150, policy: 'strict', is_active: true, assigned_employees: 9 },
        { id: 2, name: 'Pasig Warehouse', latitude: 14.576377, longitude: 121.085104, radius_meters: 250, policy: 'strict', is_active: true, assigned_employees: 2 },
        { id: 3, name: 'Field Sales', latitude: 14.599512, longitude: 120.984222, radius_meters: 1500, policy: 'relaxed', is_active: true, assigned_employees: 2 },
        { id: 4, name: 'Old Branch', latitude: 14.676041, longitude: 121.043700, radius_meters: 200, policy: 'relaxed', is_active: false, assigned_employees: 0 },
    ]

    const unlockers = [
        { id: 1, employee_id: '1001', is_active: true },
        { id: 2, employee_id: '1008', is_active: true },
        { id: 3, employee_id: '1002', is_active: false },
    ]
    const unlockLogs = [
        [1, 'fingerprint', 0, 7 * 60 + 2], [2, 'rfid', -1, 6 * 60 + 55], [1, 'rfid', -2, 7 * 60 + 10],
        [2, 'fingerprint', -3, 7 * 60], [3, 'rfid', -5, 7 * 60 + 5], [1, 'fingerprint', -6, 6 * 60 + 58],
    ].map(([unlocker, method, offset, minutes], i) => ({ id: i + 1, timeclock_authorized_user_id: unlocker, method, ip_address: `20.20.52.${60 + unlocker}`, unlocked_at: at(addDays(today, offset), minutes) }))
    unlockers.forEach((u) => { u.unlocks = unlockLogs.filter((l) => l.timeclock_authorized_user_id === u.id).length })

    const activity = [
        ['Created', 'Announcement', 'Welcome to TimeClock', 'HR Admin', 0, 7 * 60 + 40],
        ['Updated', 'Employee', 'Alex Morgan', 'System Administrator', -1, 16 * 60 + 5],
        ['Updated', 'Zone', 'Head Office', 'System Administrator', -2, 10 * 60 + 12],
        ['Created', 'Employee', 'Skyler Pascual', 'HR Admin', -4, 9 * 60 + 30],
        ['Approved', 'Attendance', 'Casey Navarro overtime', 'Payroll Reviewer', -4, 17 * 60 + 45],
        ['Login', 'Access', 'Admin panel', 'System Administrator', 0, 7 * 60 + 5],
    ].map(([event, subject_type, subject, causer, offset, minutes], i) => ({ id: i + 1, event, subject_type, subject, causer, created_at: at(addDays(today, offset), minutes) }))

    return {
        STORAGE_KEY,
        today,
        addDays,
        dateKey,
        departments,
        employees,
        fullName,
        isBirthday,
        findEmployee,
        attendances,
        presentOn,
        record,
        resetLog,
        announcements,
        users,
        zones,
        unlockers,
        unlockLogs,
        activity,
    }
})()
