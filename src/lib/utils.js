import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const pkr = (n) =>
  'PKR ' + (Number(n) || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

export const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const fmtTime = (t) => {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' })
}

export const workedHoursOf = (row) => {
  if (!row?.check_in || !row?.check_out) return null
  return Math.round(((new Date(row.check_out) - new Date(row.check_in)) / 36e5) * 100) / 100
}

export const karachiToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
