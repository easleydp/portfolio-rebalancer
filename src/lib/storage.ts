import { parseNum } from "./format";
import type { Fund, Settings } from "./rebalance";

export interface State {
  funds: Fund[];
  cash: string;
  plat: string;
  settings: Settings;
  saved: string;
  prev: Record<string, number> | null;
}
const KEY = "portfolio-rebalancer-v1";
const NEW_YEAR_MS = 60 * 864e5;
let counter = 0;

export const newFund = (): Fund => ({
  id: `f${Date.now().toString(36)}${counter++}`,
  name: "",
  quantity: "",
  price: "",
  target: "",
});
export const defaults = (): State => ({
  funds: [newFund(), newFund(), newFund()],
  cash: "",
  plat: "",
  settings: { rel: "25", cap: "5", whole: true },
  saved: "",
  prev: null,
});
export const key = (name: string): string => name.trim().toLowerCase();
const str = (x: unknown, d = ""): string => (typeof x === "string" ? x : d);

/** If the last save was over 60 days ago, remember those prices for year-on-year checks and clear the stale platform total. */
export function rollover(s: State, now: number): State {
  const t = Date.parse(s.saved);
  if (!Number.isFinite(t) || now - t <= NEW_YEAR_MS) return s;
  const prev: Record<string, number> = {};
  for (const f of s.funds) {
    const p = parseNum(f.price);
    if (key(f.name) && p !== null && p > 0) prev[key(f.name)] = p;
  }
  return { ...s, prev, plat: "" };
}

/** Load saved state, tolerating missing, corrupt or older data. */
export function load(now = Date.now()): State {
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (!p || !Array.isArray(p.funds) || !p.funds.length) return defaults();
    const s = p.settings ?? {};
    const prev =
      p.prev && typeof p.prev === "object"
        ? (p.prev as Record<string, number>)
        : null;
    return rollover(
      {
        funds: p.funds.slice(0, 10).map((f: Record<string, unknown>) => ({
          ...newFund(),
          name: str(f?.name),
          quantity: str(f?.quantity),
          price: str(f?.price),
          target: str(f?.target),
        })),
        cash: str(p.cash),
        plat: str(p.plat),
        settings: {
          rel: str(s.rel, "25"),
          cap: str(s.cap, "5"),
          whole: s.whole !== false,
        },
        saved: str(p.saved),
        prev,
      },
      now
    );
  } catch {
    return defaults();
  }
}

/** Persist state; returns the save timestamp ('' if storage is unavailable). */
export function save(s: State): string {
  const saved = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, saved }));
    return saved;
  } catch {
    return "";
  }
}
export function clearSaved(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
