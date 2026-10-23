import {
  formatPence,
  formatPercent,
  formatPounds,
  formatQuantity,
  parseNum,
  parsePence,
} from "./format";
import type { Fund, Settings } from "./rebalance";

export interface State {
  funds: Fund[];
  cash: string;
  plat: string;
  settings: Settings;
  saved: string;
  prev: Record<string, number> | null; // prices in pounds
}

export interface StoredFund {
  id: string;
  name: string;
  quantity: number | null;
  price: number | null; // in pounds
  target: number | null;
}

export interface StoredSettings {
  rel: number;
  cap: number | null;
  whole: boolean;
}

export interface StoredState {
  funds: StoredFund[];
  cash: number | null; // in pounds
  plat: number | null; // in pounds
  settings: StoredSettings;
  saved: string;
  prev: Record<string, number> | null; // in pounds
}

export const KEY = "portfolio-rebalancer-v2";
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
const num = (x: unknown): number | null =>
  typeof x === "number" && Number.isFinite(x) ? x : null;

/** Convert a UI Fund row into pure numbers for storage (price stored in pounds). */
export function toStoredFund(f: Fund): StoredFund {
  const pence = parsePence(f.price);
  return {
    id: f.id,
    name: f.name,
    quantity: parseNum(f.quantity),
    price: pence !== null ? pence / 100 : null,
    target: parseNum(f.target),
  };
}

/** Hydrate a stored fund back into formatted UI strings (price formatted as pence). */
export function fromStoredFund(f: Record<string, unknown>): Fund {
  const q = num(f.quantity);
  const p = num(f.price); // stored in pounds
  const t = num(f.target);
  return {
    ...newFund(),
    id: typeof f.id === "string" && f.id ? f.id : newFund().id,
    name: str(f.name),
    quantity: q !== null ? formatQuantity(String(q)) : "",
    price: p !== null ? formatPence(String(Number((p * 100).toFixed(4)))) : "",
    target: t !== null ? formatPercent(String(t)) : "",
  };
}

/** Serialize UI State into StoredState with pure numbers and pounds throughout. */
export function toStoredState(s: State, saved: string): StoredState {
  return {
    funds: s.funds.map(toStoredFund),
    cash: parseNum(s.cash),
    plat: parseNum(s.plat),
    settings: {
      rel: parseNum(s.settings.rel) ?? 25,
      cap: parseNum(s.settings.cap),
      whole: s.settings.whole !== false,
    },
    saved,
    prev: s.prev,
  };
}

/** If the last save was over 60 days ago, remember those prices for year-on-year checks (in pounds) and clear the stale platform total. */
export function rollover(s: State, now: number): State {
  const t = Date.parse(s.saved);
  if (!Number.isFinite(t) || now - t <= NEW_YEAR_MS) return s;
  const prev: Record<string, number> = {};
  for (const f of s.funds) {
    const pence = parsePence(f.price);
    if (key(f.name) && pence !== null && pence > 0) {
      prev[key(f.name)] = pence / 100; // in pounds
    }
  }
  return { ...s, prev, plat: "" };
}

/** Load saved state, tolerating missing, corrupt or older data. */
export function load(now = Date.now()): State {
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (!p || !Array.isArray(p.funds) || !p.funds.length) return defaults();
    const s =
      p.settings && typeof p.settings === "object"
        ? (p.settings as Record<string, unknown>)
        : {};
    const prev: Record<string, number> = {};
    if (p.prev && typeof p.prev === "object") {
      for (const [k, v] of Object.entries(p.prev)) {
        if (typeof v === "number" && Number.isFinite(v) && v > 0) {
          prev[k] = v;
        }
      }
    }
    const cashNum = num(p.cash);
    const platNum = num(p.plat);
    const relNum = num(s.rel);
    const capNum = num(s.cap);

    return rollover(
      {
        funds: p.funds
          .slice(0, 10)
          .map((f: Record<string, unknown>) => fromStoredFund(f ?? {})),
        cash: cashNum !== null ? formatPounds(String(cashNum)) : "",
        plat: platNum !== null ? formatPounds(String(platNum)) : "",
        settings: {
          rel: relNum !== null ? String(relNum) : "25",
          cap: capNum !== null ? String(capNum) : "",
          whole: s.whole !== false,
        },
        saved: str(p.saved),
        prev: Object.keys(prev).length ? prev : null,
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
    const stored = toStoredState(s, saved);
    localStorage.setItem(KEY, JSON.stringify(stored));
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
