export const TZ = 'Asia/Karachi'

/** Current date/minutes in company timezone (server clocks may be UTC) */
export function karachiNow(d = new Date()) {
  const date = d.toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
  const time = d.toLocaleTimeString('en-GB', { timeZone: TZ, hour12: false }) // HH:MM:SS
  const [h, m] = time.split(':').map(Number)
  const ref = new Date(d.toLocaleString('en-US', { timeZone: TZ }))
  return { date, minutes: h * 60 + m, weekday: ref.getDay() }
}

export function timeToMinutes(t, fallback = 540) {
  if (!t) return fallback
  const [h, m] = String(t).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToHM(mins) {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function monthRange(year, month) {
  const mm = String(month).padStart(2, '0')
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, '0')}` }
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toR = (x) => (x * Math.PI) / 180
  const dLat = toR(lat2 - lat1)
  const dLng = toR(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
