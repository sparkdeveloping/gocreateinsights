"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMemo, useState, type ReactNode } from "react";
import CountUp from "@/components/count-up";
import { ArrowUpRightIcon, BuildingIcon, HeartIcon, InfoIcon, PrinterIcon, RefreshIcon, TagIcon } from "@/components/icons";
import { DEFAULT_MODIFIED_REPORT, LEGACY_ASSISTANCE_HISTORY } from "@/lib/modified-report";
import { inDateRange, latestApplicationsByPerson, rangeLabel, type DateRange } from "@/lib/reporting";
import { q } from "@/lib/explore";
import { formatDate, formatNumber } from "@/lib/format";
import type { ApplicationSummary, DashboardBootstrap, DistributionPoint, ExploreQuery, ManualVisitEvent, MemberSummary } from "@/lib/types";

const COLORS = ["#0b9de0", "#f8c21c", "#15191e", "#6d7780", "#78ccef", "#c6d0d8", "#e3e8ec"];
type ExploreMode = "members" | "applications" | "manual";
type DetailKey = "assistance" | "business" | "history" | "report" | null;

type Props = {
  bootstrap: DashboardBootstrap;
  members: MemberSummary[];
  applications: ApplicationSummary[];
  manualVisits: ManualVisitEvent[];
  range: DateRange;
  openExplore: (query: ExploreQuery, mode?: ExploreMode) => void;
  onPrint: () => void;
};

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value || "Unknown", (counts.get(value || "Unknown") || 0) + 1));
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function Metric({ label, value, note, tone = "blue", onClick }: { label: string; value: number; note: string; tone?: "blue" | "yellow" | "ink"; onClick: () => void }) {
  return (
    <motion.button className={`report-metric report-metric-${tone}`} onClick={onClick} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
      <div className="report-metric-top"><span>{label}</span><ArrowUpRightIcon /></div>
      <strong><CountUp value={value} /></strong>
      <small>{note}</small>
      <i />
    </motion.button>
  );
}

function Donut({ data, centerLabel, onClick }: { data: DistributionPoint[]; centerLabel: string; onClick: (point: DistributionPoint) => void }) {
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
        <div className="report-donut-center"><strong>{formatNumber(total)}</strong><span>{centerLabel}</span></div>
      </div>
      <div className="report-legend">
        {data.map((point, index) => <button key={point.name} onClick={() => onClick(point)}><i style={{ background: COLORS[index % COLORS.length] }} /><span>{point.name}</span><b>{formatNumber(point.value)}</b></button>)}
      </div>
    </div>
  );
}

function Bars({ rows, onClick, empty = "No records in this reporting window." }: { rows: DistributionPoint[]; onClick: (row: DistributionPoint) => void; empty?: string }) {
  if (!rows.length) return <div className="report-empty"><InfoIcon /><span>{empty}</span></div>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="report-age-bars compact">
      {rows.map((row, index) => <button key={row.name} onClick={() => onClick(row)}><span>{row.name}</span><i><motion.b initial={{ width: 0 }} animate={{ width: `${(row.value / max) * 100}%` }} transition={{ delay: index * .035, duration: .42 }} /></i><strong>{row.value}</strong></button>)}
    </div>
  );
}

function SignalList({ title, icon, rows, total, onAll, onLabel }: { title: string; icon: ReactNode; rows: DistributionPoint[]; total?: number; onAll: () => void; onLabel: (label: string) => void }) {
  const sourceTotal = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <section className="report-signal-card">
      <button className="report-signal-heading" onClick={onAll}>{icon}<div><strong>{title}</strong><span>{formatNumber(total ?? sourceTotal)} in this report</span></div><ArrowUpRightIcon /></button>
      {rows.length ? <div className="report-signal-list">{rows.slice(0, 7).map((row) => <button key={row.name} onClick={() => onLabel(row.name)}><span>{row.name}</span><b>{row.value}</b></button>)}</div> : <div className="report-empty"><InfoIcon /><span>No categorized source detail is available in this reporting window.</span></div>}
    </section>
  );
}

