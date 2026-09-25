import { useState } from 'react'
import './DemoGuide.css'

// Portfolio-only helper shown beside the phone. It is not part of the original
// app: visitors are rarely within 50 m of the sample itineraries, so this lets
// them place the GPS on site and walk through the whole check-in flow.
function DemoGuide({ isLoggedIn, itineraryTitle, onSimulateArrival }) {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches)

  return (
    <aside className={open ? 'demo-guide open' : 'demo-guide'} aria-label="Demo guide">
      <button type="button" className="demo-guide-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Demo guide <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="demo-guide-body">
          <p>Original route tracker app. Data stays in this browser tab.</p>
          {isLoggedIn ? (
            <>
              <p>
                Time-in only unlocks within 50 m of <strong>{itineraryTitle}</strong>. Use the button to place your GPS on
                site.
              </p>
              <button type="button" className="demo-guide-action" onClick={onSimulateArrival}>
                Simulate arriving on site
              </button>
            </>
          ) : (
            <p>Log in with any email and password.</p>
          )}
          <a href="./">← Back to portfolio</a>
        </div>
      ) : null}
    </aside>
  )
}

export default DemoGuide
