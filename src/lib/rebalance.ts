/** Validates portfolio holdings and calculates checks, acceptable ranges and trades. */
import { parsePence, parsePercent, parseQuantity } from "./format";

/*
 * Interfaces `Fund` and `Holding` serve different purposes (UI and data model).
 * `toHoldings` converts between them: it parses and validates the form values, converts
 * pence to pounds, and skips empty or incomplete rows. Keeping both interfaces makes the
 * boundary between editable UI input and calculation-ready data explicit.
 */

/** A fund row exactly as typed. Price is in pence. */
export interface Fund {
  id: string;
  name: string;
  quantity: string;
  price: string;
  target: string;
}
/** A validated holding. Price is in pounds. */
export interface Holding {
  name: string;
  quantity: number;
  price: number;
  target: number;
}
export interface Settings {
  rel: string;
  cap: string;
}
/** Calculated position and suggested trade for one fund in the results table. */
export interface Row extends Holding {
  value: number;
  weight: number;
  lo: number;
  hi: number;
  drift: number;
  off: boolean;
  qty: number;
  cost: number;
}
/** Overall rebalance results displayed in the "What to do" section. */
export interface Plan {
  rows: Row[];
  needed: boolean;
  total: number;
  cash: number;
  left: number;
  cashAdvice: CashAdvice | null;
}
export type CashAdvice =
  | { kind: "single"; name: string }
  | { kind: "spread"; purchases: { name: string; qty: number; cost: number }[]; left: number };
export type Check = { ok: true; mine: number } | { ok: false; mine: number; hint: string };

export const TOLERANCE = 0.05;
const EPSILON = 1e-9;

export function toHoldings(funds: Fund[]) {
  const holdings: Holding[] = [];
  let incomplete = false;
  let targetSum = 0;
  funds.forEach((f) => {
    const quantity = parseQuantity(f.quantity),
      pence = parsePence(f.price),
      target = parsePercent(f.target);
    targetSum += target ?? 0;
    if (!(f.name || f.quantity || f.price || f.target)) return;
    if (!f.name.trim() || quantity === null || pence === null || target === null || pence <= 0) {
      incomplete = true;
      return;
    }
    holdings.push({
      name: f.name.trim(),
      quantity,
      price: pence / 100,
      target,
    });
  });
  return { holdings, incomplete, targetSum };
}

/** Acceptable weight range (%) for a target: ±rel% of the target, limited to ±cap points when cap is set. */
export function acceptableRange(target: number, rel: number, cap: number | null): [number, number] {
  const safeRel = Math.max(0, rel);
  const safeCap = cap !== null ? Math.max(0, cap) : null;
  let half = (target * safeRel) / 100;
  if (safeCap !== null && safeCap < half) half = safeCap;
  return [Math.max(0, target - half), Math.min(100, target + half)];
}

/** Compare our total (funds + cash, £) with the platform's. On a mismatch, try to name the likely slip. */
export function checkTotal(holdings: Holding[], cash: number, platform: number): Check {
  const total = holdings.reduce((a, h) => a + h.quantity * h.price, 0);
  const mine = total + cash;
  if (platform <= 0)
    return {
      ok: false,
      mine,
      hint: "Platform total must be greater than zero.",
    };
  const close = (x: number) => Math.abs(x - platform) / platform <= TOLERANCE;
  if (close(mine)) return { ok: true, mine };
  /* Too clever - sometimes draws the wrong conclusion, which could really confuse the user. 
     Better to just let the user sleuth it out. */
  // const factors: [number, string][] = [
  //   [100, "100 times too small (is it in pounds rather than pence?)"],
  //   [0.01, "100 times too big"],
  //   [10, "10 times too small"],
  //   [0.1, "10 times too big"],
  // ];
  // for (const [k, why] of factors)
  //   for (const h of holdings) {
  //     const v = h.quantity * h.price;
  //     if (close(total - v + v * k + cash))
  //       return {
  //         ok: false,
  //         mine,
  //         hint: `The price or quantity for ${h.name} looks ${why}.`,
  //       };
  //   }
  const hint =
    (platform > mine && cash === 0 ? "Is there cash in the account? Enter it in step 2. " : "") +
    "Otherwise check each price and quantity.";
  return { ok: false, mine, hint };
}

