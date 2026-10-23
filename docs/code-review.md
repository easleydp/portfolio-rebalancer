# Code Review & Architecture Audit: Portfolio Rebalancer

**Date:** 23 October 2026  
**Auditor:** Automated Senior Engineering Review  
**Repository Scope:** `src/`, `index.html`, `vite.config.ts`, `tsconfig.json`

---

## Executive Summary

The **Portfolio Rebalancer** is a clean, focused, single-page application built with Vue 3, TypeScript, and Vite. It demonstrates strong architectural principles:
- Clear separation between UI presentation state and the persistence layer (pure numbers and pounds in `localStorage`).
- Zero external UI library bloat, utilizing native CSS variables, flexbox, and grid.
- Strict client-side privacy with zero telemetry or network egress.
- Fast, deterministic unit tests for mathematical routines.

However, an aggressive review reveals several **critical logic defects**, **financial calculation edge-cases** (including an unconstrained short-sell bug on fractional shares), **screen reader accessibility issues**, and **performance/reactivity smells** that should be resolved to ensure industrial-strength reliability.

---

## Issue Classification Taxonomy

| Severity | Description | Count |
| :--- | :--- | :---: |
| 🔴 **Severe** | Logical bugs, calculation errors, crash risks, or incorrect financial directives. | **4** |
| 🟠 **Moderate** | Architectural smells, unhandled edge cases, performance bottlenecks, or user UX traps. | **6** |
| 🟡 **Minor** | Accessibility oversights, dead code, CSS/markup refinements, and test gaps. | **6** |
| 🟢 **Commendation** | Standout architectural patterns and best practices. | **4** |

---

## 1. 🔴 Severe Issues

