# GoCreate Insights v5.5

GoCreate Insights v5.5 is a strictly light-mode, single-page Next.js operational intelligence application for GoCreate. It combines the master membership export, the latest membership-detail workbook, and the historical paper sign-in archive into one source-aware analytics system without pretending that unlike data sources have the same precision.

**v5.5 base source refresh:** the newest uploaded workbook (`gocreate_membership_details(5).xlsx`) was welded into the stable project source path. This is a materially larger source than v5.3 (SHA-256 `1df915a3c04456e3c37b58e38d2f2a12ac5b155d67e17558537c90f88ae965b1` versus the prior `2f1c19ce3d275d8628fcab79e94dd391be19c4f2eeebce86f7c9021c9330b98f`). The full generation and manual-attendance reconciliation pipeline was rerun against it.

## What v5 adds

**Latest data refresh (Sep. 11, 2026):** the enrichment workbook has been replaced with the newest supplied database. The refreshed source more than doubles application coverage while preserving the existing attendance reconciliation and UI behavior.

- **Latest detail database merged:** `data/source/gocreate_membership_details.xlsx` now contains 2,125 application rows, 4,248 emergency-contact rows and 100,941 raw-control rows.
- **Membership Assistance is first-class reporting data:** 84 assistance application rows across 83 people are available all-time. 82 applications contain the five captured Assistance questionnaire responses (410 responses total), enabling reason, small-business, nonprofit/organization and quilting/reduced-rate analytics without exposing raw questionnaire text to the client.
- **Honest date behavior:** the default Koch reporting window is Sep. 1, 2025 → data-as-of. The refreshed workbook now contains **5 Membership Assistance submissions in that window**, while preserving **84 all-time** for context. Assistance submissions now extend through Aug. 5, 2026.
- **Historical paper attendance welded into Engagement:** manual sign-ins are kept as a separate source and conservatively reconciled with the master member list. High-confidence matches count as member visits, clear nonmatches count as guest sign-ins, uncertain matches stay in a review queue, and unreadable rows remain unresolved.
- **Source-aware combined activity:** tracker totals and matched manual member visits are shown separately plus a conservative observed-minimum figure. Possible exact duplicates can be subtracted when identifiable.
- **Global reporting range:** All time, Sep 2025 → now, current-year YTD, Last 90 days, and exact From/To controls.
- **Koch Report:** printable/PDF-ready leadership report for WSU/WSU Tech, Retail, Quilters/reduced rate, Membership Assistance, small-business references, nonprofit/organization references and age demographics.
- **Everything meaningful drills down:** KPI cards, report metrics, bars, donut slices, legends, source queues, badges, table rows and completeness metrics open their underlying records or an explanation.
- **Strict light mode only** with the supplied GoCreate brand assets.

## Current generated snapshot

Generated with data-as-of **2026-09-11** from:

- `data/source/gocreate-master-2026-09-09.csv`
- `data/source/gocreate_membership_details.xlsx`
- `data/source/manual-signins/scans.zip`
- preprocessed/manual reconciliation data under `data/analytics/`

Current totals:

- 2,383 master member records
- 2,468 known people after application-only records are included
- 2,125 application rows
- 4,248 emergency-contact rows
- 2,040/2,125 application rows matched to the master source (96.0%)
- 2,002 distinct master members enriched by application detail
- 85 application-only people
- 84 Membership Assistance application rows across 83 people
- 410 Membership Assistance questionnaire responses across 82 applications; two additional Assistance rows do not contain captured questionnaire responses
- Assistance submission range: 2024-01-23 through 2026-08-05
- 12 all-time small-business reference applications
- 28 all-time nonprofit/organization reference applications
- 15 all-time quilting/reduced-rate reference applications

### Assistance reason categories (all time)

The private questionnaire free text is classified into aggregate/reportable categories:

- Other / mixed use: 24
- Learn, create, or experience GoCreate: 19
- Quilting / textiles / sewing: 18
- Start or grow a business: 9
- Education / student project: 9
- Prototype / invention / product development: 2
- Community / nonprofit / volunteer project: 1
- Unknown / no captured questionnaire reason: 2

Raw questionnaire text is not emitted in the browser-safe analytics payload.

