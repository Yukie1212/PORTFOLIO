/* Static port of the original TimeClock Home page (Home.vue, CameraCard.vue,
   FeedAndStaff.vue, PresentToday.vue, GreetingsCard.vue). The Laravel API,
   face-api.js models, ZKTeco bridge, and GPS are simulated with the shared
   sample data in demo-data.js. */
(() => {
    'use strict'

    const READY = 'Face verification ready.'
    const SCHEDULE = { time_in_start: '05:00', time_in_end: '11:59', time_out_start: '12:00', time_out_end: '23:59' }

    const demo = window.TimeclockDemo
    const employees = demo.employees
    const announcements = demo.announcements.filter((a) => a.status === 'published')
    const typeStyles = {
        general: { label: 'General', accent: '#004643', soft: 'rgba(0, 70, 67, 0.14)', text: '#001e1d' },
        urgent: { label: 'Urgent', accent: '#e16162', soft: 'rgba(225, 97, 98, 0.16)', text: '#001e1d' },
        event: { label: 'Event', accent: '#abd1c6', soft: 'rgba(171, 209, 198, 0.35)', text: '#001e1d' },
        holiday: { label: 'Holiday', accent: '#f9bc60', soft: 'rgba(249, 188, 96, 0.24)', text: '#001e1d' },
        policy: { label: 'Policy', accent: '#001e1d', soft: 'rgba(0, 30, 29, 0.12)', text: '#001e1d' },
    }

    const $ = (id) => document.getElementById(id)
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const icon = (name, cls = 'icon') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`
    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    const fullName = (e) => `${e.first_name} ${e.last_name}`.trim()

    /* ---------------- Toasts (PrimeVue Toast look) ---------------- */
    const toastIcons = { success: 'circle-check', error: 'circle-alert', info: 'info', warn: 'triangle-alert' }
    const toast = ({ severity, summary, detail, life = 5000 }) => {
        const el = document.createElement('div')
        el.className = `toast ${severity}`
        el.setAttribute('role', severity === 'error' ? 'alert' : 'status')
        el.innerHTML = `${icon(toastIcons[severity])}<div class="toast-text"><span class="toast-summary">${escapeHtml(summary)}</span><div class="toast-detail">${escapeHtml(detail)}</div></div><button type="button" class="toast-close" aria-label="Close">${icon('x')}</button>`
        el.querySelector('.toast-close').addEventListener('click', () => el.remove())
        $('toasts').appendChild(el)
        setTimeout(() => el.remove(), life)
    }

    /* ---------------- Feed & staff ---------------- */
    const formatDate = (date) => new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    const excerpt = (html, limit = 50) => {
        const text = new DOMParser().parseFromString(html, 'text/html').body.textContent.replace(/\s+/g, ' ').trim()
        return text.length > limit ? `${text.slice(0, limit).trim()}...` : text
    }

    const renderAnnouncements = () => {
        $('announcements').innerHTML = announcements.map((a) => {
            const s = typeStyles[a.type] ?? typeStyles.general
            return `<div class="announcement" style="--announcement-accent:${s.accent}">
                <p class="eyebrow">${formatDate(a.published_at)}</p>
                <div class="announcement-head"><h3>${escapeHtml(a.title)}</h3>
                <span class="type-pill" style="background:${s.soft};color:${s.text}">${s.label}</span></div>
                <p class="excerpt">${escapeHtml(excerpt(a.content))}</p>
                <button type="button" class="view-more" data-announcement="${a.id}">View more ${icon('arrow-right', 'icon icon-sm')}</button>
            </div>`
        }).join('')
    }

    const openAnnouncement = (id) => {
        const a = announcements.find((item) => item.id === id)
        if (!a) return
        const s = typeStyles[a.type] ?? typeStyles.general
        $('modalRoot').innerHTML = `<div class="modal-backdrop" id="modalBackdrop">
            <article class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
                <header class="modal-header" style="--announcement-accent:${s.accent};--announcement-soft:${s.soft}">
                    <div style="min-width:0"><p class="eyebrow">${s.label} Announcement</p><h2 id="modalTitle">${escapeHtml(a.title)}</h2></div>
                    <button type="button" class="modal-close" id="modalClose" aria-label="Close announcement">${icon('x')}</button>
                </header>
                <div class="modal-body scroll-list">${a.content}</div>
            </article></div>`
        $('modalClose').focus()
    }
    const closeAnnouncement = () => { $('modalRoot').innerHTML = '' }

    const avatar = (cls = 'icon icon-lg') => icon('circle-user', cls)

    const renderCelebrants = () => {
        const celebrants = employees.filter((e) => demo.isBirthday(e))
        $('birthdayCard').hidden = celebrants.length === 0
        $('celebrants').innerHTML = celebrants.map((c) => `<div class="celebrant">${avatar()}<div>
            <p class="person-name">${escapeHtml(fullName(c))}</p><p class="person-meta">${escapeHtml(c.department)}</p></div></div>`).join('')
    }

    let lastAdded = null
    const presentEmployees = () => demo.presentOn().map((r) => r.employee)
    const renderPresent = () => {
        const present = presentEmployees()
        $('presentCount').hidden = present.length === 0
        $('presentCount').textContent = present.length
        $('presentList').innerHTML = present.map((e) => `<div class="present-row${e.employee_id === lastAdded ? ' is-new' : ''}">${avatar()}<div>
            <p class="person-name">${escapeHtml(e.first_name)} ${escapeHtml(e.last_name)}</p><p class="person-meta">${escapeHtml(e.position)}</p></div></div>`).join('')
        lastAdded = null
    }

    /* ---------------- Greeting card ---------------- */
    const getDayGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 18) return 'Good afternoon'
        return 'Good evening'
    }
    const preferredVoiceNames = ['Microsoft Jenny', 'Microsoft Aria', 'Microsoft Zira', 'Google US English', 'Samantha', 'Karen']
    const speakGreeting = (message) => {
        if (!('speechSynthesis' in window)) return
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(message)
        const english = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
        utterance.lang = 'en-US'
        utterance.rate = 0.95
        utterance.voice = preferredVoiceNames.map((n) => english.find((v) => v.name.includes(n))).find(Boolean)
            ?? english.find((v) => v.lang === 'en-US') ?? english[0] ?? null
        window.speechSynthesis.speak(utterance)
    }
    const announceGreeting = ({ first_name, is_birthday, attendance_type }) => {
        const day = getDayGreeting()
        $('greetingIcon').textContent = is_birthday ? '🎂' : '👋'
        $('greetingTitle').textContent = `${day}, ${first_name}`
        $('greetingSub').textContent = is_birthday
            ? 'Happy birthday! Attendance recorded.'
            : attendance_type === 'time-out' ? 'Time out recorded. Take care.' : 'Time in recorded. Have a productive day.'
        const spoken = attendance_type === 'time-out'
            ? `${day}, ${first_name}. Time out recorded. Take care.`
            : is_birthday
                ? `${day}, ${first_name}. Happy birthday! Time in recorded. Have a productive day.`
                : `${day}, ${first_name}. Time in recorded. Have a productive day.`
        speakGreeting(spoken)
    }

    /* ---------------- Camera card state ---------------- */
    const state = { attendanceType: '', processingMethod: '', status: READY, showKeypad: false, hasTyped: false, cameraActive: false, silent: false }
    let stream = null
    let overlayTimer = null
    let lastScan = 0

    const render = () => {
        document.querySelectorAll('[data-action]').forEach((btn) => {
            const selected = btn.dataset.action === state.attendanceType
            btn.setAttribute('aria-pressed', String(selected))
            btn.querySelector('.selected-dot')?.remove()
            if (selected) btn.insertAdjacentHTML('beforeend', '<span class="selected-dot" aria-hidden="true"></span>')
        })
        const processing = Boolean(state.processingMethod)
        document.querySelectorAll('.action').forEach((btn) => { btn.disabled = processing })
        $('fingerprintIcon').innerHTML = `<use href="#i-${state.processingMethod === 'fingerprint' ? 'loader' : 'fingerprint'}"/>`
        $('fingerprintIcon').classList.toggle('spin', state.processingMethod === 'fingerprint')
        $('processing').hidden = !processing
        $('processingLabel').textContent = state.status && state.status !== READY ? state.status : 'Processing, please wait...'
        $('idle').hidden = processing
        $('keypad').hidden = !state.showKeypad
        $('statusText').hidden = !(state.showKeypad || state.status !== READY)
        $('statusText').textContent = state.status
        $('cameraCard').hidden = !state.cameraActive
        $('cameraCard').classList.toggle('silent', state.silent)
        $('cameraCard').setAttribute('aria-hidden', String(state.silent))
        $('cameraHint').hidden = !(state.cameraActive && !state.silent)
    }
    const setStatus = (text) => { state.status = text; render() }

    const updateTime = () => {
        const now = new Date()
        $('currentTime').textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
        $('currentDate').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    }

    const toMinutes = (t) => { const [h = '0', m = '0'] = t.split(':'); return Number(h) * 60 + Number(m) }
    const inRange = (m, s, e) => (s <= e ? m >= s && m <= e : m >= s || m <= e)
    const inferredAttendanceType = () => {
        const now = new Date()
        const m = now.getHours() * 60 + now.getMinutes()
        if (inRange(m, toMinutes(SCHEDULE.time_in_start), toMinutes(SCHEDULE.time_in_end))) return 'time-in'
        if (inRange(m, toMinutes(SCHEDULE.time_out_start), toMinutes(SCHEDULE.time_out_end))) return 'time-out'
        return m <= toMinutes(SCHEDULE.time_in_end) ? 'time-in' : 'time-out'
    }

    const focusRFID = () => {
        if (document.activeElement === $('passwordInput')) return
        if (document.activeElement?.closest?.('.demo-guide, .modal')) return
        try { $('rfidInput').focus({ preventScroll: true }) } catch { /* ignore */ }
    }

    const ensureFlowReady = (action) => {
        if (action) state.attendanceType = action
        state.showKeypad = true
        render()
        focusRFID()
    }

    /* Camera: real preview when permitted, simulated face-api overlay. */
    const initializeCamera = async () => {
        const video = $('video')
        if (stream) return true
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia unavailable')
            stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' }, audio: false })
            video.srcObject = stream
            await new Promise((resolve) => { video.onloadedmetadata = () => video.play().finally(resolve) })
            video.classList.add('loaded')
            $('cameraFallback').hidden = true
            return true
        } catch {
            stream = null
            $('cameraFallback').hidden = false
            return false
        }
    }

    const drawOverlay = (label) => {
        const canvas = $('overlay')
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (!w || !h) return
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, w, h)
        const bw = Math.min(w, h) * 0.42
        const bh = bw * 1.2
        const jitter = () => (Math.random() - 0.5) * 6
        const x = (w - bw) / 2 + jitter()
        const y = (h - bh) / 2 + jitter()
        ctx.strokeStyle = '#f9bc60'
        ctx.lineWidth = 3
        ctx.strokeRect(x, y, bw, bh)
        ctx.font = '14px Georgia'
        const tw = ctx.measureText(label).width + 8
        ctx.fillStyle = '#f9bc60'
        ctx.fillRect(x, y + bh, tw, 22)
        ctx.fillStyle = '#fff'
        ctx.fillText(label, x + 4, y + bh + 16)
    }
    const startOverlay = () => {
        clearOverlay()
        drawOverlay('Face detected')
        overlayTimer = setInterval(() => drawOverlay('Face detected'), 1200)
    }
    const clearOverlay = () => {
        if (overlayTimer) clearInterval(overlayTimer)
        overlayTimer = null
        const canvas = $('overlay')
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    }

    const openCameraForCapture = async ({ loadFaceVerification = true, silent } = {}) => {
        state.showKeypad = true
        state.cameraActive = true
        state.silent = silent ?? !loadFaceVerification
        render()
        await initializeCamera()
        if (!loadFaceVerification) { clearOverlay(); return }
        const previous = state.status
        setStatus('Loading face verification...')
        await wait(700)
        setStatus(previous === 'Loading face verification...' ? READY : previous)
        startOverlay()
    }

    const stopCamera = () => {
        stream?.getTracks().forEach((t) => t.stop())
        stream = null
        $('video').srcObject = null
        $('video').classList.remove('loaded')
        clearOverlay()
        state.cameraActive = false
        state.silent = false
    }

    const resetAttendanceSelection = () => {
        Object.assign(state, { attendanceType: '', showKeypad: false, hasTyped: false, processingMethod: '', status: READY })
        $('passwordInput').value = ''
        stopCamera()
        render()
        setTimeout(focusRFID, 50)
    }

    const startProcessing = (method, message) => { state.processingMethod = method; setStatus(message) }

    /* Simulated POST /attendance/verify-employee */
    const verifyEmployeeIdentifier = async (identifier, method) => {
        setStatus('Checking employee...')
        await wait(600)
        const employee = demo.findByCredential(identifier, method)
        if (employee) return employee
        const message = 'Employee is not existing.'
        toast({ severity: 'error', summary: 'Employee', detail: message })
        setStatus(message)
        resetAttendanceSelection()
        return null
    }

    /* Simulated sync store submitOrQueueAttendance + server response */
    const submitAttendance = async (employee, method) => {
        const attendanceType = state.attendanceType || inferredAttendanceType()
        startProcessing(method, 'Recording attendance...')
        await wait(800)
        const wasPresent = presentEmployees().includes(employee)
        demo.record(employee, attendanceType, method)
        if (attendanceType === 'time-in' && !wasPresent) lastAdded = employee.employee_id
        renderPresent()
        toast({ severity: 'success', summary: 'Success', detail: 'Attendance recorded successfully.' })
        announceGreeting({ first_name: employee.first_name, is_birthday: demo.isBirthday(employee), attendance_type: attendanceType })
        resetAttendanceSelection()
    }

    const verifyEmployeeFaceAndSubmit = async (identifier, method) => {
        const employee = await verifyEmployeeIdentifier(identifier, method)
        if (!employee) return

        if (method === 'rfid') {
            setStatus(`Recording attendance for ${fullName(employee)}...`)
            await openCameraForCapture({ loadFaceVerification: false, silent: true })
            await submitAttendance(employee, method)
            return
        }

        await openCameraForCapture({ loadFaceVerification: true })
        setStatus(`Checking face for ${fullName(employee)}...`)
        await wait(1200)
        setStatus(`Face matched ${fullName(employee)}.`)
        await wait(600)
        await submitAttendance(employee, method)
    }

    const submitRFIDAttendance = async (rfid) => {
        const scanned = String(rfid ?? '').trim()
        $('rfidInput').value = ''
        if (!scanned || state.processingMethod) return
        const now = Date.now()
        if (now - lastScan < 1000) return
        lastScan = now
        startProcessing('rfid', 'Processing RFID attendance...')
        await verifyEmployeeFaceAndSubmit(scanned, 'rfid')
    }

    const submitManualAttendance = async () => {
        const password = $('passwordInput').value.trim()
        if (!state.hasTyped) { $('passwordInput').value = ''; return }
        if (!password) {
            toast({ severity: 'warn', summary: 'Warning', detail: 'Enter password first.' })
            return
        }
        ensureFlowReady()
        startProcessing('keypad', 'Processing keypad attendance...')
        await verifyEmployeeFaceAndSubmit(password, 'keypad')
        $('passwordInput').value = ''
        state.hasTyped = false
    }

    // The simulated scanner matches whoever was registered most recently in the
    // admin demo, otherwise a random employee who has not clocked in yet.
    const pickEmployee = (canMatch) => {
        const candidates = employees.filter(canMatch)
        const present = presentEmployees()
        const waiting = candidates.filter((e) => !present.includes(e))
        const registered = waiting.filter((e) => e.registered_in_demo).sort((a, b) => b.created_at - a.created_at)
        if (registered.length) return registered[0]
        const pool = waiting.length ? waiting : candidates
        return pool[Math.floor(Math.random() * pool.length)]
    }

    const submitFaceAttendance = async () => {
        ensureFlowReady(state.attendanceType || undefined)
        await openCameraForCapture()
        startProcessing('face', 'Processing facial recognition...')
        setStatus('Recognizing face...')
        await wait(1400)
        const employee = pickEmployee((e) => e.has_face)
        if (!employee) {
            toast({ severity: 'error', summary: 'Face Recognition', detail: 'No registered employee faces are available.' })
            resetAttendanceSelection()
            return
        }
        drawOverlay(fullName(employee))
        setStatus(`Recognized ${fullName(employee)}.`)
        await wait(700)
        await submitAttendance(employee, 'face')
    }

    const submitFingerprintAttendance = async () => {
        ensureFlowReady(state.attendanceType || inferredAttendanceType())
        startProcessing('fingerprint', 'Connecting to Fingerprint scanner...')
        await wait(900)
        toast({ severity: 'info', summary: 'Fingerprint', detail: 'Scan your registered finger on the scanner.', life: 8000 })
        setStatus('Scan your registered finger on the scanner.')
        await wait(2200)
        const employee = pickEmployee((e) => e.fingerprints?.length > 0)
        if (!employee) {
            toast({ severity: 'error', summary: 'Fingerprint', detail: 'No registered fingerprints are available.' })
            resetAttendanceSelection()
            return
        }
        setStatus('Fingerprint matched. Recording attendance...')
        await openCameraForCapture({ loadFaceVerification: false, silent: true })
        await wait(600)
        setStatus('Recording fingerprint attendance...')
        await wait(700)
        await submitAttendance(employee, 'fingerprint')
    }

    /* ---------------- Wiring ---------------- */
    document.querySelectorAll('[data-action]').forEach((btn) => btn.addEventListener('click', () => {
        ensureFlowReady(btn.dataset.action)
        $('passwordInput').value = ''
        state.hasTyped = false
    }))
    $('faceButton').addEventListener('click', submitFaceAttendance)
    $('fingerprintButton').addEventListener('click', submitFingerprintAttendance)
    $('submitButton').addEventListener('click', submitManualAttendance)
    $('passwordInput').addEventListener('input', () => { state.hasTyped = true })
    $('passwordInput').addEventListener('focus', (e) => e.target.select())
    $('passwordInput').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        submitManualAttendance()
    })

    let rfidTimeout = null
    $('rfidInput').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        clearTimeout(rfidTimeout)
        submitRFIDAttendance($('rfidInput').value)
    })
    $('rfidInput').addEventListener('input', () => {
        clearTimeout(rfidTimeout)
        // Card readers type the whole UID at once; wait briefly for Enter.
        rfidTimeout = setTimeout(() => submitRFIDAttendance($('rfidInput').value), 400)
    })
    $('tapRfid').addEventListener('click', () => submitRFIDAttendance(employees[0].rfid_uid))

    $('announcements').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-announcement]')
        if (btn) openAnnouncement(Number(btn.dataset.announcement))
    })
    $('modalRoot').addEventListener('click', (e) => {
        if (e.target.id === 'modalBackdrop' || e.target.closest('#modalClose')) closeAnnouncement()
    })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAnnouncement() })
    document.addEventListener('click', (e) => {
        if (e.target === $('passwordInput') || e.target.closest('.demo-guide, .modal-backdrop, button')) return
        focusRFID()
    })

    if (window.matchMedia('(max-width: 47.99rem)').matches) $('demoGuide').open = false
    window.addEventListener('storage', (e) => {
        if (e.key === demo.EMPLOYEES_KEY) {
            demo.refreshEmployees()
            renderCelebrants()
        }
        if (e.key === demo.STORAGE_KEY || e.key === demo.EMPLOYEES_KEY) renderPresent()
    })
    renderAnnouncements()
    renderCelebrants()
    renderPresent()
    $('greetingTitle').textContent = getDayGreeting()
    updateTime()
    setInterval(updateTime, 1000)
    render()
    focusRFID()
})()
