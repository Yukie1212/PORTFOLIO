import { useEffect, useRef, useState } from 'react'
import { onDevice } from '../lib/bus.js'
import { deviceCall } from '../lib/services.js'
import { Avatar, Badge, Icon } from './ui.jsx'

export const MANUAL_PIN = '2468'

/**
 * Facial verification step. Uses the real camera when allowed; the match
 * itself is simulated in the demo (a deployment calls the face service with
 * the enrolled template). Never the only option: a librarian can always
 * verify manually.
 */
export default function FaceCheck({ student, device, context = 'Borrowing', onDone }) {
  const video = useRef(null)
  const streamRef = useRef(null)
  const [camera, setCamera] = useState('off') // off | starting | on | unavailable
  const [result, setResult] = useState(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [busy, setBusy] = useState(false)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }
  useEffect(() => stopCamera, [])

  const verify = (outcome) => {
    setBusy(true)
    setTimeout(() => {
      const res = deviceCall(device, 'POST', '/api/facial-verification', { studentId: student.id, outcome, context })
      setBusy(false)
      setResult(res.body)
      if (res.body.result === 'verified') {
        stopCamera()
        setTimeout(() => onDone('verified'), 900)
      }
    }, 700)
  }

  // Simulator (or a real camera service) can push a result for this device.
  const verifyRef = useRef(verify)
  useEffect(() => { verifyRef.current = verify })
  useEffect(() => onDevice(device, (e) => {
    if (e.kind === 'face') verifyRef.current(e.outcome)
  }), [device])

  const startCamera = async () => {
    setCamera('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 360 }, audio: false })
      streamRef.current = stream
      if (video.current) video.current.srcObject = stream
      setCamera('on')
    } catch {
      setCamera('unavailable')
    }
  }

  const approveManually = (e) => {
    e.preventDefault()
    if (pin !== MANUAL_PIN) {
      setPinError('Incorrect librarian PIN.')
      return
    }
    deviceCall(device, 'POST', '/api/facial-verification', { studentId: student.id, context, manualBy: 'Librarian' })
    stopCamera()
    onDone('manual')
  }

  const needsManual = result && result.result !== 'verified'

  return (
    <div className="face-check">
      <div className="face-pair">
        <div className="face-ref">
          <Avatar student={student} size={84} />
          <p className="eyebrow">Registered</p>
          <strong>{student.name}</strong>
          <span className="muted">{student.face ? 'Face template on file' : 'No face template enrolled'}</span>
        </div>
        <div className={`face-live${result ? ` is-${result.result}` : ''}`}>
          <video ref={video} autoPlay playsInline muted className={camera === 'on' ? 'on' : ''} />
          {camera !== 'on' && (
            <div className="face-placeholder">
              <Icon name="face" size={42} strokeWidth={1.4} />
              <span>{camera === 'unavailable' ? 'Camera unavailable' : camera === 'starting' ? 'Starting camera…' : 'Live capture'}</span>
            </div>
          )}
          <div className="face-scanline" hidden={!busy} />
          <div className="face-frame" />
        </div>
      </div>

      {result && (
        <div className={`face-result face-${result.result}`} role="status">
          <Badge status={result.result === 'verified' ? 'verified' : result.result === 'failed' ? 'failed' : 'manual'}>
            {result.result === 'verified' ? 'Verified' : result.result === 'failed' ? 'Verification failed' : 'Manual verification required'}
          </Badge>
          <span>{result.confidence != null ? `Match confidence ${Math.round(result.confidence * 100)}%` : result.reason}</span>
        </div>
      )}

      {!needsManual && (
        <div className="face-actions">
          {camera !== 'on' && <button type="button" className="btn" onClick={startCamera} disabled={camera === 'starting'}><Icon name="camera" />Use camera</button>}
          <button type="button" className="btn btn-primary" onClick={() => verify(camera === 'unavailable' ? 'no-camera' : 'match')} disabled={busy}>
            <Icon name="face" />{busy ? 'Verifying…' : 'Verify face'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => verify('mismatch')} disabled={busy}>Simulate mismatch</button>
        </div>
      )}

      {(needsManual || camera === 'unavailable') && (
        <form className="manual-verify" onSubmit={approveManually}>
          <p><Icon name="user" size={16} /> <strong>Librarian verification.</strong> Check the student's school ID photo in person, then enter the librarian PIN.</p>
          <div className="inline-form">
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value); setPinError('') }} placeholder="Librarian PIN" aria-label="Librarian PIN" />
            <button type="submit" className="btn btn-primary">Approve</button>
            {needsManual && <button type="button" className="btn btn-ghost" onClick={() => setResult(null)}>Try again</button>}
          </div>
          {pinError && <p className="error-text">{pinError}</p>}
          <p className="muted small">Demo PIN: {MANUAL_PIN}</p>
        </form>
      )}
    </div>
  )
}
