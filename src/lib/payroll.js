// Payroll math (M6): Gross = 1.5 x basic, simplified annual tax slabs (PKR).

export function annualTax(annual) {
  if (annual <= 600000) return 0
  if (annual <= 1200000) return (annual - 600000) * 0.05
  if (annual <= 2400000) return 30000 + (annual - 1200000) * 0.1
  if (annual <= 3600000) return 150000 + (annual - 2400000) * 0.15
  return 330000 + (annual - 3600000) * 0.2
}

export function calcPayslip(basic) {
  const b = Number(basic) || 0
  const allowances = Math.round(b * 0.5)
  const gross = b + allowances // = 1.5 x basic
  const tax = Math.round(annualTax(gross * 12) / 12)
  return { allowances, gross, tax, net: gross - tax }
}