## Attendance reconciliation

The uploaded historical sign-in archive currently contributes:

- 82 unique scanned sign-in pages
- 2 exact duplicate scans ignored
- 513 detected sign-in rows
- 186 rows with a trustworthy date
- 327 rows with unknown/unreliable date
- 14 high-confidence matched member sign-ins across 10 members
- 390 guest sign-ins
- 27 possible member matches held for review
- 82 unreadable rows
- 216 tracker-source visits across 79 members
- 230 conservative combined member visits minimum before any future review promotions

The tracker export is an **aggregate per-member source**, not a complete event ledger. Its observed source window is approximately 2026-08-03 through 2026-09-09. v5 does not fabricate per-day tracker events for custom date ranges. A partial overlap with the tracker window is explicitly labeled as not exactly divisible by date.

## Leadership / Koch range

The Koch Report defaults to **2025-09-01 → data-as-of** when entered from All time. In the refreshed workbook there are **568 application rows** in that period, including **5 Membership Assistance rows**. The screen still shows the all-time Assistance context (**84 all-time**) so the selected-range number is never mistaken for the complete history.

Business/nonprofit/quilter signals are also date-scoped. If a selected period contains none, the report shows the all-time count where useful instead of implying the category never existed.

## Local setup

```bash
npm install
GOCREATE_AS_OF=2026-09-11 npm run prepare:data
npm run dev
```

Open `http://localhost:3000`.

`npm run prepare:data` rebuilds the master/application analytics and merges the already-processed manual attendance source. It does **not** rerun OCR.

To reprocess the paper scans from scratch:

```bash
npm run prepare:manual
```

That optional workflow requires local OCR/image tooling used by `scripts/prepare_manual_visits.py` (Tesseract, Poppler and the Python imaging/fuzzy-match dependencies referenced by that script). Keep the review CSV; it is the audit trail for uncertain handwriting.

## Build

```bash
npm run check
npm run build
npm start
```

The project source is designed for Vercel/Next.js App Router. In the packaging environment used to produce this ZIP, npm registry access timed out, so dependencies could not be installed for a full `next build`. The Python pipelines, generated JSON, TS/TSX syntax and archive integrity were validated independently.

## PDF export

Open **Koch report**, select the reporting range, then choose **Export / print PDF**. The print stylesheet hides application chrome and formats the leadership report for US Letter. Select **Save as PDF** in the browser print dialog.

## Privacy / PII

Bulk analytics intentionally exclude exact birthdates, email addresses, phone numbers, street addresses, emergency-contact values, medical-alert contents and raw Assistance questionnaire responses. The manual-sign-in browser payload also excludes guest handwriting/name text; uncertain rows expose only safe scan coordinates and member match suggestions.

Member detail is masked by default. For an authenticated internal deployment only:

```bash
GOCREATE_PII_MODE=full
```

Do not enable full PII on an unauthenticated public deployment. The project includes private source files for reproducibility, so the deployed app itself should be access-controlled if member names or source artifacts are not intended to be public.

See `AUDIT.md` for source/date semantics and `BUILD-BRIEF.md` for the product interaction contract.

## v5.5 — internal Modified Report

v5.5 adds a separate **Modified report** workspace for internal staff reporting. It is deliberately isolated from imported source data, the standard Koch Report, analytics calculations, and CSV exports.

The default manual presentation values are:

- Membership Assistance: **476**
- Small Businesses: **62**

These values are manual overrides, not database-derived statistics. The interface always labels them as manually adjusted and shows the current database-derived comparison alongside them. Staff can change the two values in the internal report UI for the current browser session; nothing is written back to JSON, Excel, CSV, or member records.

The internal report also includes the legacy figures supplied in `reference/internal-modified-report/legacy-report-history-reference.PNG`. Missing historical values are left blank rather than estimated.

### Internal visibility

The Modified Report is visible automatically in local development. In production it is hidden unless the server environment contains:

```bash
GOCREATE_INTERNAL_REPORTS=enabled
```

For genuinely staff-only use, enable this only on an authenticated/protected internal Vercel deployment. The environment toggle hides the feature from the normal production navigation but is not itself user authentication.
