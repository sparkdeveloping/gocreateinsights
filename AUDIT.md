# GoCreate Insights — v5.1 data and reporting audit

## Purpose

v5 merges three different operational realities without flattening them into misleading totals:

1. the master membership export,
2. the latest membership/application detail workbook, and
3. historical handwritten sign-in sheets from before/alongside the tracker.

The dashboard keeps provenance visible so staff can answer leadership questions while still knowing which source supports each number.

## Latest enrichment workbook

This audit reflects the Sep. 11, 2026 refreshed workbook (`gocreate_membership_details(2).xlsx` welded into the project under the stable source name `data/source/gocreate_membership_details.xlsx`).

The current detail workbook contains:

- 857 application rows,
- 1,714 emergency-contact rows,
- 40,630 RawControls rows,
- 807 application rows matched to the master source,
- 795 distinct enriched master members,
- 50 application-only people.

### Membership Assistance

The workbook contains 52 Membership Assistance application rows across 51 people. Assistance submissions run from 2024-01-31 through 2025-04-07. Fifty Assistance applications have five captured questionnaire responses, producing 250 raw responses; two additional Assistance application rows do not contain captured questionnaire responses.

This explains the apparent “zero” in the Sep. 2025-current Koch report: there are genuinely **0 Assistance submissions in that selected date range**, not a failed import. v5 shows the selected-range value and the all-time context together, e.g. `0 in range · 52 all-time`, and provides a direct transition to all-time Assistance records.

Questionnaire text is used server-side during data preparation to derive aggregate-safe reason/reference categories. The raw free text is not sent in the client analytics payload.

## Reporting signal definitions

Reference classification is deliberately conservative.

- **Membership Assistance:** explicit Assistance pathway/tab in the application source.
- **Assistance reason:** categorized primarily from the Assistance Q1 response into time-sensitive project, prototype/product development, start/grow a business, quilting/textiles/sewing, community/nonprofit/volunteer, education/student project, learn/create/experience GoCreate, or other/mixed.
- **Small-business reference:** explicit business/startup/entrepreneur/prototype/business-project language in selected enrollment/questionnaire text.
- **Nonprofit/organization reference:** explicit nonprofit, organization, church/ministry, club, volunteer, 4-H, community/foundation/association or similar language.
- **Quilter/reduced-rate reference:** explicit quilting/textile/sewing or reduced/discount/scholarship-type language in the reportable application/questionnaire fields.
- **Age demographics:** age bands derived from birthdate; exact birthdates remain private.

The all-time current workbook yields 9 business-reference applications, 16 nonprofit/organization-reference applications, and 8 reduced-rate/quilter reference applications.

## Date-range contract

The global reporting range does not pretend every source has the same date model:

- **Membership / Overview / Koch membership counts:** master `membershipSubmittedAt`.
- **Applications / demographics / Assistance / reference signals:** application `submittedAt`.
- **Manual attendance:** event date when the handwritten sheet provides a trustworthy date. Unknown-date manual rows are excluded from a bounded date range rather than assigned a fabricated date.
- **Tracker attendance:** the master export supplies aggregate `visitsInRange` by member plus last-visit/source-window context, not the individual visit-event ledger. The observed tracker source window is about 2026-08-03 → 2026-09-09. The dashboard can safely include the tracker total when the selected range fully contains that window, safely exclude it when the range is completely outside the window, and labels partial overlap as not exactly divisible by date.
- **All time:** includes undated records where the source supports them.

## Manual sign-in reconciliation

The scanned archive contains 84 PDFs, of which 2 are exact duplicate scans, leaving 82 unique pages. The current extraction/review layer contains 513 detected rows:

- 14 high-confidence member sign-ins,
- 390 guest sign-ins,
- 27 possible member matches requiring staff review,
- 82 unreadable rows,
- 186 dated rows,
- 327 rows with unknown/unreliable date.

Matching is intentionally conservative. A high-confidence normalized first/last-name match can be attached to a member. A clear nonmatch remains a guest. Ambiguous handwriting never silently becomes a member visit; it remains in the review queue. Unreadable text remains unresolved.

The browser-safe manual payload does not expose raw guest handwriting/names. It keeps source page/row provenance, classification, confidence, and safe matched/suggested member information. The review CSV/source scans are retained in the project for internal reconciliation.

## Combined activity contract

- `trackerVisits` = source tracker aggregate.
- `manualVisits` = high-confidence paper sign-ins attached to that member.
- `combinedObservedVisitsMinimum` = conservative minimum across countable sources, subtracting a possible exact overlap only when the pipeline can identify one.
- Guest sign-ins remain guest activity; they are not converted into member visits merely because a similar name exists.

The current snapshot contains 216 tracker visits plus 14 matched manual member sign-ins, yielding a conservative combined member-visit minimum of 230.

## Interaction contract

Anything presented as an actionable metric must perform a useful action. KPI cards, report metrics, chart marks, legends, Assistance/reduced-rate indicators, source reconciliation cards, rows, badges, completeness meters and ranked items open the underlying cohort, member detail, reconciliation queue or data-method explanation.

Motion is used to explain state change: count transitions, tab/range transitions, drawer entry, chart growth, selected states, list reflow and hover affordances. `prefers-reduced-motion` remains respected.

## PDF/report design

The Koch Report follows GoCreate’s established white-page, blue/yellow, chart-led reporting language while remaining live and drillable on screen. It prints to US Letter using the browser’s native print/PDF pipeline, with app chrome omitted.

## Security boundary

Raw source files and private detail JSON are included in the downloadable project for reproducibility and internal work. They are not public assets. Bulk analytics exclude exact birthdates, street addresses, emails, phones, emergency-contact values, medical-alert contents and Assistance questionnaire free text. Member detail remains masked unless `GOCREATE_PII_MODE=full` is explicitly enabled behind access control.
