# Portfolio rebalancer

A client-side Vue 3 + TypeScript + Vite app that tells you whether a portfolio of 2–10 funds needs rebalancing, and what to buy or sell. Nothing leaves the browser; entries are kept in `localStorage`.

```
npm install
npm run dev        # local dev server
npm test           # unit tests for the rebalancing maths
npm run build      # type-check + production build into dist/
```

**Deploy:** push to GitHub, then Settings → Pages → Source: _GitHub Actions_. The workflow in `.github/workflows` tests, builds and publishes on every push to `master`.

**Rule:** a fund is flagged when it is off target by more than _Allowed drift_ % of its target (default 25), capped at _Ceiling_ percentage points (default 5, optional). Maths lives in `src/lib/rebalance.ts`.
