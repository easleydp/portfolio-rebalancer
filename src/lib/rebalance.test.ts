import { describe, expect, it } from "vitest";
import { formatPence, parseNum } from "./format";
import {
  acceptableRange,
  checkTotal,
  rebalance,
  toHoldings,
} from "./rebalance";

const h = (name: string, quantity: number, price: number, target: number) => ({
  name,
  quantity,
  price,
  target,
});
const opts = { rel: 25, cap: 5 as number | null, whole: true };

describe("parseNum / formatPence", () => {
  it("accepts pence, pounds, commas and percent signs", () => {
    expect(parseNum("1,206.00p")).toBe(1206);
    expect(parseNum("£12")).toBe(12);
    expect(parseNum(" 30% ")).toBe(30);
  });
  it("rejects junk and negatives", () => {
    for (const s of ["", "abc", "-5", "1.2.3", "p"])
      expect(parseNum(s)).toBeNull();
  });
  it("tidies prices and leaves invalid input alone", () => {
    expect(formatPence("1206")).toBe("1,206.00p");
    expect(formatPence("oops")).toBe("oops");
  });
});

describe("acceptableRange", () => {
  it("is relative for small targets and capped for large ones", () => {
    expect(acceptableRange(10, 25, 5)).toEqual([7.5, 12.5]);
    expect(acceptableRange(20, 25, 5)).toEqual([15, 25]);
    expect(acceptableRange(40, 25, 5)).toEqual([35, 45]);
  });
  it("is purely relative with no cap, and stays within 0–100", () => {
    expect(acceptableRange(40, 25, null)).toEqual([30, 50]);
    expect(acceptableRange(90, 25, null)[1]).toBe(100);
  });
});

describe("toHoldings", () => {
  const f = (
    name: string,
    quantity: string,
    price: string,
    target: string
  ) => ({ id: name, name, quantity, price, target });
  it("converts pence to pounds and sums targets", () => {
    const r = toHoldings([
      f("A", "10", "1,206.00p", "60"),
      f("B", "5", "200", "40"),
      f("", "", "", ""),
    ]);
    expect(r.holdings[0].price).toBeCloseTo(12.06);
    expect(r).toMatchObject({ incomplete: false, targetSum: 100 });
  });
  it("flags partly filled rows", () => {
    expect(toHoldings([f("A", "10", "", "50")]).incomplete).toBe(true);
  });
});

describe("rebalance", () => {
  it("reports no action when every fund is in range", () => {
    expect(
      rebalance([h("A", 52, 1, 50), h("B", 48, 1, 50)], 0, opts).needed
    ).toBe(false);
  });
  it("flags a small fund that has drifted relatively far, though under 5 points", () => {
    const p = rebalance([h("A", 87, 1, 90), h("B", 13, 1, 10)], 0, opts); // B is 13% vs 10%: 3 points, 30% relative
    expect(p.rows[1].off).toBe(true);
    expect(p.rows[0].off).toBe(false);
  });
  it("sells the overweight fund and buys the underweight one", () => {
    const p = rebalance([h("A", 70, 1, 50), h("B", 30, 1, 50)], 0, opts);
    expect(p.needed).toBe(true);
    expect(p.rows.map((r) => r.qty)).toEqual([-20, 20]);
  });
  it("spreads spare cash towards targets and never overspends it on buys", () => {
    const p = rebalance([h("A", 50, 3, 50), h("B", 50, 3, 50)], 100, opts);
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.rows.every((r) => r.qty >= 0)).toBe(true);
  });
  it("never sells more than is held", () => {
    const p = rebalance([h("A", 1, 100, 1), h("B", 1, 1, 99)], 0, opts);
    expect(p.rows[0].qty).toBeGreaterThanOrEqual(-1);
  });
});

describe("checkTotal", () => {
  it("accepts a close match", () => {
    expect(checkTotal([h("A", 100, 1.5, 100)], 10, 161).ok).toBe(true);
  });
  it("spots a price typed in pounds instead of pence", () => {
    const r = checkTotal([h("A", 100, 12.06, 60), h("B", 50, 4, 40)], 0, 1406); // A should be £1,206
    expect(r.ok).toBe(true);
    const slip = checkTotal(
      [h("A", 100, 0.1206, 60), h("B", 50, 4, 40)],
      0,
      1406
    );
    expect(slip).toMatchObject({ ok: false });
    expect(!slip.ok && slip.hint).toMatch(/A.*100 times too small/);
  });
  it("suggests entering cash when the platform total is higher", () => {
    const r = checkTotal([h("A", 10, 10, 100)], 0, 200);
    expect(!r.ok && r.hint).toMatch(/cash/);
  });
});
