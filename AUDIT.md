# GoCreate Insights — product audit and v3 decisions

## Baseline audited

Production URL: `https://gocreateinsights.vercel.app`

The public initial HTML currently exposes only the brand/shell plus “Loading member intelligence”. That means the page communicates almost no analytical value before client hydration. v3 keeps the SPA behavior but makes the information architecture explicit and ensures the dashboard itself has a strong light-mode first frame once data is present.

## Problems addressed

1. **Too much “AI dashboard” styling, not enough operational clarity.** v3 uses plain white surfaces, restrained GoCreate blue/yellow accents, familiar table patterns, compact type, and the official supplied GoCreate logo instead of a generated mark.
2. **Navigation was not explicit enough.** The product uses a sticky horizontal tab bar with full labels and icons: Overview, Membership, Engagement, Applications, People, Data quality, Members.
3. **Metrics looked informational instead of actionable.** Every KPI card opens the exact cohort behind the number. The same interaction pattern is applied to charts, legends, status badges, membership badges, counts, completeness meters, rankings, and member rows.
4. **Drill-down context could be lost.** Cohorts open in an explorer drawer; individual people open in a second detail drawer without leaving the current tab/filter state.
5. **Animation risked becoming decoration.** Motion is tied to state changes: count-up for changing totals; shared-layout tab indicator; chart entrance animation; cohort drawer spring; row/filter layout transitions; hover cues that reveal clickability; completeness progress; and expandable application history.
6. **Workbook detail was underused.** The enrichment workbook now powers aggregate views for application status/type, model release, assistance requests, signature completeness, age bands, home state/city, field completeness, matched/unmatched applications, and application-only people.
7. **Sensitive data needed a safer boundary.** Client analytics use aggregate-safe values and presence flags. Exact contact/address/birthdate/emergency-contact values live in the private detail payload and are masked unless `GOCREATE_PII_MODE=full` is explicitly enabled behind access control.

## Core interaction contract

A visible data object must do one of four things when clicked: open its cohort, focus/filter a view, open a person, or reveal explanatory detail. Decorative motion is avoided. Keyboard focus states and reduced-motion behavior remain supported.

## Future production hardening

Before enabling full PII mode on a public Vercel deployment, place the application behind authenticated authorization, audit access to detail routes, and avoid shipping the source workbook/CSV in a publicly browsable asset path. The source files in this downloadable project are included for reproducibility and regeneration, not because they should be publicly served.
