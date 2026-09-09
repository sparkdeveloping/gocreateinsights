# GoCreate Insight Studio

A full Next.js single-page analytics application built around the uploaded `gocreate-master-2026-09-09.csv` member dataset.

## What is included

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- Framer Motion 13
- Recharts 3
- One-page, responsive operations dashboard
- Animated KPI and hero states
- Global search and filter controls
- Click-to-filter status and membership charts
- Adjustable top-category count and chart density
- Lifecycle trend with switchable members / visits / guests metrics
- Interactive membership pie visualization
- Animated affiliation bars
- Member engagement scatter plot with click-through detail
- Paginated member explorer
- Animated member detail drawer
- Filtered CSV export
- Source-data preparation script
- Server-side API routes that keep email/phone out of the initial dashboard payload

## Brand direction

The visual direction uses a dark operational canvas with blue and yellow accents plus black/ink, matching the documented GoCreate color identity. The geometric mark in this prototype is an original interface mark inspired by the dimensional maker/assembly concept; replace it with the official production logo asset when available.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
npm start
```

## Updating the dataset

Replace the CSV in `data/`, then run:

```bash
npm run prepare:data -- data/your-new-file.csv
```

That regenerates:

- `src/data/members-summary.json` — lightweight dashboard records
- `src/data/member-details.json` — detail drawer records
- `src/data/dataset-meta.json` — source metadata

## Data/privacy note

This project contains real member contact and operational data from the supplied CSV. The initial dashboard endpoint intentionally omits email and phone, but the member-detail API returns them when a row is opened. **Do not deploy this repository publicly without adding authentication, authorization, audit logging, and the data-governance controls appropriate for GoCreate.**

For a public demo, remove the source CSV and replace the generated JSON with synthetic or de-identified data.

## Architecture

The visible product remains a single page at `/`. Internal API routes are used only for data delivery:

- `GET /api/dashboard` — member summaries + source metadata
- `GET /api/member/:id` — one detailed record

All aggregation and cross-filter interaction happens client-side over the lightweight member summary collection, so chart response is immediate after initial load.

## Suggested next production steps

1. Add SSO/RBAC and protect both API routes.
2. Replace static snapshot data with the canonical GoCreate database/API.
3. Add date-range controls backed by real visit-event history.
4. Add studio/tool utilization when those event streams are available.
5. Persist dashboard views per staff member.
6. Add anomaly alerts and scheduled operational reports.
7. Add server-side export controls and an audit trail for PII access.
# gocreateinsights