### 1.1 Unconditional Warning Bug in `waiting` Computed Property
* **Location:** [`src/App.vue` (Lines 9–13)](file:///home/david/GitHub/portfolio-rebalancer/src/App.vue#L9-L13)
* **Code:**
  ```typescript
  const waiting = computed(() => [
    parsed.value.incomplete && 'Every fund needs a name, quantity, a price and a target.',
    parsed.value.holdings.length < 2 && 'Enter at least two funds.',
    'Targets must add up to exactly 100%.', // <-- Unconditional string!
  ].filter(Boolean).join(' '))
  ```
* **Impact:**  
  The third string in the array is a raw literal with no boolean gate (e.g. `!targetsOk.value && ...`). Because non-empty strings are always truthy, `.filter(Boolean)` **never removes it**.
  
  Whenever `ready` is false (for example, when a user enters Fund 1 with a 100% target, or enters two funds totaling 100% but is still typing a price), Step 4 displays:
  > *"Waiting for your details: Every fund needs a name, quantity, a price and a target. Targets must add up to exactly 100%."*
  
  The user is falsely told their targets do not sum to 100%, even when the green banner above explicitly says *"Targets add up to 100% ✓"*.
* **Remediation:**
  Change line 12 to:
  ```typescript
  !targetsOk.value && 'Targets must add up to exactly 100%.',
  ```

---

### 1.2 Fractional Shares Allowed to Short-Sell Beyond Owned Quantity
* **Location:** [`src/lib/rebalance.ts` (Line 67)](file:///home/david/GitHub/portfolio-rebalancer/src/lib/rebalance.ts#L67)
* **Code:**
  ```typescript
  // Whole shares: buys round down (never overspend), sells round to nearest (never more than held).
  q = o.whole 
    ? (q > 0 ? Math.floor(q + 1e-9) : -Math.min(h.quantity, Math.round(-q))) 
    : Math.round(q * 1000) / 1000
  ```
* **Impact:**  
  Notice that `-Math.min(h.quantity, ...)` was **only applied to whole shares** (`o.whole === true`).
  
  When whole shares are disabled (`o.whole === false`), `q` is rounded via `Math.round(q * 1000) / 1000` without any bound checking against `h.quantity`. If a fund's target drops significantly, or if portfolio value fluctuates such that the target allocation requires selling more shares than currently held, `q` can be a negative number exceeding `-h.quantity` (e.g., holding `1.5` shares, but instructed to *"Sell 2.15 shares"*). 
  
  In a long-only retail portfolio, short selling is impossible; a sell instruction must **never** exceed the quantity held.
* **Remediation:**
  Apply the `-Math.min(h.quantity, ...)` floor to both whole and fractional sell branches:
  ```typescript
  if (o.whole) {
    q = q > 0 ? Math.floor(q + 1e-9) : -Math.min(h.quantity, Math.round(-q))
  } else {
    q = q > 0 ? Math.round(q * 1000) / 1000 : -Math.min(h.quantity, Math.round(-q * 1000) / 1000)
  }
  ```

---

### 1.3 Unhandled Division by Zero / `NaN` Propagation in `rebalance()`
* **Location:** [`src/lib/rebalance.ts` (Lines 59–72)](file:///home/david/GitHub/portfolio-rebalancer/src/lib/rebalance.ts#L59-L72)
* **Impact:**
  1. `toHoldings` allows `quantity: 0` (e.g. entering a new fund you don't yet own). If all funds have `quantity: 0`, `total` is `0`.
  2. In `rebalance`:
     ```typescript
     const weight = (value / total) * 100 // 0 / 0 = NaN
     ```
     `weight` becomes `NaN`, `drift` becomes `NaN`, and `off` evaluates to `false`.
  3. Furthermore, line 71 executes:
     ```typescript
     const worst = rows.reduce((a, b) => (b.drift < a.drift ? b : a))
     ```
     If `holdings` is empty (`[]`), calling `.reduce()` without an initial value throws an uncaught runtime exception:
     `TypeError: Reduce of empty array with no initial value`.
* **Remediation:**
  Add a defensive guard at the top of `rebalance`:
  ```typescript
  if (!holdings.length || total <= 0) {
    throw new Error('rebalance requires at least one holding with positive total value')
  }
  ```

---

### 1.4 Inverted Acceptable Ranges via Negative Settings
* **Location:** [`src/lib/rebalance.ts` (Lines 32–35)](file:///home/david/GitHub/portfolio-rebalancer/src/lib/rebalance.ts#L32-L35)
* **Code:**
  ```typescript
  export function acceptableRange(target: number, rel: number, cap: number | null): [number, number] {
    let half = (target * rel) / 100
    if (cap !== null && cap < half) half = cap
    return [Math.max(0, target - half), Math.min(100, target + half)]
  }
  ```
* **Impact:**  
  The inputs for `Allowed drift` (`rel`) and `Ceiling` (`cap`) are text boxes. If a user enters a negative number (e.g. `-10`), `half` becomes negative (`-1`).
  Then:
  - `lo = target - (-1) = target + 1`
  - `hi = target + (-1) = target - 1`
  The range inverts (`lo > hi`), causing the fund to register as permanently out of range regardless of actual weight.
* **Remediation:**
  Sanitize `rel` and `cap` to ensure non-negativity:
  ```typescript
  const safeRel = Math.max(0, rel)
  const safeCap = cap !== null ? Math.max(0, cap) : null
  ```

---

## 2. 🟠 Moderate Issues

### 2.1 Synchronous LocalStorage Writes on Every Keystroke
* **Location:** [`src/composables/usePortfolio.ts` (Lines 9–15)](file:///home/david/GitHub/portfolio-rebalancer/src/composables/usePortfolio.ts#L9-L15)
* **Code:**
  ```typescript
  watch(
    state,
    () => {
      savedAt.value = save(state);
    },
    { deep: true }
  );
  ```
* **Impact:**  
  A deep watcher on `state` fires on **every single keystroke** across all inputs. On every character typed:
  1. Vue runs full deep reactivity checks.
  2. `save()` converts all fund rows, prices, and cash into pure numbers.
  3. `JSON.stringify()` serializes the state tree.
  4. `localStorage.setItem()` blocks the browser's single thread with synchronous disk I/O.
  
  On mobile devices or under CPU throttling, typing rapidly in the quantity or price fields can drop frames and cause noticeable input stutter.
* **Remediation:**  
  Debounce the persistence call by 300–500ms, or save on field blur/window unload.

---

### 2.2 Blind Comma Stripping Breaks European Decimal Inputs
* **Location:** [`src/lib/format.ts` (Line 3)](file:///home/david/GitHub/portfolio-rebalancer/src/lib/format.ts#L3)
* **Code:**
  ```typescript
  const t = String(input ?? '').trim().replace(/^£/, '').replace(/[p%]$/i, '').replace(/,/g, '').trim()
  ```
* **Impact:**  
  The parser strips all commas globally: `replace(/,/g, '')`.
  While standard for UK digit grouping (`1,200` → `1200`), users with European keyboards or copying from European brokerage statements where `,` is the decimal point (e.g. `12,50` shares or `44,5` cash) will find their numbers silently multiplied:
  - `12,50` becomes `1250` (100× error)
  - `1,5` becomes `15` (10× error)
* **Remediation:**  
  Detect if a comma acts as a decimal point (e.g. single comma followed by 1 or 2 digits with no preceding commas), or disallow ambiguous multi-comma sequences while respecting locale.

---

### 2.3 Division by Zero in `checkTotal`
* **Location:** [`src/lib/rebalance.ts` (Line 42)](file:///home/david/GitHub/portfolio-rebalancer/src/lib/rebalance.ts#L42)
* **Code:**
  ```typescript
  const close = (x: number) => Math.abs(x - platform) / platform <= TOLERANCE
  ```
* **Impact:**  
  If `platform` is passed as `0`, `Math.abs(x - 0) / 0` evaluates to `Infinity` (or `NaN` if `x === 0`).
  Although `usePortfolio.ts` currently guards `v !== null && v > 0`, `checkTotal` is an exported pure library function and should defend itself against `platform <= 0`.
* **Remediation:**
  Guard `if (platform <= 0) return { ok: false, mine, hint: 'Platform total must be greater than zero.' }`.

---

### 2.4 Negative Zero Artifact (`"-£0.00"`) in Currency Formatter
* **Location:** [`src/lib/format.ts` (Lines 42–43)](file:///home/david/GitHub/portfolio-rebalancer/src/lib/format.ts#L42-L43)
* **Code:**
  ```typescript
  export const gbp = (v: number): string =>
    (v < 0 ? '-' : '') + '£' + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  ```
* **Impact:**  
  If `v` is a tiny negative floating point remainder (e.g. `-0.001` or `-1e-7`, which frequently occurs in floating point arithmetic like `cash - rows.reduce(...)`), `v < 0` evaluates to `true`, but `Math.abs(v)` rounds to `0.00`.
  The function formats this as **`"-£0.00"`**.
* **Remediation:**
  Round before evaluating sign:
  ```typescript
  export const gbp = (v: number): string => {
    const rounded = Math.round(v * 100) / 100
    const abs = Math.abs(rounded)
    return (rounded < 0 ? '-' : '') + '£' + abs.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  ```

---

### 2.5 Double-Save and Thrash on `reset()`
* **Location:** [`src/composables/usePortfolio.ts` (Lines 56–62)](file:///home/david/GitHub/portfolio-rebalancer/src/composables/usePortfolio.ts#L56-L62)
* **Code:**
  ```typescript
  function reset() {
    Object.assign(state, defaults());
    nextTick(() => {
      clearSaved();
      savedAt.value = "";
    }); // after the watcher has run
  }
  ```
* **Impact:**  
  When `reset()` runs, mutating `state` synchronously fires the deep watcher, which saves the empty defaults to `localStorage` under `KEY`.
  Then, one tick later, `nextTick` calls `clearSaved()` to delete `KEY`.
  Writing to disk only to immediately delete the file a microsecond later is a race-prone pattern that relies on Vue scheduler internals.
* **Remediation:**  
  Use a boolean flag (e.g. `isResetting = true`) to suppress the watcher during reset.

---

### 2.6 Mandatory Step 3 Blocks Legitimate Rebalancing Scenarios
* **Location:** [`src/composables/usePortfolio.ts` (Line 41)](file:///home/david/GitHub/portfolio-rebalancer/src/composables/usePortfolio.ts#L41)
* **Code:**
  ```typescript
  const plan = computed(() => {
    if (!ready.value || !check.value?.ok || total.value <= 0) return null;
    ...
  });
  ```
* **Impact:**  
  Step 3 ("Check your numbers") requires entering the platform total. If a user:
  - Holds funds across two different platforms (e.g. ISA on Vanguard + SIPP on AJ Bell), or
  - Uses an offline ledger or paper statement without a single aggregated total,
  
  they are hard-blocked from ever seeing rebalance instructions in Step 4. Step 3 is framed in the copy as a helpful check to catch slips, but in code it is an immovable prerequisite.
* **Remediation:**  
  Allow users to bypass Step 3 with an explicit *"Skip check / I don't have a single platform total"* toggle.

---

## 3. 🟡 Minor Issues & Code Health

### 3.1 Screen Reader Clutter from Section-Wide `aria-live="polite"`
* **Location:** [`src/App.vue` (Line 93)](file:///home/david/GitHub/portfolio-rebalancer/src/App.vue#L93)
* **Impact:**  
  `<section aria-labelledby="h-res" aria-live="polite">` wraps the entire results section (including the full trades table and multiple banner statuses). Every time a user changes a digit in any input, the entire updated results block is queued into the screen reader's speech synthesizer, causing annoying, repetitive announcements.
* **Remediation:**  
  Place `aria-live="polite"` only on dynamic notification banners (e.g. `<div class="banner">`), never on an entire section containing a data table.

---

### 3.2 Non-Descriptive `aria-label` on Fund Removal Buttons
* **Location:** [`src/components/FundRow.vue` (Line 39)](file:///home/david/GitHub/portfolio-rebalancer/src/components/FundRow.vue#L39)
* **Code:**
  ```html
  <button v-if="canRemove" type="button" class="x" aria-label="Remove this fund" @click="$emit('remove')">Remove</button>
  ```
* **Impact:**  
  All remove buttons render identical `aria-label="Remove this fund"` text. A screen reader user navigating via the elements/buttons list hears *"Remove this fund, button"*, *"Remove this fund, button"* with no indication of which row is being deleted.
* **Remediation:**  
  Change to `:aria-label="`Remove ${fund.name.trim() || 'this fund'}`"`.

---

### 3.3 Missing Semantic `<label>` for Cash and Platform Total Inputs
* **Location:** [`src/App.vue` (Lines 66, 78)](file:///home/david/GitHub/portfolio-rebalancer/src/App.vue#L66)
* **Impact:**  
  Inputs in Step 2 and Step 3 rely exclusively on `aria-label` attributes. There is no visible `<label for="...">` linking the section title or hint text to the input, which impairs click-to-focus behavior and reduces accessibility compliance (WCAG 2.1 Criterion 3.3.2).
* **Remediation:**  
  Add explicit `<label>` elements associated via `id`.

---

### 3.4 Dead CSS Selectors in `style.css`
* **Location:** [`src/style.css` (Lines 123–125)](file:///home/david/GitHub/portfolio-rebalancer/src/style.css#L123-L125)
* **Code:**
  ```css
  .val.warn {
    color: var(--warn);
  }
  ```
* **Impact:**  
  The previous-price jump guardrail (`jumped`) was recently removed from `FundRow.vue`, leaving `.val.warn` completely unused.
* **Remediation:**  
  Remove lines 123–125 during next CSS cleanup.

---

### 3.5 Missing Semantic Table Attributes (`scope="col"` / `scope="row"`)
* **Location:** [`src/App.vue` (Lines 114–120, 124)](file:///home/david/GitHub/portfolio-rebalancer/src/App.vue#L114-L120)
* **Impact:**  
  The results `<table>` does not define `scope="col"` on `<th>` elements, nor does it define `<th scope="row">` on row headers (`r.name`). Screen readers in table-navigation mode cannot accurately identify column and row associations.
* **Remediation:**  
  Add `scope="col"` to column headers and render `<td>{{ r.name }}</td>` as `<th scope="row">{{ r.name }}</th>`.

---

### 3.6 Unbounded Precision in Fractional Quantity Formatter
* **Location:** [`src/lib/format.ts` (Lines 25–27)](file:///home/david/GitHub/portfolio-rebalancer/src/lib/format.ts#L25-L27)
* **Impact:**  
  `formatQuantity` allows up to 10 decimal places (`maximumFractionDigits: 10`), while `rebalance.ts` rounds fractional shares to 3 decimal places (`Math.round(q * 1000) / 1000`). This mismatch means inputting `10.12345` shares displays nicely in Step 1, but Step 4 rounds trades to 3 decimals, leaving residual fractions.
* **Remediation:**  
  Align precision across both formatting and rebalancing calculations.

---

## 4. 🟢 Commendations & Strengths

1. **Clean Persistence Architecture:**  
   The isolation between formatted UI strings in the Vue components and pure numeric pounds in [`src/lib/storage.ts`](file:///home/david/GitHub/portfolio-rebalancer/src/lib/storage.ts) provides a robust, unambiguous data contract.
2. **Defensive Slip Detection (`checkTotal`):**  
   The diagnostic slip heuristic in [`src/lib/rebalance.ts`](file:///home/david/GitHub/portfolio-rebalancer/src/lib/rebalance.ts#L38-L55) that checks for 10× and 100× errors (e.g. typing pounds instead of pence) is an exceptional, practical user-assist feature for UK financial platforms.
3. **No External Framework Overhead:**  
   The entire application runs on vanilla Vue 3 without bulky component libraries or UI frameworks, yielding a tiny 82 kB JavaScript bundle and instantaneous load times.
4. **Resilient LocalStorage Hydration:**  
   `storage.ts` safely handles missing, corrupt, or partially formed JSON structures and falls back cleanly to defaults without crashing the app.

---

## 5. Priority Action Plan

```
High Priority (Immediate Fixes)
├── 1. Fix unconditional 'Targets must add up to 100%' string in App.vue
├── 2. Clamp fractional share sells to -h.quantity in rebalance.ts
├── 3. Guard rebalance() against empty arrays and zero total value
└── 4. Sanitize settings (rel, cap) to prevent negative ranges

Medium Priority (Next Release)
├── 5. Debounce save() in usePortfolio.ts
├── 6. Guard checkTotal against platform <= 0
├── 7. Fix negative zero "-£0.00" output in gbp()
└── 8. Provide option to bypass Step 3 for multi-platform investors

Low Priority (Technical Debt)
├── 9. Scope table headers and add specific aria-labels to buttons
├── 10. Remove dead .val.warn CSS selector
└── 11. Add unit tests for fractional sells and negative settings
```