export default function ModifiedReport({ bootstrap, members, applications, manualVisits, range, openExplore, onPrint }: Props) {
  const [assistance, setAssistance] = useState<number>(DEFAULT_MODIFIED_REPORT.membershipAssistance);
  const [smallBusinesses, setSmallBusinesses] = useState<number>(DEFAULT_MODIFIED_REPORT.smallBusinesses);
  const [detail, setDetail] = useState<DetailKey>(null);

  const periodApplications = useMemo(() => applications.filter((application) => inDateRange(application.submittedAt, range)), [applications, range]);
  const periodMembers = useMemo(() => members.filter((member) => member.isMasterMember && inDateRange(member.membershipSubmittedAt, range)), [members, range]);
  const latestPeopleApps = useMemo(() => latestApplicationsByPerson(periodApplications), [periodApplications]);
  const assistanceApps = useMemo(() => periodApplications.filter((app) => app.assistanceRequested), [periodApplications]);
  const reducedApps = useMemo(() => periodApplications.filter((app) => app.reducedRateReference), [periodApplications]);
  const businessApps = useMemo(() => periodApplications.filter((app) => app.smallBusinessReference), [periodApplications]);
  const nonprofitApps = useMemo(() => periodApplications.filter((app) => app.nonprofitReference), [periodApplications]);
  const datedManual = useMemo(() => manualVisits.filter((event) => event.visitDate && inDateRange(event.visitDate, range)), [manualVisits, range]);

  const sourceAssistance = assistanceApps.length;
  const sourceBusiness = businessApps.length;
  const sourcePeople = new Set(periodApplications.map((application) => application.memberId || application.id)).size;
  const matchedApplications = periodApplications.filter((app) => app.isMatchedToMaster).length;
  const signatureCount = periodApplications.filter((app) => app.signaturePresent === true).length;
  const modelReleaseYes = periodApplications.filter((app) => app.modelReleaseGranted === true).length;
  const wsu = periodMembers.filter((member) => `${member.membershipType} ${member.studentAffiliation}`.toLowerCase().includes("wsu") || member.studentAffiliation.toLowerCase().includes("wichita state"));
  const retail = periodMembers.filter((member) => member.membershipType === "Public/Regular");

  const membershipMix = useMemo(() => countBy(periodMembers.map((member) => member.membershipType)).slice(0, 7), [periodMembers]);
  const studentMix = useMemo(() => countBy(periodMembers.map((member) => member.studentAffiliation || "No affiliation")).slice(0, 7), [periodMembers]);
  const ageBands = useMemo(() => countBy(latestPeopleApps.map((app) => app.ageBand || "Unknown")), [latestPeopleApps]);
  const appStatuses = useMemo(() => countBy(periodApplications.flatMap((app) => {
    const raw = app.applicationStatus || "Unknown";
    const lower = raw.toLowerCase();
    if (lower.includes("expired")) return [];
    if (lower.includes("approved")) return ["Approved"];
    if (lower.includes("pending")) return ["Pending"];
    return [raw];
  })).slice(0, 8), [periodApplications]);
  const cities = useMemo(() => countBy(latestPeopleApps.map((app) => app.homeCity || "Unknown")).filter((row) => row.name !== "Unknown").slice(0, 8), [latestPeopleApps]);
  const assistanceReasons = useMemo(() => countBy(assistanceApps.map((app) => app.assistanceReason || "Reason not captured")), [assistanceApps]);
  const assistanceAges = useMemo(() => countBy(latestApplicationsByPerson(assistanceApps).map((app) => app.ageBand || "Unknown")), [assistanceApps]);
  const businessLabels = useMemo(() => countBy(businessApps.flatMap((app) => app.smallBusinessLabels)), [businessApps]);
  const nonprofitLabels = useMemo(() => countBy(nonprofitApps.flatMap((app) => app.nonprofitLabels)), [nonprofitApps]);
  const reducedLabels = useMemo(() => countBy(reducedApps.flatMap((app) => app.reducedRateLabels)), [reducedApps]);

  const manualMembers = datedManual.filter((event) => event.classification === "member").length;
  const manualGuests = datedManual.filter((event) => event.classification === "guest").length;
  const manualReviewRows = datedManual.filter((event) => event.classification === "review").length;
  const manualUnreadable = datedManual.filter((event) => event.classification === "unreadable").length;
  const manualPossibleDuplicates = datedManual.filter((event) => event.classification === "member" && event.possibleExactTrackerDuplicate).length;
  const trackerContained = Boolean(bootstrap.meta.trackerCoverageStart && bootstrap.meta.trackerCoverageEnd && range.from <= bootstrap.meta.trackerCoverageStart! && range.to >= bootstrap.meta.trackerCoverageEnd!);
  const trackerVisits = trackerContained ? members.filter((m) => m.isMasterMember).reduce((sum, member) => sum + member.trackerVisits, 0) : 0;
  const combinedMinimum = Math.max(0, trackerVisits + manualMembers - manualPossibleDuplicates);
  const manualTimeline = useMemo(() => {
    const map = new Map<string, number>();
    datedManual.forEach((event) => map.set(event.visitDate!, (map.get(event.visitDate!) || 0) + 1));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  }, [datedManual]);

  const history = useMemo(() => LEGACY_ASSISTANCE_HISTORY.map((row) => ({ ...row })), []);
  const reset = () => { setAssistance(DEFAULT_MODIFIED_REPORT.membershipAssistance); setSmallBusinesses(DEFAULT_MODIFIED_REPORT.smallBusinesses); };
  const toggleDetail = (key: Exclude<DetailKey, null>) => setDetail((current) => current === key ? null : key);

  return (
    <div className="tab-stack modified-report-shell">
      <div className="report-screen-intro no-print">
        <div>
          <span className="eyebrow">Modified reporting</span>
          <h1>Leadership-ready report with the full analytics layer</h1>
          <p>{rangeLabel(range)} is the fixed reporting window. The report keeps the requested period totals while adding the deeper membership, demographic, enrollment and attendance context from the main analytics system.</p>
        </div>
        <div className="modified-report-actions"><button className="secondary-button" onClick={() => toggleDetail("report")}><InfoIcon />Report details</button><button className="primary-button" onClick={onPrint}><PrinterIcon />Export / print PDF</button></div>
      </div>

      <AnimatePresence initial={false}>
        {detail === "report" && <motion.div className="modified-detail-panel no-print" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><InfoIcon /><div><strong>Report details</strong><span>The Membership Assistance and Small Business period totals can be edited in this workspace. Those edits do not rewrite imports, member records, source analytics, CSV exports or the standard Koch Report. Drill-downs show the source records currently available for the same reporting window.</span></div></motion.div>}
      </AnimatePresence>

      <section className="report-page modified-report-page">
        <header className="report-brand-row">
          <Image src="/brand/gocreate/H_GoCreate_Blue_Black_Yellow.svg" alt="GoCreate" width={270} height={86} priority />
          <div><span>MODIFIED REPORT</span><h2>Membership & Enrollment Intelligence</h2><p>{rangeLabel(range)}</p></div>
        </header>
        <div className="report-rule" />
        <div className="report-summary-copy"><strong>Leadership snapshot</strong><span>Membership, assistance, business and community signals, demographics, application coverage and attendance in one report.</span></div>

        <div className="report-metric-grid">
          <Metric label="WSU / WSU Tech" value={wsu.length} note="Membership enrollments in this reporting window" onClick={() => openExplore(q("koch-wsu", "WSU / WSU Tech members", "Members in the reporting window whose type or affiliation indicates WSU / WSU Tech."))} />
          <Metric label="Retail" value={retail.length} note="Public / Regular membership enrollments" tone="ink" onClick={() => openExplore(q("membership-type", "Retail · Public / Regular", "Public / Regular membership enrollments in this reporting window.", "Public/Regular"))} />
          <Metric label="Quilters / reduced rate" value={reducedApps.length} note="Detected enrollment/application references" tone="yellow" onClick={() => openExplore(q("reduced-rate-reference", "Quilters / reduced-rate references", "Applications containing explicit quilter or reduced-rate language."), "applications")} />
          <Metric label="Membership assistance" value={assistance} note="Report value for this period" tone="yellow" onClick={() => toggleDetail("assistance")} />
          <Metric label="Small businesses" value={smallBusinesses} note="Report value for this period" onClick={() => toggleDetail("business")} />
          <Metric label="Nonprofit / organization" value={nonprofitApps.length} note="Detected application references" tone="ink" onClick={() => openExplore(q("nonprofit-reference", "Nonprofit / organization references", "Applications with nonprofit, church, club, 4-H, volunteering or organization signals."), "applications")} />
        </div>

        <AnimatePresence initial={false}>
          {(detail === "assistance" || detail === "business") && <motion.div className="modified-detail-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><InfoIcon />{detail === "assistance" ? <div><strong>Membership Assistance detail</strong><span><b>{formatNumber(assistance)}</b> is the report value for {rangeLabel(range)}. The current source contains <b>{formatNumber(sourceAssistance)}</b> Assistance application rows in that same period.</span><button className="modified-inline-link" onClick={() => openExplore(q("assistance", "Available membership assistance records", "Membership-assistance application rows available in the current source for this reporting window."), "applications")}>Open available source records <ArrowUpRightIcon /></button></div> : <div><strong>Small Business detail</strong><span><b>{formatNumber(smallBusinesses)}</b> is the report value for {rangeLabel(range)}. The current source classifier detects <b>{formatNumber(sourceBusiness)}</b> application rows in that same period.</span><button className="modified-inline-link" onClick={() => openExplore(q("business-reference", "Available small-business references", "Application rows with small-business signals available in the current source for this reporting window."), "applications")}>Open available source records <ArrowUpRightIcon /></button></div>}</motion.div>}
        </AnimatePresence>

        <div className="report-two-column">
          <section className="report-chart-card"><div className="report-section-title"><span>Membership mix</span><small>{formatNumber(periodMembers.length)} enrollments</small></div><Donut data={membershipMix} centerLabel="enrollments" onClick={(point) => openExplore(q("membership-type", point.name, `Membership enrollments with type ${point.name}.`, point.name))} /></section>
          <section className="report-chart-card"><div className="report-section-title"><span>Age demographics</span><small>{formatNumber(latestPeopleApps.length)} people with application detail</small></div><Bars rows={ageBands} onClick={(row) => openExplore(q("age-band", `${row.name} applicants`, `Applications in age band ${row.name}.`, row.name), "applications")} /></section>
        </div>
        <footer className="report-footer"><span>GoCreate · A Koch Collaborative</span><span>{rangeLabel(range)}</span></footer>
      </section>

      <section className="report-page modified-report-page">
        <header className="report-page-heading"><div><span>MEMBERSHIP ASSISTANCE</span><h2>Assistance profile and questionnaire detail</h2></div><p>{rangeLabel(range)}</p></header>
        <div className="assistance-banner modified-assistance-banner">
          <div><span>Report value</span><strong>{formatNumber(assistance)}</strong></div>
          <div><span>Available application rows</span><strong>{formatNumber(assistanceApps.length)}</strong></div>
          <div><span>Questionnaire reasons captured</span><strong>{formatNumber(assistanceApps.filter((app) => app.assistanceReason).length)}</strong></div>
          <button onClick={() => openExplore(q("assistance", "Membership assistance applications", "Available membership-assistance applications in this reporting window."), "applications")}><span>Open source records</span><ArrowUpRightIcon /></button>
        </div>
        <div className="report-two-column">
          <section className="report-chart-card"><div className="report-section-title"><span>Reason for assistance request</span><small>Available questionnaire detail in this period</small></div>{assistanceReasons.length ? <div className="report-reason-list">{assistanceReasons.map((row, index) => <button key={row.name} onClick={() => row.name === "Reason not captured" ? openExplore(q("assistance", "Assistance applications", "Available assistance applications in this period."), "applications") : openExplore(q("assistance-reason", row.name, `Assistance applications categorized as “${row.name}”.`, row.name), "applications")}><i style={{ background: COLORS[index % COLORS.length] }} /><span>{row.name}</span><strong>{row.value}</strong></button>)}</div> : <div className="report-empty"><InfoIcon /><span>No assistance questionnaire reason detail falls inside this reporting window.</span></div>}</section>
          <section className="report-chart-card"><div className="report-section-title"><span>Assistance applicant ages</span><small>Available age detail</small></div><Bars rows={assistanceAges} onClick={(row) => openExplore(q("age-band", `${row.name} assistance applicants`, `Assistance applications in age band ${row.name}.`, row.name), "applications")} /></section>
        </div>

        <div className="report-signal-grid modified-signal-grid">
          <SignalList title="Small business" icon={<BuildingIcon />} rows={businessLabels} total={smallBusinesses} onAll={() => toggleDetail("business")} onLabel={(label) => openExplore(q("business-reference-label", label, `Applications with the “${label}” small-business signal.`, label), "applications")} />
          <SignalList title="Nonprofits / organizations" icon={<HeartIcon />} rows={nonprofitLabels} onAll={() => openExplore(q("nonprofit-reference", "Nonprofit references", "Applications with nonprofit or organization signals."), "applications")} onLabel={(label) => openExplore(q("nonprofit-reference-label", label, `Applications with the “${label}” nonprofit/organization signal.`, label), "applications")} />
          <SignalList title="Quilters / reduced rate" icon={<TagIcon />} rows={reducedLabels} onAll={() => openExplore(q("reduced-rate-reference", "Quilters / reduced-rate references", "Applications with quilter or reduced-rate signals."), "applications")} onLabel={(label) => openExplore(q("reduced-rate-reference-label", label, `Applications with the “${label}” reduced-rate signal.`, label), "applications")} />
        </div>
        <footer className="report-footer"><span>Questionnaire categories use available application detail</span><span>Exact free text remains private</span></footer>
      </section>

      <section className="report-page modified-report-page">
        <header className="report-page-heading"><div><span>APPLICATION & PEOPLE DETAIL</span><h2>Who is represented and how complete the enrollment picture is</h2></div><p>{rangeLabel(range)}</p></header>
        <div className="report-metric-grid">
          <Metric label="Application rows" value={periodApplications.length} note={`${formatNumber(sourcePeople)} distinct people represented`} onClick={() => openExplore(q("application-details", "Applications in this reporting window", "Every application row in this reporting window."), "applications")} />
          <Metric label="Matched to members" value={matchedApplications} note="Application rows linked to the master member file" tone="ink" onClick={() => openExplore(q("application-match", "Applications matched to members", "Application rows linked to a master membership record.", true), "applications")} />
          <Metric label="Signed applications" value={signatureCount} note="Signature present in available application detail" onClick={() => openExplore(q("signature", "Signed applications", "Applications with a signature present.", true), "applications")} />
          <Metric label="Model release: yes" value={modelReleaseYes} note="Release granted in available application detail" tone="yellow" onClick={() => openExplore(q("model-release", "Model release granted", "Applications where the model release is granted.", true), "applications")} />
          <Metric label="WSU / WSU Tech" value={wsu.length} note="Membership enrollments in period" onClick={() => openExplore(q("koch-wsu", "WSU / WSU Tech members", "Members in this period whose type or affiliation indicates WSU / WSU Tech."))} />
          <Metric label="Retail" value={retail.length} note="Public / Regular enrollments" tone="ink" onClick={() => openExplore(q("membership-type", "Retail · Public / Regular", "Public / Regular membership enrollments in this period.", "Public/Regular"))} />
        </div>
        <div className="report-two-column">
          <section className="report-chart-card"><div className="report-section-title"><span>Application status</span><small>Expired statuses intentionally omitted from presentation</small></div><Bars rows={appStatuses} onClick={(row) => openExplore(q("application-status", row.name, `Applications with status ${row.name}.`, row.name), "applications")} /></section>
          <section className="report-chart-card"><div className="report-section-title"><span>Top home cities</span><small>Derived from the latest application per person</small></div><Bars rows={cities} onClick={(row) => openExplore(q("home-city", row.name, `Applicants reporting ${row.name} as their home city.`, row.name), "applications")} /></section>
        </div>
        <div className="report-two-column">
          <section className="report-chart-card"><div className="report-section-title"><span>Student / institutional affiliation</span><small>Membership records in this reporting window</small></div><Bars rows={studentMix} onClick={(row) => openExplore(q("student-affiliation", row.name, `Members with student/institutional affiliation ${row.name}.`, row.name))} /></section>
          <section className="report-chart-card"><div className="report-section-title"><span>Membership mix</span><small>Enrollment types</small></div><Donut data={membershipMix} centerLabel="enrollments" onClick={(point) => openExplore(q("membership-type", point.name, `Membership enrollments with type ${point.name}.`, point.name))} /></section>
        </div>
        <footer className="report-footer"><span>{formatNumber(periodApplications.length)} application rows · {formatNumber(periodMembers.length)} membership enrollments</span><span>Expired aggregate counts are not presented</span></footer>
      </section>

      <section className="report-page modified-report-page">
        <header className="report-page-heading"><div><span>ATTENDANCE & UTILIZATION</span><h2>Observed activity across tracker and paper sign-ins</h2></div><p>{rangeLabel(range)}</p></header>
        <div className="report-metric-grid">
          <Metric label="Tracker visits" value={trackerVisits} note={trackerContained ? "Tracker source window is fully inside this report period" : "Tracker aggregate cannot be safely split for this range"} onClick={() => openExplore(q("engaged", "Members with observed activity", "Members with tracker and/or confidently matched manual activity."))} />
          <Metric label="Manual sign-ins" value={datedManual.length} note="Dated paper sign-ins in this reporting window" tone="ink" onClick={() => openExplore(q("manual-all", "Manual sign-ins", "Dated manual sign-in rows in this reporting window."), "manual")} />
          <Metric label="Matched member sign-ins" value={manualMembers} note="High-confidence paper-to-member matches" onClick={() => openExplore(q("manual-member", "Matched manual member visits", "Manual sign-ins confidently matched to members."), "manual")} />
          <Metric label="Guest sign-ins" value={manualGuests} note="Paper sign-ins not matched to a member" tone="yellow" onClick={() => openExplore(q("manual-guest", "Guest sign-ins", "Manual sign-ins classified as guests."), "manual")} />
          <Metric label="Needs review" value={manualReviewRows} note={`${formatNumber(manualUnreadable)} additional dated rows are unreadable`} tone="ink" onClick={() => openExplore(q("manual-review", "Manual sign-ins needing review", "Manual sign-ins with a possible member match that was not strong enough to auto-link."), "manual")} />
          <Metric label="Combined member minimum" value={combinedMinimum} note="Tracker + matched paper visits, conservatively deduplicated" tone="yellow" onClick={() => openExplore(q("engaged", "Members with observed activity", "Members contributing observed tracker or manual activity."))} />
        </div>
        <div className="report-two-column modified-two-column">
          <section className="report-chart-card">
            <div className="report-section-title"><span>Manual sign-in timeline</span><small>{formatNumber(datedManual.length)} dated rows</small></div>
            <div className="modified-line-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={manualTimeline} margin={{ top: 12, right: 18, left: 4, bottom: 4 }}><CartesianGrid stroke="#edf0f3" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} axisLine={false} tickLine={false} tick={{ fill: "#6d7780", fontSize: 10 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#6d7780", fontSize: 10 }} /><Tooltip labelFormatter={(value: any) => formatDate(String(value))} formatter={(value: any) => [formatNumber(Number(value) || 0), "Sign-ins"]} /><Line type="monotone" dataKey="value" stroke="#0b9de0" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} animationDuration={650} /></LineChart></ResponsiveContainer></div>
          </section>
          <section className="report-chart-card">
            <div className="report-section-title"><span>Source coverage</span><small>What the current files can support</small></div>
            <div className="modified-context-stack">
              <button className="modified-context-card" onClick={() => openExplore(q("manual-all", "Manual sign-in archive", "Dated manual sign-ins in the current reporting window."), "manual")}><span>Paper attendance</span><strong>{formatNumber(datedManual.length)} dated sign-ins in range</strong><small>{formatNumber(bootstrap.meta.manualUnknownDateRows)} additional manual rows all-time do not have a trustworthy date and are excluded from period totals.</small></button>
              <button className="modified-context-card" onClick={() => openExplore(q("engaged", "Tracker-active members", "Members with tracker activity."))}><span>Tracker coverage</span><strong>{bootstrap.meta.trackerCoverageStart && bootstrap.meta.trackerCoverageEnd ? `${formatDate(bootstrap.meta.trackerCoverageStart)} – ${formatDate(bootstrap.meta.trackerCoverageEnd)}` : "Coverage unavailable"}</strong><small>{trackerContained ? `${formatNumber(trackerVisits)} tracker visits can be included in this report window.` : "The selected range only partially overlaps the tracker aggregate, so no exact tracker period total is asserted."}</small></button>
              <button className="modified-context-card" onClick={() => openExplore(q("manual-review", "Manual match review", "Manual rows held for staff review."), "manual")}><span>Reconciliation</span><strong>{formatNumber(manualReviewRows)} dated rows need review</strong><small>{formatNumber(manualUnreadable)} dated rows are unreadable; ambiguous handwriting is not silently attached to a member.</small></button>
            </div>
          </section>
        </div>
        <footer className="report-footer"><span>Tracker + paper attendance are kept as separate source contributions</span><span>Combined totals remain conservative</span></footer>
      </section>

      <section className="report-page modified-report-page">
        <header className="report-page-heading"><div><span>HISTORICAL CONTEXT</span><h2>Prior-year reported figures</h2></div><p>2020–2025 reference history</p></header>
        <div className="report-two-column modified-two-column">
          <section className="report-chart-card">
            <div className="report-section-title"><span>Membership Assistance history</span><small>Historical reported figures</small></div>
            <div className="modified-line-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{ top: 12, right: 18, left: 4, bottom: 4 }}><CartesianGrid stroke="#edf0f3" vertical={false} /><XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#6d7780", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#6d7780", fontSize: 11 }} /><Tooltip formatter={(value: any) => [formatNumber(Number(value) || 0), "Assistance"]} /><Line type="monotone" dataKey="assistance" stroke="#0b9de0" strokeWidth={3} dot={{ r: 5, fill: "#fff", strokeWidth: 3 }} activeDot={{ r: 7 }} animationDuration={700} /></LineChart></ResponsiveContainer></div>
          </section>
          <section className="report-chart-card">
            <div className="report-section-title"><span>Current report context</span><small>{rangeLabel(range)}</small></div>
            <div className="modified-context-stack">
              <div className="modified-context-card"><span>Membership Assistance</span><strong>{formatNumber(assistance)}</strong><small>Current report value</small></div>
              <div className="modified-context-card"><span>Small businesses</span><strong>{formatNumber(smallBusinesses)}</strong><small>Current report value</small></div>
              <div className="modified-context-card"><span>People represented</span><strong>{formatNumber(sourcePeople)}</strong><small>{formatNumber(periodApplications.length)} application rows in the reporting window</small></div>
            </div>
          </section>
        </div>

        <div className="modified-history-table-wrap">
          <table className="modified-history-table">
            <thead><tr><th>Metric</th>{LEGACY_ASSISTANCE_HISTORY.map((row) => <th key={row.year}>{row.year}</th>)}</tr></thead>
            <tbody>
              <tr><th># using assistance</th>{LEGACY_ASSISTANCE_HISTORY.map((row) => <td key={row.year}><button onClick={() => toggleDetail("history")}>{formatNumber(row.assistance)}</button></td>)}</tr>
              <tr><th>Total members</th>{LEGACY_ASSISTANCE_HISTORY.map((row) => <td key={row.year}>{row.totalMembers == null ? "—" : formatNumber(row.totalMembers)}</td>)}</tr>
              <tr><th>Youth served</th>{LEGACY_ASSISTANCE_HISTORY.map((row) => <td key={row.year}>{row.youthServed == null ? "—" : formatNumber(row.youthServed)}</td>)}</tr>
            </tbody>
          </table>
        </div>

        <AnimatePresence initial={false}>{detail === "history" && <motion.div className="modified-detail-panel no-print" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><InfoIcon /><div><strong>Historical source</strong><span>The 2020–2025 Assistance, 2024–2025 total-member and 2022–2025 youth-served figures were transcribed from the historical report image supplied with the project. Blank cells remain blank where the reference did not provide a number.</span></div></motion.div>}</AnimatePresence>

        <div className="modified-editor no-print">
          <div className="modified-editor-heading"><div><span>Report controls</span><strong>Period totals</strong></div><button onClick={reset}><RefreshIcon />Reset</button></div>
          <div className="modified-editor-grid">
            <label><span>Membership Assistance · {rangeLabel(range)}</span><input type="number" min="0" value={assistance} onChange={(event: any) => setAssistance(Math.max(0, Number(event.target.value) || 0))} /><small>Default: {DEFAULT_MODIFIED_REPORT.membershipAssistance}</small></label>
            <label><span>Small businesses · {rangeLabel(range)}</span><input type="number" min="0" value={smallBusinesses} onChange={(event: any) => setSmallBusinesses(Math.max(0, Number(event.target.value) || 0))} /><small>Default: {DEFAULT_MODIFIED_REPORT.smallBusinesses}</small></label>
          </div>
        </div>
        <footer className="report-footer"><span>GoCreate · Modified report</span><span>{rangeLabel(range)}</span></footer>
      </section>
    </div>
  );
}
