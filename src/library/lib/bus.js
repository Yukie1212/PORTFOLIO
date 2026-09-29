// Tiny event bus. Hardware events (card taps, tag reads, gate detections,
// face results) and UI alerts travel through here, so stations and screens
// subscribe to a device instead of talking to hardware directly.
const handlers = new Map()

export const bus = {
  on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set())
    handlers.get(type).add(fn)
    return () => handlers.get(type)?.delete(fn)
  },
  emit(type, payload) {
    handlers.get(type)?.forEach((fn) => fn(payload))
  },
}

/**
 * Device events a physical reader would push. `device` is the station or
 * gate ID (BORROW-01, RETURN-01, EXIT-01) so each screen only reacts to its own
 * hardware.
 *   { device, kind: 'student-card' | 'book-tag' | 'gate-tag' | 'face', uid?, outcome? }
 */
export const emitDevice = (event) => bus.emit('device', { ...event, at: Date.now() })
export const onDevice = (device, fn) => bus.on('device', (e) => (e.device === device ? fn(e) : undefined))

export const toast = (tone, title, body = '') => bus.emit('toast', { tone, title, body, id: Math.random().toString(36).slice(2) })
