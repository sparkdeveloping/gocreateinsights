# GoCreate Insights v4

A strictly light-mode, single-page Next.js operational intelligence application for GoCreate. v4 combines the master membership export with the membership-detail workbook and adds organization-wide reporting ranges, membership-assistance analytics, and a print/PDF-ready **Koch Report** built around the questions leadership actually asks.

## v4 highlights

- **Global reporting range** above the dashboard. Presets: All time, Sep 2025 → now, current-year YTD, Last 90 days, plus exact From/To dates.
- The range recalculates membership enrollment, application, demographic, assistance, data-quality and report views. Engagement includes an explicit caveat because the source does not contain complete historical visit-event rows.
- **Koch Report** top-level tab with the requested leadership categories:
  - WSU / WSU Tech members
  - Retail (`Public/Regular`) members
  - Quilters / reduced-rate references
  - Membership Assistance
  - Small-business references
  - Nonprofit / organization references
  - Age demographics
- Entering Koch Report from an all-time dashboard automatically selects **Sep. 1, 2025 → current data-as-of date**. A custom range is preserved if the user already chose one.
- **Print / Export PDF** produces a letter-sized multi-page report using the official GoCreate logo and blue/yellow report styling. In the browser print dialog choose **Save as PDF**.
- Membership Assistance is **denoted inside Membership and Applications**, not hidden in a separate silo. Assistance records, applicant ages and reason categories are drillable in the report.
- The current workbook contains one Membership Assistance row outside the Sep-2025-current window; the report calls this out and the notice expands to all dates and opens the underlying record.
- Business/nonprofit/reduced-rate classification is conservative. It only marks explicit source wording and does not scan contact fields, source URLs, or private notes that could cause false positives.
- If the final workbook later gains questionnaire columns for assistance reasons, business/nonprofit references, quilting/reduced-rate responses, etc., the data preparation script scans them automatically and the existing UI populates without a redesign.
- Every meaningful metric, chart mark, legend item, badge, table row and report number drills into records, filters a cohort, opens a member, or explains a limitation.
- Strict light mode; official supplied GoCreate/WSU/WuShock brand assets are included.

## Current data snapshot

Generated from:

- `data/source/gocreate-master-2026-09-09.csv`
- `data/source/gocreate_membership_details.xlsx`
- 2,383 master member records
- 359 application/detail rows
- 718 emergency-contact rows
- 350/359 application rows matched to the master source, covering 345 distinct master members
- 9 application-only people

With the leadership range **2025-09-01 through 2026-09-11**, the current files produce:

- 543 master membership submissions
- 457 WSU / WSU Tech memberships
- 38 Public/Regular (Retail) memberships
- 146 application rows
- 0 in-range Membership Assistance rows, with 1 older assistance row in the workbook
- Age distribution from latest in-range application per person: 18–24: 86; 25–34: 34; 35–44: 10; 45–54: 7; 55–64: 3; 65+: 3; Under 18: 3

The current workbook does **not** contain the questionnaire fields needed to reliably identify most small-business, nonprofit, quilter/reduced-rate, or assistance-reason responses. The dashboard therefore says **“not detected in this extract”** rather than incorrectly claiming those populations do not exist.

## Local setup

```bash
npm install
npm run prepare:data
npm run dev
```

Open `http://localhost:3000`.

## Updating source data

Replace either source file under `data/source/`, then run:

```bash
npm run prepare:data
```

The Python generator is intentionally dependency-free. The uploaded membership workbook is a minimal XLSX package, so the script reads its worksheet XML directly rather than requiring a spreadsheet library.

By default, `dataAsOf` is the date the generator is run. To reproduce a historical snapshot:

```bash
GOCREATE_AS_OF=2026-09-11 npm run prepare:data
```

## Build

```bash
npm run check
npm run build
npm start
```

## PDF export

Open **Koch report**, select the desired reporting range, then choose **Export / print PDF**. The print stylesheet hides the application shell and formats three letter-sized pages. In Chrome/Edge/Safari choose **Save as PDF** in the print destination.

No third-party PDF package is required, which keeps the report faithful to the browser-rendered charts and avoids client-side rasterization.

## Privacy / PII

The bulk analytics payload intentionally excludes exact birthdates, emails, phone numbers, street addresses, emergency-contact values, and medical-alert contents. Member-detail responses are masked by default.

For an authenticated internal deployment only:

```bash
GOCREATE_PII_MODE=full
```

Do **not** enable full PII on an unauthenticated public deployment. Also note that names and operational membership classifications are still present in the analytics payload because the record explorer needs them; production should therefore be access-controlled if those names are not intended for public disclosure.

See `AUDIT.md` for data/reporting decisions and `BUILD-BRIEF.md` for the product rules.
