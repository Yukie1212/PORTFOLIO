import { useId, useState } from 'react'
import './App.css'

const projects = [
  { title: 'Attendance Monitoring System', category: 'FULL-STACK WEB / HARDWARE INTEGRATION', description: 'A browser-ready demonstration of the contracted attendance platform, showing the employee timeclock and administrative dashboard workflows connected to RFID, facial recognition, fingerprint integration, attendance reporting, geofenced validation, and offline synchronization.', tags: ['Laravel & PHP', 'Vue & Inertia.js', 'Filament', 'RFID'], type: 'attendance', url: './attendance-monitoring-demo.html', linkLabel: 'Open browser demo' },
  { title: 'Mobile Attendance Prototype', category: 'REACT / LOCATION-BASED ATTENDANCE', description: 'A separate React prototype for field attendance, with an interactive Leaflet map, configurable itinerary locations, and distance-based geofence checks. Developed as a browser-based exploration of mobile attendance workflows.', tags: ['React', 'Leaflet', 'Geolocation'], type: 'mobile', url: './mobile-attendance-demo.html', linkLabel: 'View mobile demo' },
  { title: 'Attendance Kiosk Integration', category: 'WINDOWS / HARDWARE INTEGRATION', description: 'The hardware integration layer of the attendance platform: a local ZKTeco fingerprint agent, doorway sensing tools, and a kiosk installer. Connects on-site attendance devices with the central Laravel application.', tags: ['Windows agents', 'ZKTeco', 'Kiosk deployment'], type: 'kiosk', url: 'mailto:angelomiguelr.cua@gmail.com?subject=Attendance%20Kiosk%20Integration', linkLabel: 'Discuss the integration' },
  { title: 'ICT & Security Systems — Client Engagements', category: 'NETWORKING / CCTV / SECURITY INSTALLATION', description: 'Layout and installation of ICT and security systems for McAsia Food Trade Corporation, Luxe Prime Realty, Medical Gallery Corporation, and Camfin Lending Inc. Includes network and CCTV installation, Windows Server and Active Directory configuration, firewall setup, NAS and Plex server deployment, and general hardware support.', tags: ['Windows Server', 'Active Directory', 'CCTV', 'Firewall', 'NAS'], type: 'security', url: 'mailto:angelomiguelr.cua@gmail.com?subject=ICT%20and%20Security%20Systems%20Client%20Engagements', linkLabel: 'Discuss client systems' },
  { title: 'McAsia Food Trade Corporation — Power BI Dashboard', category: 'DATA ANALYSIS / BUSINESS INTELLIGENCE', description: 'A reporting and dashboard system designed to turn operational data into clear, executive-ready insights for decision-making. The dashboards consolidate key business metrics, support KPI monitoring, and help visualize trends related to sales, performance, and operational activity across the organization.', tags: ['Power BI', 'KPI Reporting', 'Data Analysis', 'Dashboard Design'], type: 'data', url: '/March%20sales%20report.pbix', linkLabel: 'Open Power BI file' },
  { title: 'Timelight', category: 'EMBEDDED SYSTEMS / PROTOTYPING', description: 'A speech-timing device built with an Arduino Nano, buzzer, and LED lights. Audible and visual cues help speakers keep track of their time.', tags: ['Arduino Nano', 'Embedded systems', 'Prototyping'], type: 'embedded', url: 'https://badjau.github.io/timelight/', linkLabel: 'Explore Timelight' },
  { title: 'ShopEase: BLE-Enabled Product Locator System with Real-Time Pricing and Dynamic Aisle Mapping for Supermarkets', category: 'BLE / RETAIL TECHNOLOGY / SMART CART SYSTEM', description: 'A supermarket product locator that uses Bluetooth Low Energy to guide shoppers through dynamically mapped aisles, surface real-time pricing, and keep product discovery and basket decisions in one connected experience. A Raspberry Pi 5, IPS DSI display, ESP32 positioning anchor, barcode scanner, and 5V Li-ion UPS support the smart cart interface.', tags: ['BLE positioning', 'Dynamic aisle mapping', 'Real-time pricing', 'Raspberry Pi 5', 'ESP32'], type: 'shop', url: 'https://cad.onshape.com/documents/45252feeec2d60c3249cbd84/w/e232dfad5ef60faf8680bbec/e/9abaa77c679d8b0c92cfc4a1?renderMode=0&uiState=6ab4f63d0996780a076d6def', linkLabel: 'Open smart cart casing' },
  { title: 'RFID Gym Access System', category: 'RESEARCH / WEB + ACCESS CONTROL', description: 'A smart gym access system that verifies registered members through RFID authentication and controls door access with real-time feedback. The setup uses an ESP32 Vroom32, RFID scanner, magnetic lock, 24V buzzer, and red/green indicator LEDs to signal successful or denied access attempts.', tags: ['ESP32 Vroom32', 'RFID', 'Magnetic lock', 'Gym access'], type: 'access', url: 'https://cad.onshape.com/documents/a18f28a1a9cb6931ccf0aee3/w/2ab899e5d080cd54efd4ab7b/e/b31c332504ffcc849bf053c9', linkLabel: 'View project details' },
]
const capabilities = [
  ['01', 'Data analysis & reporting', 'Power BI dashboard development, business reporting, KPI tracking, Excel analysis, and data-driven decision support.'],
  ['02', 'IT support & infrastructure', 'Network deployment, structured cabling, hardware diagnostics, CCTV installation, workstation support, and systems maintenance.'],
  ['03', 'Embedded systems & software', 'Python automation, C/C++, PHP, Arduino, ESP32, Raspberry Pi, sensors, IoT integration, and practical hardware solutions.'],
]


