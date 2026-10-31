/** Parses and formats portfolio values for display and user input. */
const numberPattern = /^(?:\d[\d,]*\.?\d*|\.\d+)$/;

function parseFormattedNumber(input: string, prefix?: string, suffix?: string): number | null {
  let value = String(input ?? "").trim();
  if (prefix && value.startsWith(prefix)) value = value.slice(prefix.length);
  if (suffix && value.endsWith(suffix)) value = value.slice(0, -suffix.length);
  if (!numberPattern.test(value)) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse user input such as "1,206.00p", "£12" or "30%". Returns null unless it is a non-negative number. */
export function parseNum(input: string): number | null {
  const value = String(input ?? "").trim();
  const prefix = value.startsWith("£") ? "£" : undefined;
  const suffix = /[p%]$/i.test(value) ? value.slice(-1) : undefined;
  return parseFormattedNumber(value, prefix, suffix);
}

/** Parse a whole-share quantity. */
export function parseQuantity(input: string): number | null {
  const value = parseFormattedNumber(input);
  return value !== null && Number.isInteger(value) ? value : null;
}

/** Parse a percentage, optionally including a trailing percent sign. */
export function parsePercent(input: string): number | null {
  const value = String(input ?? "").trim();
  return parseFormattedNumber(input, undefined, value.endsWith("%") ? "%" : undefined);
}

/** Parse a pounds amount, optionally including a leading pound sign. */
export function parsePounds(input: string): number | null {
  const value = String(input ?? "").trim();
  return parseFormattedNumber(input, value.startsWith("£") ? "£" : undefined);
}

/** Like parseNum, but for pence-denominated fields: a £ prefix is treated as pounds and
 *  converted to pence (×100). e.g. "£12" → 1200, "1206" → 1206, "1,206.00p" → 1206. */
export function parsePence(input: string): number | null {
  const value = String(input ?? "").trim();
  const isPounds = value.startsWith("£");
  const v = isPounds
    ? parseFormattedNumber(input, "£")
    : parseFormattedNumber(input, undefined, /p$/i.test(value) ? value.slice(-1) : undefined);
  return v === null ? null : isPounds ? v * 100 : v;
}

/** Tidy a pence price on blur: "1206" → "1,206.00p". A £ prefix is converted first. Invalid input is returned untouched. */
export function formatPence(input: string): string {
  const v = parsePence(input);
  return v === null
    ? input
    : v.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }) + "p";
}

/** Tidy a whole-share quantity on blur. Invalid or fractional input is returned untouched. */
export function formatQuantity(input: string): string {
  const v = parseQuantity(input);
  if (v === null) return input;
  return v.toLocaleString("en-GB");
}

/** Tidy a pounds amount on blur: "1234.5" → "1,234.50". Invalid input is returned untouched. */
export function formatPounds(input: string): string {
  const v = parsePounds(input);
  return v === null
    ? input
    : v.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

/** Tidy a percentage on blur: "30%" → "30". Invalid input is returned untouched. */
export function formatPercent(input: string): string {
  const v = parsePercent(input);
  return v === null ? input : String(v);
}

export const gbp = (v: number): string => {
  // If v is a tiny negative floating point remainder (e.g. -0.001 or -1e-7, which
  // frequently occurs in floating point arithmetic like cash - rows.reduce(...)), v < 0
  // evaluates to true, but Math.abs(v) rounds to 0.00. Avoids formatting as "-£0.00".
  const rounded = Math.round(v * 100) / 100;
  const abs = Math.abs(rounded);
  return (
    (rounded < 0 ? "-" : "") +
    "£" +
    abs.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
};

export const pct = (v: number): string => `${Math.round(v * 10) / 10}%`;
