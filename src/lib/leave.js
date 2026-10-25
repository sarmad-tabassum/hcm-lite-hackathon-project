// Pure leave helpers — safe to import on server AND client.

export const WEEKEND_DAYS = [0, 6] // Sunday + Saturday off

export function eachDate(start, end) {
  const out = []
  if (!start || !end || start > end) return out
  let d = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  let guard = 0
  while (d <= e && guard < 400) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
    guard++
  }
  return out
}

/** Dates between start..end excluding weekends and company holidays */
export function workingDays(start, end, holidaySet = new Set()) {
  return eachDate(start, end).filter((iso) => {
    const wd = new Date(iso + 'T00:00:00Z').getUTCDay()
    return !WEEKEND_DAYS.includes(wd) && !holidaySet.has(iso)
  })
}

export function yearOfRange(startDate) {
  return Number(String(startDate).slice(0, 4))
}