function HeroArt() {
  return <svg className="technical-art" viewBox="0 0 600 440" fill="none" aria-hidden="true">
    <rect width="600" height="440" fill="#e7efeb" />
    <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="96" y="106" width="172" height="214" rx="8" fill="currentColor" fillOpacity=".08" />
      <rect x="119" y="135" width="126" height="78" rx="4" />
      <path d="M139 160h84m-84 25h57M137 247h91m-91 24h62" />
      <circle cx="182" cy="289" r="16" />
      <path d="M182 273v32m-16-16h32M307 287h128l-24 74H331l-24-74Zm15 0-27-83h-32M328 361h-10m100 0h-10" />
      <circle cx="334" cy="378" r="16" />
      <circle cx="407" cy="378" r="16" />
      <rect x="330" y="118" width="106" height="63" rx="5" fill="currentColor" fillOpacity=".08" />
      <path d="M350 143h66m-66 20h45M269 178l38 35m128-63 38-31M435 150h48" strokeDasharray="5 7" />
      <path d="M468 125c20 16 20 44 0 60m20-76c32 25 32 67 0 92" opacity=".65" />
    </g>
    <g fill="currentColor" fontFamily="monospace" fontSize="11" opacity=".7"><text x="35" y="35">FIELD SYSTEMS / DATA + HARDWARE</text><text x="35" y="413">CONCEPT DIAGRAM · FROM IDEA TO DEPLOYMENT</text></g>
  </svg>
}

function SmartCartArt() {
  return <svg className="technical-art" viewBox="0 0 600 440" fill="none" aria-hidden="true">
    <rect width="600" height="440" fill="currentColor" fillOpacity=".04" />
    <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M130 174h62l30 143h215l42-112H207" fill="currentColor" fillOpacity=".12" />
      <path d="M192 174 222 317m-15-80h233m-213 80h215M130 174l-22-28H78" />
      <circle cx="250" cy="347" r="20" fill="currentColor" fillOpacity=".12" /><circle cx="414" cy="347" r="20" fill="currentColor" fillOpacity=".12" />
      <path d="M250 367v14m164-14v14M277 174l-12-65h118l-7 65Z" fill="currentColor" fillOpacity=".18" />
      <rect x="283" y="122" width="82" height="36" rx="3" fill="currentColor" fillOpacity=".12" />
      <path d="M299 135h50m-50 12h33M478 173l35-18m-32 42 43-3M465 151l27-31" strokeDasharray="5 6" />
      <path d="M493 104c29 19 29 55 0 74m22-91c43 28 43 80 0 108" opacity=".7" />
      <path d="M411 202h24v35h-24zM417 209h12m-12 10h12" />
    </g>
    <g fill="currentColor" fontFamily="monospace" fontSize="11" opacity=".7"><text x="35" y="35">SHOP EASE / SMART CART</text><text x="35" y="413">BLE POSITIONING · LIVE PRICE · AISLE MAP</text></g>
  </svg>
}

