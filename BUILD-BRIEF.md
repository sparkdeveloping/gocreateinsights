# Advanced GoCreate build brief

Build a premium, high-performance **single-page operational intelligence application for GoCreate** using **Next.js App Router, React, TypeScript, Tailwind CSS, Framer Motion, and Recharts**. The experience should feel less like a static admin dashboard and more like an interactive analytical instrument: every chart is a control, every aggregate can become a filter, and users can move from organization-level patterns to an individual member record without navigating away.

## Product objective

Transform GoCreate membership and visit data into a fast decision surface for staff. The interface should help answer: What is the current membership lifecycle? Which membership groups dominate? Where is observed engagement concentrated? Who is requesting access? What records need data-quality review? Which memberships are approaching expiration? Which individual members make up any chart segment?

## Design language

Use a **strictly light interface** with crisp white surfaces, light neutral page backgrounds, GoCreate blue as the primary action/data color, yellow as a sparing attention color, and black/ink typography. Avoid generic AI-dashboard gradients, glassmorphism, oversized decorative cards, fake futuristic motifs, and dark-mode styling. Motion must communicate state, clickability, hierarchy, filtering, drill-down, or change—not merely decorate the page. Use the official supplied GoCreate logo assets. The dashboard must remain highly legible on large desktop displays while collapsing cleanly for tablet and mobile.

## Interaction model

The application must be one continuous page with anchored sections rather than separate analytics routes. Add a compact navigation rail on large screens and a sticky context/action header. All major filters must update all downstream visuals immediately. Chart segments and KPI cards should be clickable and act as contextual filters. Active filters must be visible and reversible. Use animated layout transitions so cross-filtering feels spatially continuous instead of like a page reload.

## Required analytical modules

Create an executive hero with live scope indicators and source metadata; animated KPI cards for member volume, approved status, engagement, door-access demand, expiration proximity, and data confidence; a global control center with search, status, membership type, data quality, door-access focus, top-N category control, and density control; a switchable lifecycle time-series chart; interactive membership-status bars; a membership-type donut; animated affiliation bars; an engagement scatter field; and a member-level explorer table.

## Drill-down behavior

Clicking a member anywhere in the application must open a Framer Motion side drawer rather than route away. The drawer should progressively reveal contact data, membership lifecycle, access source, activity, affiliation, and data-quality/admin flags. Initial dashboard data should exclude sensitive contact fields; retrieve detailed fields only when the member drawer is opened.

## Data integrity

Do not invent utilization, revenue, age, demographic, or studio metrics when the source does not contain reliable values. Make sparse data visibly honest. Clearly distinguish observed events from total population metrics. Any “expiring soon” logic must be derived from actual expiration dates. All percentages must be computed from the current filtered view.

## Power-user features

Include CSV export of the current filtered population, reversible cross-filtering, animated pagination, responsive charts, reduced-motion support, accessible buttons/labels, loading skeletons, graceful empty states, and a reproducible source-data transformation script. Structure the code so static snapshot JSON can later be swapped for authenticated live APIs without rebuilding the UI architecture.

## Production quality

Keep components typed, avoid unsafe browser-only logic in Server Components, isolate the interactive dashboard behind `use client`, use API routes for detail retrieval, and make the project directly deployable after dependencies are installed. Include documentation that explicitly warns against publicly deploying the supplied member data without authentication and authorization.


## v3 non-negotiable interaction rule
Every visible metric, chart mark, legend item, cohort count, status badge, membership badge, completeness value, ranking row, and member row that implies underlying records must be interactive. Clicking it opens the corresponding cohort explorer, applies/focuses the relevant filter, opens the person detail drawer, or reveals contextual explanation.
