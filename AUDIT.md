# GoCreate Insights — v4 reporting/data audit

## Why v4 exists

Leadership's reporting request was not a request for more generic charts. It asked for a reusable way to answer a specific reporting question over a selectable date window: WSU/WSU Tech, Retail, Quilters/reduced rate, Membership Assistance, small-business references, nonprofit/organization references, and ages/demographics. v4 turns that workflow into a first-class report while keeping the same drill-down system used by the rest of the dashboard.

## Date-range contract

The range control is global and intentionally explicit about which source date each module uses:

- **Membership / Overview / Koch membership counts:** master `membershipSubmittedAt`.
- **Applications / age / home geography / assistance / business/nonprofit/reduced-rate signals:** application `submittedAt`.
- **Application-only people:** application submission date.
- **Engagement:** the uploaded master export does not contain a full history of individual visit events. When a custom range is active, engagement is therefore scoped by each person's `lastVisitAt`; the displayed `visitsInRange` count remains the source-window aggregate. The UI states this limitation instead of presenting a false time-series.
- **All time:** includes undated master records. A custom date range necessarily excludes rows without a reporting date.

## Corrected source mapping

The prior generator used several legacy field names that were not present in the actual CSV. v4 maps the real source columns:

- `membershipSubmittedAt`
- `membershipExpiresAt`
- `lastVisitAt`
- `isEmployee`
- `doorAccessDesired`

After correction, the dataset contains 2,001 master membership-submission timestamps and 79 last-visit timestamps. This correction is material to any date-range report.

## Leadership/Koch report mapping

- **WSU / WSU Tech:** master membership type or student-affiliation text indicating WSU/Wichita State.
- **Retail:** `Public/Regular` master membership type. The report labels this interpretation directly.
- **Membership Assistance:** explicit assistance pathway from the enrichment workbook. Distinct people and application-row counts are shown separately.
- **Quilters / reduced rate:** explicit quilting, reduced-rate, discounted-rate, or scholarship wording in application/enrollment fields.
- **Small business:** explicit small-business, business-owner, entrepreneur/startup, starting-a-business, prototype/product-development, LLC, or business-project wording.
- **Nonprofit / organizations:** explicit Victory in the Valley, 4-H, church/ministry, nonprofit, club, foundation, association/community organization, volunteer, scouts/youth-group wording.
- **Ages:** derived age bands from application birthdate; exact birthdates remain private.

Contact fields, addresses, phone numbers, emails, URLs/source keys and emergency-contact values are excluded from the reference classifier to prevent accidental keyword matches.

## Current-data limitations

The current enrichment workbook has 359 application rows but does not contain the questionnaire fields visible in the older printed reports for “Reason for Membership Assistance Request,” small-business use, nonprofits/clubs/churches, or quilting/reduced-rate reason detail. It has one explicit Membership Assistance row, submitted 2024-07-08.

Therefore, the Sep. 2025-current leadership range legitimately contains zero assistance applications. The report simultaneously surfaces the one older assistance row outside the report scope. Business/nonprofit/quilter zeroes are labeled **not detected in this extract**, not asserted as true population zeroes.

The generator is future-ready: when those questionnaire columns appear in the final workbook, the source scanner classifies them and the UI/report populate automatically.

## Interaction contract

Anything visually presented as actionable must perform a useful action. KPI cards, report metrics, chart marks, donut slices, legends, assistance/reduced-rate indicators, table badges, completeness meters and rows open their underlying cohort, filter context, person detail, or limitation explanation. Decorative motion is avoided; motion communicates state change, drill-down, progress, selection, or clickability.

## PDF/report design

The Koch Report borrows the recognizable structure of GoCreate's prior printed reports—official GoCreate branding, clean white page, blue/yellow accents, chart-led storytelling—but avoids copying their limitations. It is generated from the selected live dashboard scope, is drillable on screen, and prints as a multi-page US Letter report through the browser's native PDF pipeline.

## Security boundary

The source files and private detail JSON are included in this downloadable project for reproducibility. They should not be treated as public assets. Exact contact/address/birthdate/emergency/medical values are excluded from the bulk analytics API; member detail remains masked unless `GOCREATE_PII_MODE=full` is explicitly enabled. For production with real member names, place the site behind access control.