/** Work out the trades that bring every fund to its target weight (cash included). Needs total value > 0. */
export function rebalance(
  holdings: Holding[],
  cash: number,
  o: { rel: number; cap: number | null },
): Plan {
  const total = holdings.reduce((a, h) => a + h.quantity * h.price, 0);
  if (!holdings.length || total <= 0) {
    throw new Error("`rebalance` requires at least one holding with positive total value");
  }
  const newTotal = total + cash;
  const rows: Row[] = holdings.map((h) => {
    const value = h.quantity * h.price;
    const weight = (value / total) * 100;
    const [lo, hi] = acceptableRange(h.target, o.rel, o.cap);
    let q = ((h.target / 100) * newTotal - value) / h.price;
    // Buys round down (never overspend); sells round to nearest and cannot exceed whole shares held.
    q = q > 0 ? Math.floor(q + 1e-9) : -Math.min(Math.floor(h.quantity), Math.round(-q));
    return {
      ...h,
      value,
      weight,
      lo,
      hi,
      drift: weight - h.target,
      off: weight < lo - 1e-9 || weight > hi + 1e-9,
      qty: q,
      cost: q * h.price,
    };
  });
  const left = cash - rows.reduce((a, r) => a + r.cost, 0);
  const needed = rows.some((r) => r.off);
  const cashAdvice = !needed && cash > 0 ? adviseSpareCash(rows, total, cash) : null;
  return {
    rows,
    needed,
    total,
    cash,
    left,
    cashAdvice,
  };
}

function adviseSpareCash(rows: Row[], total: number, cash: number): CashAdvice {
  const shortfalls = rows.map((row) => row.target - row.weight);
  const greatestShortfall = Math.max(...shortfalls);
  const candidateIndex = shortfalls.findIndex(
    (shortfall) => shortfall > EPSILON && greatestShortfall - shortfall <= EPSILON,
  );
  const tied = shortfalls.some(
    (shortfall, index) => index !== candidateIndex && greatestShortfall - shortfall <= EPSILON,
  );

  if (candidateIndex !== -1 && !tied) {
    const candidate = rows[candidateIndex];
    const targetValue = (candidate.target / 100) * (total + cash);
    const amountToTarget = Math.max(0, targetValue - candidate.value);
    const quantity = Math.floor(Math.min(cash, amountToTarget) / candidate.price + EPSILON);
    const cost = quantity * candidate.price;
    const remainsWithinRange = rows.every((row, index) => {
      const value = row.value + (index === candidateIndex ? cost : 0);
      const weight = (value / (total + cash)) * 100;
      return weight >= row.lo - EPSILON && weight <= row.hi + EPSILON;
    });

    if (quantity > 0 && cost <= cash + EPSILON && remainsWithinRange) {
      return { kind: "single", name: candidate.name };
    }
  }

  const newTotal = total + cash;
  const deficits = rows.map((row) => Math.max(0, (row.target / 100) * newTotal - row.value));
  const totalDeficit = deficits.reduce((sum, deficit) => sum + deficit, 0);
  const purchases = rows.flatMap((row, index) => {
    const allocation =
      totalDeficit > EPSILON ? (cash * deficits[index]) / totalDeficit : (cash * row.target) / 100;
    const quantity = Math.floor(allocation / row.price + EPSILON);
    return quantity > 0 ? [{ name: row.name, qty: quantity, cost: quantity * row.price }] : [];
  });
  const spent = purchases.reduce((sum, purchase) => sum + purchase.cost, 0);

  return { kind: "spread", purchases, left: Math.max(0, cash - spent) };
}
