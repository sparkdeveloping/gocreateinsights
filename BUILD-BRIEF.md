# GoCreate Insights v4 — implementation brief

Build a strictly light-mode, single-page operational intelligence application for GoCreate using Next.js App Router, React, TypeScript, Tailwind CSS, Framer Motion and Recharts. It should feel like a precise staff reporting tool, not a generic “AI dashboard.” Use the official supplied GoCreate brand assets and restrained GoCreate blue/yellow/ink colors.

## Non-negotiable interaction rule

Every visible metric, chart mark, legend item, cohort count, status badge, membership badge, application badge, completeness value, ranking row, report statistic and member row that implies underlying records must be interactive. Clicking it must open the matching cohort, apply/focus the corresponding filter, open member detail, or reveal a clear data-method explanation.

## Global reporting range

Place a persistent reporting-range control above global filters. Provide All time, Sep 2025 → now, current-year YTD, Last 90 days, and exact From/To inputs. Range changes should animate values and charts so the user understands that the scope changed. Preserve custom ranges across tabs. If the user enters Koch Report while still on All time, switch to Sep. 1, 2025 → data-as-of as the leadership default.

Date semantics must remain honest: membership counts use membership submission dates; application/demographic/reference analytics use application submission dates. Do not fabricate historical visit events. If complete visit history is unavailable, explain the engagement limitation beside that view.

## Membership Assistance

Membership Assistance is a pathway within membership/application reporting, not a separate database. Denote it directly on the Membership tab, in application analytics, record explorer rows and member detail. Make assistance counts clickable. Add applicant ages, reason categories when the source provides them, and an explicit note when an assistance record lies outside the chosen range.

## Koch Report

Add a top-level horizontal **Koch report** tab designed for leadership self-service. It must answer:

- WSU / WSU Tech members
- Retail members (`Public/Regular` unless the source supplies a more explicit retail field)
- Quilters / reduced rate
- Membership Assistance
- Small-business references in enrollment information
- Nonprofit/organization references including examples such as Victory in the Valley, 4-H, clubs, churches and organizations
- Age demographics

Each total is clickable. Include membership mix and demographic charts. Use conservative source-text classifiers for business/nonprofit/reduced-rate references; never infer a reference from email addresses, phone/address fields, URLs or contact records.

## Print/PDF output

The report must have a clean, branded screen layout and a dedicated print stylesheet that exports to US Letter through the browser's native print/Save-as-PDF flow. Hide app chrome, filters and drawers during print. Keep charts, GoCreate logo, section titles, date range, data caveats and footers. Use page breaks deliberately and preserve print colors.

## Privacy

Bulk analytics must not expose exact birthdate, street address, phone, email, emergency-contact values, or medical-alert contents. Member details should be masked by default. Full PII may only be enabled explicitly on an authenticated internal deployment.

## Motion

Use motion aggressively only when it teaches the interface: count transitions after range/filter changes, shared tab indicator, drawer transitions, chart entry, layout reflow, progressive bars, hover affordances on clickable regions, row insertion/reordering, and collapsible detail history. Respect `prefers-reduced-motion`.
