import { parseNum } from './format'

/** A fund row exactly as typed. Price is in pence. */
export interface Fund { id: string; name: string; quantity: string; price: string; target: string }
export interface Settings { rel: string; cap: string; whole: boolean }
/** A validated holding. Price is in pounds. */
export interface Holding { name: string; quantity: number; price: number; target: number }
export interface Row extends Holding {
  value: number; weight: number; lo: number; hi: number; drift: number
  off: boolean; qty: number; cost: number
}
export interface Plan { rows: Row[]; needed: boolean; total: number; cash: number; left: number; worst: Row }
export type Check = { ok: true; mine: number } | { ok: false; mine: number; hint: string }

export const TOLERANCE = 0.05

export function toHoldings(funds: Fund[]) {
  const holdings: Holding[] = []
  let incomplete = false
  let targetSum = 0
  funds.forEach((f, i) => {
    const quantity = parseNum(f.quantity), pence = parseNum(f.price), target = parseNum(f.target)
    targetSum += target ?? 0
    if (!(f.name || f.quantity || f.price || f.target)) return
    if (quantity === null || pence === null || target === null || pence <= 0) { incomplete = true; return }
    holdings.push({ name: f.name.trim() || `Fund ${i + 1}`, quantity, price: pence / 100, target })
  })
  return { holdings, incomplete, targetSum }
}

/** Acceptable weight range (%) for a target: ±rel% of the target, limited to ±cap points when cap is set. */
export function acceptableRange(target: number, rel: number, cap: number | null): [number, number] {
  let half = (target * rel) / 100
  if (cap !== null && cap < half) half = cap
  return [Math.max(0, target - half), Math.min(100, target + half)]
}

/** Compare our total (funds + cash, £) with the platform's. On a mismatch, try to name the likely slip. */
export function checkTotal(holdings: Holding[], cash: number, platform: number): Check {
  const total = holdings.reduce((a, h) => a + h.quantity * h.price, 0)
  const mine = total + cash
  const close = (x: number) => Math.abs(x - platform) / platform <= TOLERANCE
  if (close(mine)) return { ok: true, mine }
  const factors: [number, string][] = [
    [100, '100 times too small (is it in pounds rather than pence?)'], [0.01, '100 times too big'],
    [10, '10 times too small'], [0.1, '10 times too big'],
  ]
  for (const [k, why] of factors)
    for (const h of holdings) {
      const v = h.quantity * h.price
      if (close(total - v + v * k + cash)) return { ok: false, mine, hint: `The price or quantity for ${h.name} looks ${why}.` }
    }
  const hint = (platform > mine && cash === 0 ? 'Is there cash in the account? Enter it in step 2. ' : '') + 'Otherwise check each price and quantity.'
  return { ok: false, mine, hint }
}

/** Work out the trades that bring every fund to its target weight (cash included). Needs total value > 0. */
export function rebalance(holdings: Holding[], cash: number, o: { rel: number; cap: number | null; whole: boolean }): Plan {
  const total = holdings.reduce((a, h) => a + h.quantity * h.price, 0)
  const newTotal = total + cash
  const rows: Row[] = holdings.map(h => {
    const value = h.quantity * h.price
    const weight = (value / total) * 100
    const [lo, hi] = acceptableRange(h.target, o.rel, o.cap)
    let q = ((h.target / 100) * newTotal - value) / h.price
    // Whole shares: buys round down (never overspend), sells round to nearest (never more than held).
    q = o.whole ? (q > 0 ? Math.floor(q + 1e-9) : -Math.min(h.quantity, Math.round(-q))) : Math.round(q * 1000) / 1000
    return { ...h, value, weight, lo, hi, drift: weight - h.target, off: weight < lo - 1e-9 || weight > hi + 1e-9, qty: q, cost: q * h.price }
  })
  const left = cash - rows.reduce((a, r) => a + r.cost, 0)
  const worst = rows.reduce((a, b) => (b.drift < a.drift ? b : a))
  return { rows, needed: rows.some(r => r.off), total, cash, left, worst }
}
