"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useMemo } from "react";
import CountUp from "@/components/count-up";
import { ArrowUpRightIcon, BuildingIcon, HeartIcon, InfoIcon, PrinterIcon, TagIcon } from "@/components/icons";
import { latestApplicationsByPerson, rangeLabel, type DateRange } from "@/lib/reporting";
import { q } from "@/lib/explore";
import { formatNumber } from "@/lib/format";
import type { ApplicationSummary, DashboardBootstrap, DistributionPoint, ExploreQuery, MemberSummary } from "@/lib/types";

const COLORS = ["#0b9de0", "#f8c21c", "#15191e", "#6d7780", "#78ccef", "#c6d0d8", "#e3e8ec"];

type ExploreMode = "members" | "applications";

type Props = {
  bootstrap: DashboardBootstrap;
  members: MemberSummary[];
  applications: ApplicationSummary[];
  range: DateRange;
  openExplore: (query: ExploreQuery, mode?: ExploreMode) => void;
  onPrint: () => void;
  onShowAllAssistance: () => void;
};

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value || "Unknown", (counts.get(value || "Unknown") || 0) + 1));
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function ReportMetric({ label, value, note, tone = "blue", onClick }: { label: string; value: number; note: string; tone?: "blue" | "yellow" | "ink"; onClick: () => void }) {
  return (
    <motion.button className={`report-metric report-metric-${tone}`} onClick={onClick} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
      <div className="report-metric-top"><span>{label}</span><ArrowUpRightIcon /></div>
      <strong><CountUp value={value} /></strong>
      <small>{note}</small>
      <i />
    </motion.button>
  );
}

