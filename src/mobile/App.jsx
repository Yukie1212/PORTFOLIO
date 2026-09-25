import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import DemoGuide from './DemoGuide.jsx'

const DEFAULT_CENTER = [14.5995, 120.9842]

const STARTER_ITINERARIES = [
  {
    id: 1,
    title: 'First itinerary',
    customer: 'Northside Pharmacy',
    latitude: 14.5995,
    longitude: 120.9842,
    radiusMeters: 50,
  },
  {
    id: 2,
    title: 'Second itinerary',
    customer: 'Green Valley Store',
    latitude: 14.6012,
    longitude: 120.9861,
    radiusMeters: 50,
  },
  {
    id: 3,
    title: 'Third itinerary',
    customer: 'Sunrise Hardware',
    latitude: 14.603,
    longitude: 120.9828,
    radiusMeters: 50,
  },
]

const EMPTY_ITINERARY = {
  title: '',
  customer: '',
  latitude: '',
  longitude: '',
  radiusMeters: 50,
}

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000
  const toRadians = (value) => (value * Math.PI) / 180

  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function createPinIcon() {
  return L.divIcon({
    className: 'custom-pin',
    html: '<span></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click: (event) => {
      onSelect(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}

const hasCoordinates = (latitude, longitude) =>
  latitude != null && longitude != null && latitude !== '' && longitude !== ''

function MapPicker({ latitude, longitude, onSelect, centerFallback }) {
  // Empty inputs or missing GPS fall back to Manila instead of 0,0 (mid-ocean).
  const hasPin = hasCoordinates(latitude, longitude)
  const center = hasPin
    ? [Number(latitude), Number(longitude)]
    : hasCoordinates(centerFallback?.latitude, centerFallback?.longitude)
      ? [Number(centerFallback.latitude), Number(centerFallback.longitude)]
      : DEFAULT_CENTER

  return (
    <div className="map-shell">
      <MapContainer center={center} zoom={15} scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelect={onSelect} />
        {hasPin ? (
          <Marker position={[Number(latitude), Number(longitude)]} icon={createPinIcon()} />
        ) : null}
      </MapContainer>
    </div>
  )
}

function App() {
  const [employeeName, setEmployeeName] = useState('Sales Person')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [activeTab, setActiveTab] = useState('overview')
  const [itineraries, setItineraries] = useState(STARTER_ITINERARIES)
  const [itineraryIndex, setItineraryIndex] = useState(0)
  const [currentLocation, setCurrentLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    status: 'Waiting for GPS signal',
  })
  const [locationPermission, setLocationPermission] = useState('checking')
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [step, setStep] = useState('arrival')
  const [faceVerified, setFaceVerified] = useState(false)
  const [facePhoto, setFacePhoto] = useState('')
  const [arrivalPhoto, setArrivalPhoto] = useState('')
  const [departurePhoto, setDeparturePhoto] = useState('')
  const [meetingPerson, setMeetingPerson] = useState('')
  const [proofHistory, setProofHistory] = useState([])
  const [cameraError, setCameraError] = useState('')
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const cameraVideoRef = useRef(null)
  const [statusMessage, setStatusMessage] = useState(
    'Ready to begin the first itinerary. GPS must be within 50 meters.',
  )
  const [newItinerary, setNewItinerary] = useState({
    ...EMPTY_ITINERARY,
    radiusMeters: 50,
  })
  const [newItineraryMessage, setNewItineraryMessage] = useState(
    'Pin the customer location on the map or use the device GPS.',
  )

  const itinerary = itineraries[itineraryIndex] ?? {
    title: 'No itinerary available',
    customer: 'Add a route',
    latitude: DEFAULT_CENTER[0],
    longitude: DEFAULT_CENTER[1],
    radiusMeters: 50,
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationPermission('unsupported')
      return
    }

    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          setLocationPermission(result.state)
          result.onchange = () => setLocationPermission(result.state)
        })
        .catch(() => setLocationPermission('prompt'))
    } else {
      setLocationPermission('prompt')
    }

    handleUseCurrentLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const distanceMeters = useMemo(() => {
    if (currentLocation.latitude == null || currentLocation.longitude == null) {
      return null
    }

    return calculateDistanceMeters(
      currentLocation.latitude,
      currentLocation.longitude,
      itinerary.latitude,
      itinerary.longitude,
    )
  }, [currentLocation, itinerary])

  const withinRadius = distanceMeters !== null && distanceMeters <= itinerary.radiusMeters

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setCurrentLocation({
        latitude: null,
        longitude: null,
        accuracy: null,
        status: 'Geolocation is not supported on this device',
      })
      setLocationPermission('unsupported')
      return
    }

    setIsLoadingLocation(true)
    setLocationPermission('prompt')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          status: 'GPS captured automatically',
        }

        setCurrentLocation(nextLocation)
        setLocationPermission('granted')
        setIsLoadingLocation(false)
        setStatusMessage('GPS is ready. Check your distance to the itinerary location.')
        setNewItineraryMessage('Current GPS captured. You can pin the itinerary or keep this location.')
      },
      () => {
        setCurrentLocation({
          latitude: null,
          longitude: null,
          accuracy: null,
          status: 'Location access denied. Please allow GPS access.',
        })
        setLocationPermission('denied')
        setIsLoadingLocation(false)
        setStatusMessage('GPS permission is required for the itinerary check-in.')
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )
  }

  const handleUseCurrentLocationForNewItinerary = () => {
    if (!navigator.geolocation) {
      setNewItineraryMessage('Geolocation is not supported on this device.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewItinerary((previous) => ({
          ...previous,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }))
        setNewItineraryMessage('Current GPS set as itinerary location.')
      },
      () => {
        setNewItineraryMessage('GPS permission denied. Please tap the map to select the itinerary location.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  useEffect(() => {
    if (step !== 'face') {
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null
      }
      return undefined
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('This device does not support phone camera capture. Please use the camera upload option.')
      return undefined
    }

    let stream
    let isCancelled = false

    const startCamera = async () => {
      setCameraError('')
      setIsCameraLoading(true)

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          await cameraVideoRef.current.play().catch(() => null)
        }
      } catch (error) {
        if (!isCancelled) {
          setCameraError('Camera access is blocked. Please allow camera permission or use the upload option.')
        }
      } finally {
        if (!isCancelled) {
          setIsCameraLoading(false)
        }
      }
    }

    startCamera()

    return () => {
      isCancelled = true
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null
      }
    }
  }, [step])

  const handleFacePhotoUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setFacePhoto(reader.result)
      setFaceVerified(true)
      setStatusMessage('Face selfie captured. Continue with the arrival proof photo.')
    }
    reader.readAsDataURL(file)
  }

  const handleCaptureFacePhoto = () => {
    const video = cameraVideoRef.current
    if (!video) {
      setCameraError('Camera preview is not ready yet. Please try again.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Unable to capture the phone camera frame.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const capturedImage = canvas.toDataURL('image/jpeg', 0.9)

    setFacePhoto(capturedImage)
    setFaceVerified(true)
    setStatusMessage('Face verification captured successfully. Continue with the arrival proof photo.')
  }

  const handlePhotoUpload = (event, photoType) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (photoType === 'arrival') {
        setArrivalPhoto(reader.result)
      } else {
        setDeparturePhoto(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleArrivalSubmit = () => {
    if (currentLocation.latitude == null || currentLocation.longitude == null) {
      setStatusMessage('GPS is required before time in.')
      return
    }

    if (!withinRadius) {
      setStatusMessage('You are outside the 50-meter radius. Move closer to time in.')
      return
    }

    if (!faceVerified || !facePhoto) {
      setStatusMessage('Please capture your face selfie before time in.')
      return
    }

    if (!arrivalPhoto) {
      setStatusMessage('Please take a photo proof when you arrive at the location.')
      return
    }

    setStatusMessage('You are checked in. Now capture the departure proof after you leave the area.')
    setStep('departure')
  }

  const handleDepartureSubmit = () => {
    if (!departurePhoto) {
      setStatusMessage('Please take a photo after leaving the location as proof.')
      return
    }

    setStatusMessage('Ask who the salesperson met at this itinerary.')
    setStep('meeting')
  }

  const handleCompleteItinerary = () => {
    if (!meetingPerson.trim()) {
      setStatusMessage('Please enter the person who was met at this itinerary.')
      return
    }

    const timeIn = new Date().toLocaleString()
    const timeOut = new Date().toLocaleString()

    const entry = {
      id: Date.now(),
      itinerary: itinerary.title,
      customer: itinerary.customer,
      employeeName,
      meetingPerson,
      timeIn,
      timeOut,
      gps: `${currentLocation.latitude?.toFixed(6)}, ${currentLocation.longitude?.toFixed(6)}`,
      distance: distanceMeters == null ? 'N/A' : `${Math.round(distanceMeters)} m`,
      status: withinRadius ? 'Approved' : 'Outside radius',
      facePhoto,
      arrivalPhoto,
      departurePhoto,
    }

    setProofHistory((previous) => [entry, ...previous])
    setStatusMessage(
      itineraryIndex === itineraries.length - 1
        ? 'All sales itinerary visits are complete.'
        : 'Itinerary complete. Proceeding to the next route.',
    )

    setFaceVerified(false)
    setFacePhoto('')
    setArrivalPhoto('')
    setDeparturePhoto('')
    setMeetingPerson('')

    if (itineraryIndex < itineraries.length - 1) {
      setItineraryIndex((previous) => previous + 1)
    }

    setStep('arrival')
  }

  const handleAddItinerary = () => {
    const title = newItinerary.title.trim()
    const customer = newItinerary.customer.trim()
    const latitude = Number(newItinerary.latitude)
    const longitude = Number(newItinerary.longitude)
    const radiusMeters = 50

    if (!title || !customer) {
      setNewItineraryMessage('Please add a title and customer name for the itinerary.')
      return
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setNewItineraryMessage('Please pin the itinerary location on the map or use current GPS.')
      return
    }

    const nextItinerary = {
      id: Date.now(),
      title,
      customer,
      latitude,
      longitude,
      radiusMeters,
    }

    setItineraries((previous) => [nextItinerary, ...previous])
    setItineraryIndex(0)
    setNewItinerary(EMPTY_ITINERARY)
    setNewItineraryMessage('New itinerary added. Start the sales visit from this route.')
    setStatusMessage('New itinerary added. GPS must be within 50 meters to time in.')
  }

  // Portfolio demo only: place the GPS about 12 m from the current itinerary.
  const handleSimulateArrival = () => {
    setCurrentLocation({
      latitude: itinerary.latitude + 0.0001,
      longitude: itinerary.longitude + 0.00004,
      accuracy: 8,
      status: 'Simulated GPS for this demo',
    })
    setLocationPermission('granted')
    setIsLoadingLocation(false)
    setActiveTab('overview')
    setStatusMessage('GPS is ready. Check your distance to the itinerary location.')
  }

  const permissionLabel =
    locationPermission === 'granted'
      ? 'Location enabled'
      : locationPermission === 'denied'
        ? 'Location blocked'
        : locationPermission === 'unsupported'
          ? 'Not supported'
          : 'Allow access'

  const permissionText =
    locationPermission === 'granted'
      ? 'Device location is active and the route can verify check-ins.'
      : locationPermission === 'denied'
        ? 'Turn on location access to allow GPS time-in validation.'
        : 'Enable device location so the app can verify the 50-meter boundary.'

  const handleLogin = (event) => {
    event.preventDefault()

    const email = loginForm.email.trim()
    if (!email || !loginForm.password.trim()) {
      setStatusMessage('Please enter your email and password to continue.')
      return
    }

    const userLabel = email.split('@')[0]?.replace(/\.|_/g, ' ') || 'Sales Person'
    const formattedUser = userLabel
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

    setEmployeeName(formattedUser || 'Sales Person')
    setIsLoggedIn(true)
    setStatusMessage(`Welcome back, ${formattedUser || 'Sales Person'}!`) 
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setLoginForm({ email: '', password: '' })
    setStatusMessage('You have been logged out.')
  }

  const stepProgressMap = {
    arrival: 20,
    face: 40,
    arrivalPhoto: 70,
    departure: 85,
    meeting: 100,
  }

  const progressValue = stepProgressMap[step] ?? 20

  return (
    <div className="app-shell">
      <div className="phone-frame">
        {!isLoggedIn ? (
          <div className="auth-screen">
            <div className="auth-card">
              <div className="brand brand-centered">
                <div className="brand-mark">G</div>
                <div>
                  <p className="eyebrow">Sales route</p>
                  <h1>Route tracker</h1>
                </div>
              </div>

              <div className="auth-copy">
                <h2>Welcome back</h2>
                <p>Sign in to continue your route and check in with GPS.</p>
              </div>

              <form className="login-form" onSubmit={handleLogin}>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((previous) => ({ ...previous, email: event.target.value }))}
                    placeholder="name@company.com"
                  />
                </label>

                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((previous) => ({ ...previous, password: event.target.value }))
                    }
                    placeholder="Enter password"
                  />
                </label>

                <button type="submit" className="primary-button auth-button">
                  Log in
                </button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <header className="topbar">
              <div className="brand">
                <div className="brand-mark">G</div>
                <div>
                  <p className="eyebrow">Sales route</p>
                  <h1>Route tracker</h1>
                </div>
              </div>
              <div className="topbar-actions">
                <span className="status-pill">Live</span>
                <button type="button" className="logout-button" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            </header>

            <main className="content">
              <div className="tab-switcher" role="tablist" aria-label="Route pages">
                {['overview', 'add', 'history'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    className={activeTab === tab ? 'tab-button active' : 'tab-button'}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'overview' ? 'Overview' : tab === 'add' ? 'Add itinerary' : 'Route history'}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <>
                  <section className="hero-card">
                    <div className="hero-row">
                      <div>
                        <p className="eyebrow muted">Hello, {employeeName}</p>
                        <h2>{itinerary.title}</h2>
                      </div>
                      <span className={withinRadius ? 'success-badge' : 'warning-badge'}>
                        {withinRadius ? 'On site' : 'Away'}
                      </span>
                    </div>

                    <div className="hero-metrics">
                      <div>
                        <span>Distance</span>
                        <strong>{distanceMeters == null ? '—' : `${Math.round(distanceMeters)} m`}</strong>
                      </div>
                      <div>
                        <span>Radius</span>
                        <strong>{itinerary.radiusMeters} m</strong>
                      </div>
                      <div>
                        <span>GPS</span>
                        <strong>{locationPermission === 'granted' ? 'Ready' : 'Pending'}</strong>
                      </div>
                    </div>

                    <div
                      className={`permission-banner ${
                        locationPermission === 'granted'
                          ? 'granted'
                          : locationPermission === 'denied'
                            ? 'blocked'
                            : 'warning'
                      }`}
                    >
                      <div className="permission-copy">
                        <span className="permission-dot" />
                        <div>
                          <strong>{permissionLabel}</strong>
                          <small>{permissionText}</small>
                        </div>
                      </div>

                      {locationPermission !== 'granted' ? (
                        <button type="button" className="mini-button" onClick={handleUseCurrentLocation}>
                          {isLoadingLocation ? 'Checking...' : 'Allow access'}
                        </button>
                      ) : null}
                    </div>
                  </section>

                  <section className="card compact-card">
                    <div className="section-header">
                      <h2>Current itinerary</h2>
                      <span className={withinRadius ? 'success-badge' : 'warning-badge'}>
                        {withinRadius ? 'Within 50m' : 'Outside 50m'}
                      </span>
                    </div>

                    <p className="route-title">{itinerary.customer}</p>
                    <p className="route-meta">
                      {currentLocation.latitude == null || currentLocation.longitude == null
                        ? 'Waiting for phone GPS'
                        : `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`}
                    </p>
                    <p className="status-text">{currentLocation.status}</p>
                  </section>

                  <section className="card">
                    <div className="section-header">
                      <h2>Sales attendance flow</h2>
                    </div>

                    <div className="step-progress-bar" aria-label="Check-in progress">
                      <span style={{ width: `${progressValue}%` }} />
                    </div>
                    <div className="progress-row">
                      <div className="progress-badge">{step.toUpperCase()}</div>
                      <span className="progress-percent">{progressValue}%</span>
                    </div>
                    <p className="status-message">{statusMessage}</p>

                    {step === 'arrival' && (
                      <div className="flow-box">
                        <p>
                          {withinRadius
                            ? 'You are within the 50-meter limit. Continue with face recognition and time-in.'
                            : 'Move closer to this itinerary. Time-in is only allowed within 50 meters.'}
                        </p>
                        <button
                          type="button"
                          className="primary-button"
                          disabled={!withinRadius}
                          onClick={() => {
                            if (!withinRadius) return
                            setStep('face')
                            setStatusMessage('Face recognition is required before the time-in is accepted.')
                          }}
                        >
                          Start time in
                        </button>
                      </div>
                    )}

                    {step === 'face' && (
                      <div className="flow-box">
                        <p>Use your phone camera to capture a face selfie before the attendance is accepted.</p>

                        <div className="camera-box">
                          {isCameraLoading ? <p className="camera-status">Opening phone camera…</p> : null}
                          {!cameraError ? (
                            <video ref={cameraVideoRef} className="camera-preview" autoPlay playsInline muted />
                          ) : null}
                          {cameraError ? <p className="camera-error">{cameraError}</p> : null}
                        </div>

                        <div className="action-row">
                          <button type="button" className="primary-button" onClick={handleCaptureFacePhoto}>
                            Capture face
                          </button>
                        </div>

                        <label className="upload-box">
                          <span>Or upload a selfie</span>
                          <input type="file" accept="image/*" capture="user" onChange={handleFacePhotoUpload} />
                        </label>

                        {facePhoto ? <img className="proof-image" src={facePhoto} alt="Face verification selfie" /> : null}

                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => {
                            if (!facePhoto) {
                              setStatusMessage('Please capture your face selfie before continuing.')
                              return
                            }

                            setFaceVerified(true)
                            setStep('arrivalPhoto')
                            setStatusMessage('Face verified. Capture your proof photo at the location.')
                          }}
                        >
                          Verify face
                        </button>
                      </div>
                    )}

                    {step === 'arrivalPhoto' && (
                      <div className="flow-box">
                        <label className="upload-box">
                          <span>Arrival proof photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(event) => handlePhotoUpload(event, 'arrival')}
                          />
                        </label>

                        {arrivalPhoto ? <img className="proof-image" src={arrivalPhoto} alt="Arrival proof" /> : null}

                        <button type="button" className="primary-button" onClick={handleArrivalSubmit}>
                          Continue after arrival
                        </button>
                      </div>
                    )}

                    {step === 'departure' && (
                      <div className="flow-box">
                        <p>After leaving the location, take the departure photo as proof that the visit took place.</p>
                        <label className="upload-box">
                          <span>Departure proof photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(event) => handlePhotoUpload(event, 'departure')}
                          />
                        </label>

                        {departurePhoto ? <img className="proof-image" src={departurePhoto} alt="Departure proof" /> : null}

                        <button type="button" className="primary-button" onClick={handleDepartureSubmit}>
                          Continue to meeting person
                        </button>
                      </div>
                    )}

                    {step === 'meeting' && (
                      <div className="flow-box">
                        <label className="field-label" htmlFor="meetingPerson">
                          Who did you meet?
                        </label>
                        <input
                          id="meetingPerson"
                          value={meetingPerson}
                          onChange={(event) => setMeetingPerson(event.target.value)}
                          placeholder="Enter meeting contact or person name"
                        />

                        <button type="button" className="submit-button" onClick={handleCompleteItinerary}>
                          Finish itinerary
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}

              {activeTab === 'add' && (
                <section className="card">
                  <div className="section-header">
                    <h2>Add itinerary</h2>
                    <span className="neutral-badge">{itineraries.length} routes</span>
                  </div>

                  <div className="itinerary-form">
                    <input
                      value={newItinerary.title}
                      onChange={(event) =>
                        setNewItinerary((previous) => ({ ...previous, title: event.target.value }))
                      }
                      placeholder="Itinerary title"
                    />
                    <input
                      value={newItinerary.customer}
                      onChange={(event) =>
                        setNewItinerary((previous) => ({ ...previous, customer: event.target.value }))
                      }
                      placeholder="Customer name"
                    />
                    <div className="location-fields">
                      <input
                        type="number"
                        step="0.000001"
                        value={newItinerary.latitude}
                        onChange={(event) =>
                          setNewItinerary((previous) => ({
                            ...previous,
                            latitude: event.target.value,
                          }))
                        }
                        placeholder="Latitude"
                      />
                      <input
                        type="number"
                        step="0.000001"
                        value={newItinerary.longitude}
                        onChange={(event) =>
                          setNewItinerary((previous) => ({
                            ...previous,
                            longitude: event.target.value,
                          }))
                        }
                        placeholder="Longitude"
                      />
                    </div>

                    <div className="radius-fixed-box">
                      <span>Allowed radius</span>
                      <strong>50 meters</strong>
                    </div>

                    <MapPicker
                      latitude={newItinerary.latitude}
                      longitude={newItinerary.longitude}
                      onSelect={(latitude, longitude) =>
                        setNewItinerary((previous) => ({ ...previous, latitude, longitude }))
                      }
                      centerFallback={currentLocation}
                    />

                    <button type="button" className="secondary-button" onClick={handleUseCurrentLocationForNewItinerary}>
                      Use current GPS
                    </button>

                    <button type="button" className="primary-button" onClick={handleAddItinerary}>
                      Save itinerary
                    </button>

                    <p className="map-status">{newItineraryMessage}</p>
                  </div>
                </section>
              )}

              {activeTab === 'history' && (
                <section className="card history-card">
                  <div className="section-header">
                    <h2>Route history</h2>
                  </div>

                  {proofHistory.length === 0 ? (
                    <p className="empty-state">No itinerary proof recorded yet.</p>
                  ) : (
                    proofHistory.map((entry) => (
                      <article key={entry.id} className="history-item">
                        <div className="history-topline">
                          <strong>{entry.itinerary}</strong>
                          <span className="success-badge">{entry.status}</span>
                        </div>
                        <p>{entry.customer}</p>
                        <p>{entry.meetingPerson}</p>
                        <p>Time in: {entry.timeIn}</p>
                        <p>Time out: {entry.timeOut}</p>
                        {entry.facePhoto ? <img src={entry.facePhoto} alt="Face proof" className="history-image" /> : null}
                        <img src={entry.arrivalPhoto} alt="Arrival proof" className="history-image" />
                        <img src={entry.departurePhoto} alt="Departure proof" className="history-image" />
                        <small>
                          {entry.gps} • {entry.distance}
                        </small>
                      </article>
                    ))
                  )}
                </section>
              )}
            </main>
          </>
        )}
      </div>
      <DemoGuide isLoggedIn={isLoggedIn} itineraryTitle={itinerary.customer} onSimulateArrival={handleSimulateArrival} />
    </div>
  )
}

export default App
