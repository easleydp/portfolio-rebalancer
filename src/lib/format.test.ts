import { describe, expect, it } from "vitest";
import { formatPence, formatPercent, formatPounds, formatQuantity, parsePence, parseNum } from "./format";

describe("parseNum / formatPence", () => {
  it("accepts pence, pounds, commas and percent signs", () => {
    expect(parseNum("1,206.00p")).toBe(1206);
    expect(parseNum("£12")).toBe(12); // strips £ and returns the literal number
    expect(parseNum(" 30% ")).toBe(30);
  });
  it("rejects junk and negatives", () => {
    for (const s of ["", "abc", "-5", "1.2.3", "p"])
      expect(parseNum(s)).toBeNull();
  });
  it("tidies prices and leaves invalid input alone", () => {
    expect(formatPence("1206")).toBe("1,206.00p");
    expect(formatPence("£12")).toBe("1,200.00p"); // £12 pounds → 1200 pence
    expect(formatPence("oops")).toBe("oops");
  });
  it("tidies percentages and leaves invalid input alone", () => {
    expect(formatPercent("30%")).toBe("30");
    expect(formatPercent(" 30% ")).toBe("30");
    expect(formatPercent("oops")).toBe("oops");
  });
});

describe("parsePence", () => {
  it("converts a £-prefixed value from pounds to pence", () => {
    expect(parsePence("£12")).toBe(1200);
    expect(parsePence("£1,206")).toBe(120600);
    expect(parsePence("£0.50")).toBe(50);
  });
  it("passes through plain pence values unchanged", () => {
    expect(parsePence("1206")).toBe(1206);
    expect(parsePence("1,206.00p")).toBe(1206);
  });
  it("returns null for invalid input", () => {
    expect(parsePence("")).toBeNull();
    expect(parsePence("abc")).toBeNull();
    expect(parsePence("-5")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("inserts missing thousands separators", () => {
    expect(formatQuantity("10000")).toBe("10,000");
    expect(formatQuantity("1000000")).toBe("1,000,000");
    expect(formatQuantity("1234")).toBe("1,234");
  });
  it("fixes separators entered in illegal positions", () => {
    expect(formatQuantity("100,00")).toBe("10,000");
    expect(formatQuantity("1,00,000")).toBe("100,000");
  });
  it("preserves fractional shares up to 10 decimal places and strips trailing zeros", () => {
    expect(formatQuantity("1234.5")).toBe("1,234.5");
    expect(formatQuantity("1000.25")).toBe("1,000.25");
    expect(formatQuantity("1.1234567890")).toBe("1.123456789");
  });
  it("handles small numbers without adding spurious separators", () => {
    expect(formatQuantity("0")).toBe("0");
    expect(formatQuantity("999")).toBe("999");
    expect(formatQuantity("1000")).toBe("1,000");
  });
  it("leaves invalid input untouched", () => {
    expect(formatQuantity("")).toBe("");
    expect(formatQuantity("abc")).toBe("abc");
    expect(formatQuantity("-5")).toBe("-5");
    expect(formatQuantity("1.2.3")).toBe("1.2.3");
  });
});

describe("formatPounds", () => {
  it("inserts missing thousands separators and normalises to 2 decimal places", () => {
    expect(formatPounds("1234")).toBe("1,234.00");
    expect(formatPounds("1234.5")).toBe("1,234.50");
    expect(formatPounds("1234.56")).toBe("1,234.56");
    expect(formatPounds("1000000")).toBe("1,000,000.00");
  });
  it("fixes separators entered in illegal positions", () => {
    expect(formatPounds("100,00")).toBe("10,000.00");
    expect(formatPounds("1,00,000")).toBe("100,000.00");
  });
  it("accepts a £ prefix (same tolerance as parseNum)", () => {
    expect(formatPounds("£1234")).toBe("1,234.00");
    expect(formatPounds("£1,00,0.50")).toBe("1,000.50");
  });
  it("rounds to 2 decimal places", () => {
    expect(formatPounds("1.005")).toBe("1.01");
    expect(formatPounds("1.004")).toBe("1.00");
  });
  it("handles zero and small values", () => {
    expect(formatPounds("0")).toBe("0.00");
    expect(formatPounds("999")).toBe("999.00");
  });
  it("leaves invalid input untouched", () => {
    expect(formatPounds("")).toBe("");
    expect(formatPounds("abc")).toBe("abc");
    expect(formatPounds("-5")).toBe("-5");
  });
});
