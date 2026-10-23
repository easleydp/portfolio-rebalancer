/** Parse user input such as "1,206.00p", "£12" or "30%". Returns null unless it is a non-negative number. */
export function parseNum(input: string): number | null {
  const t = String(input ?? '').trim().replace(/^£/, '').replace(/[p%]$/i, '').replace(/,/g, '').trim()
  return /^(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : null
}

/** Tidy a pence price on blur: "1206" → "1,206.00p". Invalid input is returned untouched. */
export function formatPence(input: string): string {
  const v = parseNum(input)
  return v === null ? input : v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + 'p'
}

/** Tidy a quantity on blur: "10000" → "10,000", "100,00" → "10,000". Invalid input is returned untouched. */
export function formatQuantity(input: string): string {
  const v = parseNum(input)
  if (v === null) return input
  // Preserve up to 10 decimal places (fractional shares), strip trailing zeros after the dot
  const formatted = v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 10 })
  return formatted
}

/** Tidy a pounds amount on blur: "1234.5" → "1,234.50". Invalid input is returned untouched. */
export function formatPounds(input: string): string {
  const v = parseNum(input)
  return v === null ? input : v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Tidy a percentage on blur: "30%" → "30". Invalid input is returned untouched. */
export function formatPercent(input: string): string {
  const v = parseNum(input)
  return v === null ? input : String(v)
}

export const gbp = (v: number): string =>
  (v < 0 ? '-' : '') + '£' + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const pct = (v: number): string => `${Math.round(v * 10) / 10}%`
