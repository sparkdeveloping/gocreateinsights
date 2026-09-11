# GoCreate Insights v5.1 — implementation brief

Build a strictly light-mode, single-page operational intelligence application for GoCreate using Next.js App Router, React, TypeScript, Tailwind CSS, Framer Motion and Recharts. It must feel like a precise staff reporting tool rather than a generic AI dashboard. Use the supplied official GoCreate assets and restrained blue/yellow/ink colors.

## Non-negotiable interaction rule

Every visible metric, chart mark, legend item, cohort count, status/membership/application badge, activity figure, completeness value, ranking row, report statistic and member row that implies underlying records must be interactive. A click must open the matching cohort, apply/focus the relevant filter, open member detail, open a reconciliation queue, or explain the data limitation.

## Source-aware model

Keep source provenance visible:

- master membership source,
- latest application/detail workbook,
- tracker aggregate attendance source,
- manual handwritten sign-in archive.

Never convert uncertain source information into false precision. Manual high-confidence matches become member visits; clear nonmatches become guests; ambiguous handwriting remains review; unreadable rows remain unresolved. Tracker aggregates must not be fabricated into daily events.

## Global reporting range

Provide All time, Sep 2025 → now, current-year YTD, Last 90 days, and exact From/To. Range changes should animate counts/charts so users understand that scope changed. Preserve custom ranges across tabs. If entering Koch Report from All time, switch to Sep. 1, 2025 → data-as-of.

Date semantics:

- membership counts use membership submission date,
- application/demographic/Assistance/reference analytics use application submission date,
- manual attendance uses event date only where trustworthy,
- tracker totals are only date-divisible when the selected window safely includes/excludes the known tracker source window.

## Membership Assistance

Membership Assistance is a pathway within membership/application reporting, not a separate database. Denote it in Membership, Applications, Members, member detail and Koch Report. Current source truth: 52 Assistance application rows across 51 people, with 250 questionnaire responses across 50 applications, submitted 2024-01-31 through 2025-04-07.

When the selected range is Sep. 2025-current, showing zero is correct but a bare zero is not sufficient. Display `0 in range · 52 all-time`, explain the latest Assistance date, and make the notice clickable to reveal all-time Assistance records.

Questionnaire-derived reason/business/nonprofit/reduced-rate categories may be used for reporting, but raw free text must stay private.

## Engagement

Show tracker, matched manual members, guests, review queue, unreadable/undated limitations, combined minimum activity, manual timeline, frequency and most-active members. Clicking every source metric opens its records. Keep source-level totals separate as well as a conservative combined figure.

## Koch Report

Top-level horizontal tab answering:

- WSU / WSU Tech members,
- Retail / Public-Regular members,
- Quilters / reduced-rate references,
- Membership Assistance,
- small-business references,
- nonprofit/organization references,
- age demographics.

Every number drills down. Show selected-range and all-time context when a category exists outside the selected range. Include membership mix, age views, Assistance reason/age views and reference signal summaries.

## Print/PDF

Provide a branded, clean, multi-page US Letter print layout through the native browser print/Save-as-PDF flow. Hide app chrome/filters/drawers during print. Preserve official logo, report date range, charts, caveats and page footers.

## Privacy

Bulk analytics must not expose exact birthdate, street address, email, phone, emergency-contact values, medical-alert contents, raw Assistance questionnaire text, or raw guest handwritten names. Member details are masked by default. Full PII requires explicit environment configuration on an authenticated internal deployment.

## Motion

Use motion heavily only when it teaches the interface: count changes after filter/range changes, shared tab indicator, drawers, chart entry, hover affordances on clickable regions, list reflow, progress/completeness, collapsible detail and selection feedback. Respect `prefers-reduced-motion`.
