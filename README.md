# GoCreate Insights v3

A strictly light-mode, single-page Next.js analytics application for GoCreate membership intelligence. The project combines the master member export with the newer membership-detail workbook and uses the official supplied GoCreate brand assets.

## What changed in v3

- Strict light mode only; no dark theme, theme toggle, or automatic dark color scheme.
- Official GoCreate horizontal blue/black/yellow logo in the header; supplied GoCreate/WSU/WuShock SVG variants are included under `public/brand/`.
- Sticky horizontal navigation with full words and icons.
- Every KPI and meaningful data affordance drills into a cohort, person, filter, or explanation.
- Framer Motion is used for useful state communication: count changes, tab changes, drawers, list reflow, hover click affordances, application-history expansion, chart entry, and filter/result transitions.
- The richer workbook adds application status/type, model release, signatures, assistance, age bands, home geography, completeness analysis, and reconciliation views.
- Sensitive data is excluded from the client analytics payload and masked in public member detail by default.

## Data included

- `data/source/gocreate-master-2026-09-09.csv`
- `data/source/gocreate_membership_details.xlsx`
- 2,383 master member records
- 359 application/detail rows
- 718 emergency-contact rows

Run `npm run prepare:data` whenever either source file changes.

## Local setup

```bash
npm install
npm run prepare:data
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run check
npm run build
npm start
```

## PII mode

Default detail responses are masked. For an authenticated internal deployment only:

```bash
GOCREATE_PII_MODE=full
```

Do not enable that flag on an unauthenticated public deployment.

See `AUDIT.md` for the product/audit rationale and `BUILD-BRIEF.md` for the extended implementation brief.
