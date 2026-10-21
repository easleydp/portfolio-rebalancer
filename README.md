# Portfolio rebalancer

This app tells you whether a portfolio of 2–10 funds needs rebalancing, and what to buy or sell. Nothing leaves the browser; entries are kept in `localStorage` to speed data entry next time the portfolio needs to be checked.

<a href="https://easleydp.github.io/portfolio-rebalancer/">Live example</a>

## How to use the app

1. **Enter your funds**. One row for each: its name or ticker, the quantity you hold, its current price in pence, and the percentage you want it to make up. The targets must add up to 100%.

2. **Add any spare cash** waiting to be invested, if you have some.

3. **Check your numbers**. Type in the total value your platform shows for the whole portfolio. If it doesn’t roughly match what you entered, the page will say so and try to point out the likely mistake.

4. **Read the result**. Each fund gets an acceptable range around its target. If any fund has moved outside its range, you’ll see what to buy or sell to get back on track. Otherwise, you’re told nothing needs doing. You can adjust how wide the ranges are in Settings.

**Next time**: open this page in the same browser. Your last entries will still be here, so just update the quantities and prices.

**Your privacy**: everything is worked out inside your browser. Nothing you type is sent anywhere. Your entries are kept only on this device, in this browser, so they won’t appear on other devices, and clearing your browser’s site data will erase them.

This page does arithmetic only. It doesn’t place trades, and it isn’t financial advice.

## Technical

This is a client-side Vue 3 + TypeScript + Vite app.

```
npm install
npm run dev    # local dev server
npm test       # unit tests for the rebalancing maths
npm run build  # type-check + production build into dist/
```

**Deploy:** push to GitHub, then Settings → Pages → Source: _GitHub Actions_. The workflow in `.github/workflows` tests, builds and publishes on every push to `master`.

**Rule:** a fund is flagged when it is off target by more than _Allowed drift_ % of its target (default 25), capped at _Ceiling_ percentage points (default 5, optional). Maths lives in `src/lib/rebalance.ts`.