function TechnicalArt({ type = 'enclosure' }) {
  const artId = useId()
  if (type === 'hero') return <HeroArt />
  if (type === 'shop') return <SmartCartArt />
  return <svg className="technical-art" viewBox="0 0 600 440" fill="none" aria-hidden="true">
    <defs><pattern id={`grid-${artId}`} width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" stroke="currentColor" opacity=".1" /></pattern><linearGradient id={`face-${artId}`} x2="1" y2="1"><stop stopColor="currentColor" stopOpacity=".28"/><stop offset="1" stopColor="currentColor" stopOpacity=".03"/></linearGradient></defs>
    <rect width="600" height="440" fill={`url(#grid-${artId})`}/>
    <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    {type === 'security' ? <><rect x="92" y="126" width="125" height="178" rx="5" fill={`url(#face-${artId})`}/><path d="M110 151h89m-89 29h89m-89 29h89m-89 29h55M110 267h89"/><circle cx="171" cy="267" r="7"/><path d="M356 170 475 112v91l-119 58Z" fill={`url(#face-${artId})`}/><path d="m356 170 119-58m-119 58v91m119-207v91M260 214h58m-58 0 45-28m-45 28 45 28"/><path d="M318 214h38m-78 73h-34v-51M205 214h55" strokeDasharray="5 6"/><path d="m441 275 35 17-70 37-35-17Z"/><path d="M371 312v38m70-75v38m-70 0 70-38"/></> : type === 'data' ? <><rect x="102" y="110" width="396" height="240" rx="4" fill={`url(#face-${artId})`}/><path d="M135 150h120m-120 25h80"/><path d="M145 300V222h48v78m28 0V190h48v110m28 0V240h48v60m28 0V165h48v135"/><path d="M135 315h340"/><circle cx="400" cy="150" r="25"/><path d="m388 150 9 9 17-20"/></> : type === 'embedded' ? <><rect x="185" y="105" width="230" height="220" rx="8" fill={`url(#face-${artId})`}/><rect x="225" y="145" width="150" height="80" rx="3"/><path d="M250 170h100m-100 25h60M215 125h-35m35 180h-35m265-180h-35m35 180h-35M205 105V70m35 35V70m35 35V70m35 35V70m35 35V70m35 35V70M205 325v35m35-35v35m35-35v35m35-35v35m35-35v35m35-35v35"/><circle cx="300" cy="267" r="18"/><path d="M300 249v36m-18-18h36"/></> : type === 'shop' ? <><path d="m135 160 165-70 165 70-165 70Z" fill={`url(#face-${artId})`}/><path d="M135 160v105l165 70 165-70V160m-165 70v105"/><path d="M185 153h230m-205-12v38m52-58v58m52-58v58m52-38v38"/><rect x="267" y="130" width="67" height="45" rx="3"/><path d="M281 144h39m-39 14h27"/><circle cx="206" cy="294" r="13"/><circle cx="394" cy="294" r="13"/><path d="M206 294h188"/></> : type === 'access' ? <><rect x="206" y="105" width="190" height="245" rx="8" fill={`url(#face-${artId})`}/><rect x="247" y="140" width="108" height="65" rx="4"/><circle cx="301" cy="173" r="15"/><path d="M301 188v32m-28-1h56m-89 53h122"/><path d="M206 235h-55m245 0h55M181 210v50m240-50v50" strokeDasharray="5 6"/><circle cx="151" cy="235" r="17"/><path d="M143 235h16m-8-8v16"/></> : type === 'mobile' ? <><rect x="218" y="62" width="166" height="316" rx="18" fill={`url(#face-${artId})`}/><rect x="238" y="106" width="126" height="190" rx="4"/><path d="M258 135h86m-86 28h58m-58 34h86m-86 30h65"/><circle cx="301" cy="266" r="16"/><path d="M301 251v30m-15-15h30M271 80h60"/></> : type === 'attendance' ? <><path d="m145 237 157-91 158 91-157 91Z" fill={`url(#face-${artId})`}/><path d="M145 237v20l158 92 157-92v-20M303 328v21"/><path d="m251 235 51-30 54 30-53 31Z"/><path d="m221 235 81-47 84 47-83 49Z"/><path d="m192 235 110-64 113 64-112 66Z"/><path d="M302 203v-64" strokeDasharray="5 6"/><ellipse cx="302" cy="127" rx="39" ry="22"/><ellipse cx="302" cy="103" rx="69" ry="38" opacity=".65"/><ellipse cx="302" cy="79" rx="99" ry="55" opacity=".35"/><path d="m174 250 49 28m159-28 49-28"/></> : <><path d="M145 236 302 145 462 236 305 330Z" fill={`url(#face-${artId})`}/><path d="M145 236v45l160 93 157-92v-46M305 330v44"/><path d="M145 157 302 66 462 157 305 250Z" fill={`url(#face-${artId})`}/><path d="M145 157v26l160 93 157-92v-27M305 250v26"/><path d="m187 157 115-66 119 66-116 67Z"/><path d="m229 155 73-42 77 44-74 42Z"/><path d="M160 195v30m286-30v30M305 288v31" strokeDasharray="4 5"/><path d="m177 272 58 34m-58-26 58 34m-58-26 58 34"/><circle cx="412" cy="288" r="4"/></>}
    <path d="M100 315v55m0-12 92 53M90 352l20 12M182 399l20 12M488 168v133m-7-131h14m-14 129h14" opacity=".45"/>
    </g><g fill="currentColor" fontFamily="monospace" fontSize="11" opacity=".65"><text x="35" y="35">{type === 'security' ? 'FIG. 03 / NETWORK + SECURITY' : type === 'data' ? 'FIG. 04 / REPORTING SYSTEM' : type === 'embedded' ? 'FIG. 05 / EMBEDDED DEVICE' : type === 'shop' ? 'FIG. 06 / RETAIL SYSTEM' : type === 'mobile' ? 'FIG. 07 / MOBILE WORKFLOW' : type === 'access' ? 'FIG. 08 / ACCESS CONTROL' : type === 'kiosk' ? 'FIG. 09 / KIOSK INTEGRATION' : 'FIG. 01 / CONNECTED SYSTEM'}</text><text x="35" y="413">CONCEPT DIAGRAM · NOT TO SCALE</text><text x="510" y="413">AMC</text></g>
  </svg>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollToSection = (event, targetId) => {
    const target = document.getElementById(targetId)

    if (event) {
      event.preventDefault()
    }

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    window.location.hash = targetId
  }

  return <div className="page-shell">
    <a className="skip-link" href="#main" onClick={(event) => scrollToSection(event, 'main')}>Skip to content</a>
    <header className="topbar"><a className="brand" href="#home" onClick={(event) => scrollToSection(event, 'home')} aria-label="Angelo Miguel R. Cua, home">amc<span>✳</span></a><span className="header-note">DATA / SOFTWARE / HARDWARE / INFRASTRUCTURE</span><button className="menu-toggle" aria-expanded={menuOpen} aria-controls="navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close −' : 'Menu +'}</button><nav id="navigation" className={menuOpen ? 'nav open' : 'nav'} aria-label="Main navigation">{[['work','Work'],['about','About'],['experience','Experience'],['skills','Expertise'],['contact','Contact']].map(([id,label]) => <a key={id} href={`#${id}`} onClick={(event) => { setMenuOpen(false); scrollToSection(event, id) }}>{label}<span>↗</span></a>)}</nav></header>
    <main id="main">
      <section className="hero" id="home"><div className="hero-top"><p className="eyebrow"><span className="status-dot"/> ANGELO MIGUEL R. CUA</p><p className="edition">PORTFOLIO / 2026</p></div><div className="hero-layout"><div className="hero-copy"><h1>Data-driven systems.<br/><span>Practical solutions.</span></h1><div className="hero-bottom"><p>Computer Engineering graduate & Data Analyst / Data and Support Engineer.<br/>Combining Power BI insight, system support, software development, and hands-on technical execution.</p><a className="round-link" href="#work" onClick={(event) => scrollToSection(event, 'work')} aria-label="Explore selected work">↓</a></div></div><div className="hero-visual"><div className="visual-label"><span>FORM / FUNCTION</span><span>01—02</span></div><TechnicalArt type="hero"/><div className="visual-footer"><span>FROM CONCEPT TO REALITY</span><span className="cross">+</span></div></div></div><div className="hero-strip"><span>POWER BI & REPORTING</span><span>+</span><span>IT SUPPORT & NETWORKING</span><span>+</span><span>EMBEDDED SYSTEMS</span></div></section>
      <section id="work" className="section"><div className="section-heading"><div><p className="eyebrow">01 / SELECTED WORK</p><h2>Ideas made tangible<span>.</span></h2></div><p>Software, hardware, and the systems<br/>that bring them together.</p></div><div className="project-grid">{projects.map((project, index) => <article className={`project project-${project.type}`} key={project.title}><a className="project-image" href={project.url} target="_blank" rel="noreferrer" aria-label={project.linkLabel || `Open ${project.title} CAD model in Onshape (new tab)`}><TechnicalArt type={project.type}/><span className="project-open">↗</span></a><div className="project-meta"><span>{project.category}</span><span>0{index+1}</span></div><a className="project-title" href={project.url} target="_blank" rel="noreferrer"><h3>{project.title}</h3><span>↗</span></a><p>{project.description}</p><a className="project-action" href={project.url} target="_blank" rel="noreferrer">{project.linkLabel || 'View CAD model'}</a><div className="tags">{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div></article>)}</div></section>
      <section id="about" className="section about"><p className="eyebrow">02 / THE PERSON BEHIND THE WORK</p><div><h2>Curious by nature.<br/><span>Practical by design.</span></h2><div className="about-copy"><p>I'm Angelo, a Computer Engineering graduate and Data Analyst with hands-on experience in IT support, network infrastructure, data reporting, server installation, and embedded systems. I build and maintain technology that turns operational data and real-world systems into useful, reliable solutions.</p><p>My work spans corporate ICT and security installations, Power BI dashboard development, KPI analysis, full-stack web applications, robotics, and IoT. I combine practical implementation with clear communication, from troubleshooting a workstation to integrating a smart access system for a gym environment.</p></div></div></section>
      <section id="experience" className="section experience"><div><p className="eyebrow">03 / EXPERIENCE & EDUCATION</p><h2>Hands-on.<br/>From the start.</h2></div><div className="career-list">
        <article><p className="career-date">APRIL 2026 — PRESENT</p><h3>Data Analyst & Support Engineer</h3><h4>McAsia Food Trade Corporation</h4><p>Data analysis, reporting, and dashboard development using Power BI; IT support and data management; ICT and security systems installation; and maintenance of network and server infrastructure, including Windows Server, Active Directory, and firewall configuration.</p></article>
        <article><p className="career-date">2019 — PRESENT</p><h3>Freelance Computer Technician & IT Support</h3><h4>Self-employed</h4><p>Hardware diagnostics and repair, operating system and application installation, preventive maintenance, and network troubleshooting for individuals and small businesses.</p></article>
        <article><p className="career-date">2022 — 2026</p><h3>BS in Computer Engineering</h3><h4>STI College Novaliches</h4><p>Previously studied Aeronautical Engineering at FEATI University, 2017 — 2022 (undergraduate).</p></article>
        <article><p className="career-date">NOVEMBER 2025 / RECOGNITION</p><h3>Best in Implementation — Best in Communication</h3><p>ICT-COE Project Symposium and Exhibit.</p></article>
      </div></section>
      <section id="skills" className="section expertise"><div><p className="eyebrow">04 / EXPERTISE</p><h2>A considered<br/>approach.</h2></div><div className="capabilities">{capabilities.map(([number,title,description]) => <div className="capability" key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="plus">+</span></div>)}</div></section>
      <section id="contact" className="contact"><p className="eyebrow">05 / WHAT'S NEXT</p><h2>Good ideas deserve<br/><span>great execution.</span></h2><div className="contact-bottom"><p>Let's talk IT infrastructure,<br/>software, and embedded systems.</p><div className="contact-links"><a className="contact-note" href="./Angelo_Miguel_Cua_CV.docx" download>Download my CV</a><a className="contact-note" href="mailto:angelomiguelr.cua@gmail.com">angelomiguelr.cua@gmail.com</a><a className="contact-note" href="https://badjau.github.io/timelight/" target="_blank" rel="noreferrer">Timelight on GitHub Pages</a></div></div><span className="contact-asterisk" aria-hidden="true">✳</span></section>
    </main><footer><a className="brand" href="#home" onClick={(event) => scrollToSection(event, 'home')}>amc<span>✳</span></a><span>© {new Date().getFullYear()} Angelo Miguel R. Cua</span><a href="#home" onClick={(event) => scrollToSection(event, 'home')}>Back to top ↑</a></footer>
  </div>
}
export default App