function ReportDonut({ data, onClick }: { data: DistributionPoint[]; onClick: (point: DistributionPoint) => void }) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  return (
    <div className="report-donut-layout">
      <div className="report-donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="54%" outerRadius="78%" paddingAngle={1.5} animationDuration={650} onClick={(point: any) => onClick(point)} cursor="pointer">
              {data.map((point, index) => <Cell key={point.name} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value: any, name: any) => [formatNumber(Number(value) || 0), name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="report-donut-center"><strong>{formatNumber(total)}</strong><span>enrollments</span></div>
      </div>
      <div className="report-legend">
        {data.map((point, index) => (
          <button key={point.name} onClick={() => onClick(point)}>
            <i style={{ background: COLORS[index % COLORS.length] }} />
            <span>{point.name}</span>
            <b>{formatNumber(point.value)}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function SignalList({ title, icon, rows, empty, onAll, onLabel }: { title: string; icon: React.ReactNode; rows: DistributionPoint[]; empty: string; onAll: () => void; onLabel: (label: string) => void }) {
  return (
    <section className="report-signal-card">
      <button className="report-signal-heading" onClick={onAll}>{icon}<div><strong>{title}</strong><span>{rows.reduce((s, r) => s + r.value, 0)} detected application {rows.reduce((s, r) => s + r.value, 0) === 1 ? "signal" : "signals"}</span></div><ArrowUpRightIcon /></button>
      {rows.length ? <div className="report-signal-list">{rows.map((row) => <button key={row.name} onClick={() => onLabel(row.name)}><span>{row.name}</span><b>{row.value}</b></button>)}</div> : <div className="report-empty"><InfoIcon /><span>{empty}</span></div>}
    </section>
  );
}

export default function KochReport({ bootstrap, members, applications, range, openExplore, onPrint, onShowAllAssistance }: Props) {
  const master = useMemo(() => members.filter((member) => member.isMasterMember), [members]);
  const wsu = useMemo(() => master.filter((member) => `${member.membershipType} ${member.studentAffiliation}`.toLowerCase().includes("wsu") || member.studentAffiliation.toLowerCase().includes("wichita state")), [master]);
  const retail = useMemo(() => master.filter((member) => member.membershipType === "Public/Regular"), [master]);
  const assistanceApps = useMemo(() => applications.filter((app) => app.assistanceRequested), [applications]);
  const assistancePeople = useMemo(() => new Set(assistanceApps.map((app) => app.memberId || app.id)).size, [assistanceApps]);
  const reduced = useMemo(() => applications.filter((app) => app.reducedRateReference), [applications]);
  const business = useMemo(() => applications.filter((app) => app.smallBusinessReference), [applications]);
  const nonprofits = useMemo(() => applications.filter((app) => app.nonprofitReference), [applications]);
  const latestPeopleApps = useMemo(() => latestApplicationsByPerson(applications), [applications]);

  const membershipMix = useMemo(() => countBy(master.map((member) => member.membershipType)).slice(0, 7), [master]);
  const ageBands = useMemo(() => countBy(latestPeopleApps.map((app) => app.ageBand || "Unknown")), [latestPeopleApps]);
  const assistanceReasons = useMemo(() => countBy(assistanceApps.map((app) => app.assistanceReason || "Reason not captured")), [assistanceApps]);
  const businessLabels = useMemo(() => countBy(business.flatMap((app) => app.smallBusinessLabels)), [business]);
  const nonprofitLabels = useMemo(() => countBy(nonprofits.flatMap((app) => app.nonprofitLabels)), [nonprofits]);
  const reducedLabels = useMemo(() => countBy(reduced.flatMap((app) => app.reducedRateLabels)), [reduced]);

  const outOfRangeAssistance = Math.max(0, bootstrap.overview.assistanceRequests - assistanceApps.length);

  return (
    <div className="tab-stack koch-report-shell">
      <div className="report-screen-intro no-print">
        <div><span className="eyebrow">Koch reporting</span><h1>One place for the exact questions leadership asks</h1><p>This report uses the global date range. Membership counts are scoped by membership submission date; assistance, demographics and reference signals are scoped by application submission date. Every count can be opened to its underlying records.</p></div>
        <button className="primary-button" onClick={onPrint}><PrinterIcon />Export / print PDF</button>
      </div>

      <section className="report-page report-page-cover">
        <header className="report-brand-row">
          <Image src="/brand/gocreate/H_GoCreate_Blue_Black_Yellow.svg" alt="GoCreate" width={270} height={86} priority />
          <div><span>KOCH REPORT</span><h2>Membership & Enrollment Intelligence</h2><p>{rangeLabel(range)}</p></div>
        </header>

        <div className="report-rule" />
        <div className="report-summary-copy"><strong>Requested reporting view</strong><span>WSU / WSU Tech, retail, quilters / reduced-rate references, membership assistance, small-business references, nonprofits, and age demographics.</span></div>

        <div className="report-metric-grid">
          <ReportMetric label="WSU / WSU Tech" value={wsu.length} note="Membership enrollments in selected range" onClick={() => openExplore(q("koch-wsu", "WSU / WSU Tech members", "Members in the selected reporting range whose type or affiliation indicates WSU / WSU Tech."))} />
          <ReportMetric label="Retail" value={retail.length} note="Public / Regular enrollments" tone="ink" onClick={() => openExplore(q("membership-type", "Retail · Public / Regular", "Public / Regular membership enrollments in the selected reporting range.", "Public/Regular"))} />
          <ReportMetric label="Quilters / reduced rate" value={reduced.length} note="Explicit references detected in enrollment info" tone="yellow" onClick={() => openExplore(q("reduced-rate-reference", "Quilters / reduced-rate references", "Applications containing explicit quilter or reduced-rate language."), "applications")} />
          <ReportMetric label="Membership assistance" value={assistancePeople} note={`${assistanceApps.length} assistance application ${assistanceApps.length === 1 ? "row" : "rows"}`} tone="yellow" onClick={() => openExplore(q("assistance", "Membership assistance", "Applications using the membership-assistance pathway in the selected date range."), "applications")} />
          <ReportMetric label="Small-business references" value={business.length} note="Detected from enrollment/application text fields" onClick={() => openExplore(q("business-reference", "Small-business references", "Application rows with explicit small-business, startup, entrepreneur or prototype signals."), "applications")} />
          <ReportMetric label="Nonprofit references" value={nonprofits.length} note="Named or categorized organization references" tone="ink" onClick={() => openExplore(q("nonprofit-reference", "Nonprofit / organization references", "Application rows with explicit nonprofit, church, club, 4-H, volunteering or organization signals."), "applications")} />
        </div>

        <div className="report-two-column">
          <section className="report-chart-card">
            <div className="report-section-title"><span>Membership mix</span><small>{formatNumber(master.length)} membership enrollments in range</small></div>
            <ReportDonut data={membershipMix} onClick={(point) => openExplore(q("membership-type", point.name, `Membership enrollments in the selected range with type ${point.name}.`, point.name))} />
          </section>
          <section className="report-chart-card">
            <div className="report-section-title"><span>Age demographics</span><small>{formatNumber(latestPeopleApps.length)} distinct people with application detail</small></div>
            <div className="report-age-bars">
              {ageBands.map((row, index) => {
                const max = Math.max(1, ...ageBands.map((v) => v.value));
                return <button key={row.name} onClick={() => openExplore(q("age-band", `${row.name} applicants`, `Applications in the selected reporting range with derived age band ${row.name}.`, row.name), "applications")}><span>{row.name}</span><i><motion.b initial={{ width: 0 }} animate={{ width: `${(row.value / max) * 100}%` }} transition={{ delay: index * .04, duration: .45 }} /></i><strong>{row.value}</strong></button>;
              })}
            </div>
          </section>
        </div>

        <footer className="report-footer"><span>GoCreate · A Koch Collaborative</span><span>Generated from current membership + application extracts</span></footer>
      </section>

      <section className="report-page">
        <header className="report-page-heading"><div><span>MEMBERSHIP ASSISTANCE</span><h2>Assistance is visible inside the same reporting system</h2></div><p>{rangeLabel(range)}</p></header>
        <div className="assistance-banner">
          <div><span>Assistance applicants</span><strong>{formatNumber(assistancePeople)}</strong></div>
          <div><span>Assistance application rows</span><strong>{formatNumber(assistanceApps.length)}</strong></div>
          <div><span>Reason responses available</span><strong>{formatNumber(assistanceApps.filter((a) => a.assistanceReason).length)}</strong></div>
          <button onClick={() => openExplore(q("assistance", "Membership assistance applications", "Every membership-assistance application in the selected range."), "applications")}><span>Open assistance records</span><ArrowUpRightIcon /></button>
        </div>
        {outOfRangeAssistance > 0 && <button className="report-range-note" onClick={onShowAllAssistance}><InfoIcon /><span><strong>{outOfRangeAssistance} assistance row{outOfRangeAssistance === 1 ? " is" : "s are"} outside this report scope.</strong> The current workbook contains {bootstrap.overview.assistanceRequests} total assistance row{bootstrap.overview.assistanceRequests === 1 ? "" : "s"}. Select this notice to clear other filters, expand to all dates, and open the record.</span><ArrowUpRightIcon /></button>}

        <div className="report-two-column">
          <section className="report-chart-card">
            <div className="report-section-title"><span>Reason for assistance request</span><small>Categories appear automatically when the workbook includes a reason field</small></div>
            {assistanceReasons.length && assistanceApps.length ? <div className="report-reason-list">{assistanceReasons.map((row, index) => <button key={row.name} onClick={() => row.name === "Reason not captured" ? openExplore(q("assistance", "Assistance applications without reason detail", "Assistance applications where a reason response is not present in the current extract."), "applications") : openExplore(q("assistance-reason", row.name, `Membership-assistance applications categorized as “${row.name}”.`, row.name), "applications")}><i style={{ background: COLORS[index % COLORS.length] }} /><span>{row.name}</span><strong>{row.value}</strong></button>)}</div> : <div className="report-empty large"><InfoIcon /><div><strong>No assistance reasons are present in the current workbook extract.</strong><span>The report is already wired to categorize the reason field when it is added to the final list, including time-sensitive projects, prototypes, starting a business, and experiencing GoCreate opportunities.</span></div></div>}
          </section>
          <section className="report-chart-card">
            <div className="report-section-title"><span>Assistance applicant ages</span><small>Derived from birthdate; exact birthdates stay private</small></div>
            <div className="report-age-bars compact">
              {countBy(latestApplicationsByPerson(assistanceApps).map((app) => app.ageBand || "Unknown")).map((row, index, arr) => {
                const max = Math.max(1, ...arr.map((v) => v.value));
                return <button key={row.name} onClick={() => openExplore(q("age-band", `${row.name} assistance applicants`, `Assistance applications in age band ${row.name}.`, row.name), "applications")}><span>{row.name}</span><i><motion.b initial={{ width: 0 }} animate={{ width: `${(row.value / max) * 100}%` }} transition={{ delay: index * .04, duration: .45 }} /></i><strong>{row.value}</strong></button>;
              })}
              {!assistanceApps.length && <div className="report-empty"><InfoIcon /><span>No assistance applications fall inside the selected range.</span></div>}
            </div>
          </section>
        </div>

        <footer className="report-footer"><span>Membership assistance is denoted, not siloed</span><span>Change the global range to recalculate</span></footer>
      </section>

      <section className="report-page">
        <header className="report-page-heading"><div><span>ENROLLMENT REFERENCES</span><h2>Business, nonprofit and reduced-rate signals</h2></div><p>{rangeLabel(range)}</p></header>
        <p className="report-method">Reference analytics are conservative: a record is counted only when the uploaded enrollment/application fields contain explicit matching language. Contact fields and source URLs are excluded from the scanner to avoid false positives.</p>
        <div className="report-signal-grid">
          <SignalList title="Small business" icon={<BuildingIcon />} rows={businessLabels} empty="No explicit small-business, entrepreneur, startup or prototype references were detected in the current extract for this range." onAll={() => openExplore(q("business-reference", "Small-business references", "Applications with explicit small-business signals."), "applications")} onLabel={(label) => openExplore(q("business-reference-label", label, `Applications with the “${label}” small-business signal.`, label), "applications")} />
          <SignalList title="Nonprofits / organizations" icon={<HeartIcon />} rows={nonprofitLabels} empty="No explicit nonprofit, Victory in the Valley, 4-H, church, club, foundation or volunteer references were detected in the current extract for this range." onAll={() => openExplore(q("nonprofit-reference", "Nonprofit references", "Applications with explicit nonprofit or organization signals."), "applications")} onLabel={(label) => openExplore(q("nonprofit-reference-label", label, `Applications with the “${label}” nonprofit/organization signal.`, label), "applications")} />
          <SignalList title="Quilters / reduced rate" icon={<TagIcon />} rows={reducedLabels} empty="No explicit quilter, reduced-rate, discounted-rate or scholarship wording was detected in the current extract for this range." onAll={() => openExplore(q("reduced-rate-reference", "Quilters / reduced-rate references", "Applications with explicit quilter or reduced-rate signals."), "applications")} onLabel={(label) => openExplore(q("reduced-rate-reference-label", label, `Applications with the “${label}” reduced-rate signal.`, label), "applications")} />
        </div>
        <div className="report-data-note"><InfoIcon /><div><strong>Current-data limitation</strong><span>The uploaded application workbook does not currently contain the questionnaire fields that would identify most small-business, nonprofit, quilter, or assistance-reason responses. Zero here means “not detected in this extract,” not “none exist.” When those columns are added to the workbook, this report will pick them up without changing the UI.</span></div></div>
        <footer className="report-footer"><span>{formatNumber(applications.length)} application rows evaluated in range</span><span>Exact free-text responses remain private</span></footer>
      </section>
    </div>
  );
}
