"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import CountUp from "@/components/count-up";
import ExplorerDrawer, { type ExploreMode } from "@/components/explorer-drawer";
import GoCreateMark from "@/components/gocreate-mark";
import {
  AlertIcon,
  ApplicationsIcon,
  CalendarIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  EngagementIcon,
  EyeIcon,
  FilterIcon,
  InfoIcon,
  LockIcon,
  MembersIcon,
  MembershipIcon,
  OverviewIcon,
  PeopleIcon,
  QualityIcon,
  ReportIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/icons";
import MemberDetailDrawer from "@/components/member-detail-drawer";
import KochReport from "@/components/koch-report";
import { q, visitFrequency } from "@/lib/explore";
import { defaultAllRange, inDateRange, kochRange, last90DaysRange, memberReportingDate, rangeLabel, yearRange, type DateRange } from "@/lib/reporting";
import { formatDate, formatNumber, humanize, pluralize } from "@/lib/format";
import type {
  ApplicationSummary,
  DashboardBootstrap,
  DashboardPayload,
  DashboardTab,
  DistributionPoint,
  ExploreQuery,
  FieldCompleteness,
  ManualVisitEvent,
  ManualVisitPayload,
  MemberSummary,
} from "@/lib/types";

const BLUE = "#0b9de0";
const YELLOW = "#f8c21c";
const INK = "#15191e";
const MUTED = "#7a8591";
const LIGHT_BLUE = "#78ccef";
const SOFT_BLUE = "#d8f1fb";
const PIE_COLORS = [BLUE, INK, YELLOW, "#5ab6dd", "#6b7280", "#a6b0bb", "#c7d1dc", "#e8edf2"];

const tabs: Array<{ id: DashboardTab; label: string; description: string; Icon: typeof OverviewIcon }> = [
  { id: "overview", label: "Overview", description: "What needs attention now", Icon: OverviewIcon },
  { id: "membership", label: "Membership", description: "Status and membership mix", Icon: MembershipIcon },
  { id: "engagement", label: "Engagement", description: "Visits and guest activity", Icon: EngagementIcon },
  { id: "applications", label: "Applications", description: "Application detail and history", Icon: ApplicationsIcon },
  { id: "people", label: "People", description: "Age, location and affiliation", Icon: PeopleIcon },
  { id: "report", label: "Koch report", description: "Leadership reporting and PDF export", Icon: ReportIcon },
  { id: "quality", label: "Data quality", description: "Coverage and missing fields", Icon: QualityIcon },
  { id: "members", label: "Members", description: "Search every person", Icon: MembersIcon },
];

type Props = { bootstrap: DashboardBootstrap };
type FilterState = {
  search: string;
  status: string;
  membershipType: string;
  quality: string;
  source: string;
};

const EMPTY_FILTERS: FilterState = { search: "", status: "all", membershipType: "all", quality: "all", source: "all" };

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function countBy<T>(rows: T[], getValue: (row: T) => string | null | undefined): DistributionPoint[] {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const value = getValue(row) || "Unspecified";
    map.set(value, (map.get(value) ?? 0) + 1);
  });
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function statusColor(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "approved" || normalized === "reportable") return BLUE;
  if (normalized === "pending") return YELLOW;
  if (normalized === "denied" || normalized === "quarantined") return "#d15252";
  if (normalized === "staff") return "#5667c8";
  return MUTED;
}

function LightTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label != null && <strong>{label}</strong>}
      {payload.map((item: any) => (
        <div key={`${item.dataKey}-${item.name}`}><span>{item.name || item.dataKey}</span><b>{typeof item.value === "number" ? formatNumber(item.value) : item.value}</b></div>
      ))}
      <small>Click to explore</small>
    </div>
  );
}

function PageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return (
    <div className="page-intro">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action && <div className="page-intro-action">{action}</div>}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  onClick,
  tone = "blue",
  suffix = "",
  helper,
  formatter,
}: {
  label: string;
  value: number;
  detail: string;
  onClick: () => void;
  tone?: "blue" | "yellow" | "ink" | "red";
  suffix?: string;
  helper?: string;
  formatter?: (value: number) => string;
}) {
  return (
    <motion.button className={`metric-card tone-${tone}`} onClick={onClick} whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} layout>
      <div className="metric-card-top"><span>{label}</span><ArrowUpRightIcon /></div>
      <div className="metric-number"><CountUp value={value} formatter={formatter} />{suffix}</div>
      <div className="metric-detail">{detail}</div>
      {helper && <div className="metric-helper"><EyeIcon />{helper}</div>}
      <motion.div className="metric-hover-line" layoutId={`metric-line-${label}`} />
    </motion.button>
  );
}

function ChartPanel({
  eyebrow,
  title,
  note,
  actionLabel,
  onAction,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("chart-panel", className)}>
      <header className="panel-header">
        <div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{note && <p>{note}</p>}</div>
        {actionLabel && onAction && <button className="panel-action" onClick={onAction}>{actionLabel}<ChevronRightIcon /></button>}
      </header>
      {children}
    </section>
  );
}

function ClickLegend({ data, onClick, max = 7 }: { data: DistributionPoint[]; onClick: (point: DistributionPoint) => void; max?: number }) {
  return (
    <div className="click-legend">
      {data.slice(0, max).map((point, index) => (
        <motion.button key={point.name} onClick={() => onClick(point)} whileHover={{ x: 2 }} className="legend-row">
          <i style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
          <span>{humanize(point.name)}</span>
          <strong>{formatNumber(point.value)}</strong>
          <ChevronRightIcon />
        </motion.button>
      ))}
    </div>
  );
}

function DistributionBar({ data, onClick, height = 300, horizontal = true }: { data: DistributionPoint[]; onClick: (point: DistributionPoint) => void; height?: number; horizontal?: boolean }) {
  return (
    <div style={{ height }} className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 18, bottom: 8, left: horizontal ? 32 : 4 }}>
          <CartesianGrid stroke="#edf0f3" horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#76818d", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ fill: "#4d5661", fontSize: 11 }} tickFormatter={humanize} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#76818d", fontSize: 11 }} tickFormatter={humanize} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#76818d", fontSize: 11 }} />
            </>
          )}
          <Tooltip content={<LightTooltip />} cursor={{ fill: "#f5f8fa" }} />
          <Bar dataKey="value" name="People" radius={horizontal ? [0, 7, 7, 0] : [7, 7, 0, 0]} fill={BLUE} animationDuration={520} onClick={(data: any) => onClick(data)} cursor="pointer" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Donut({ data, onClick, centerLabel, centerValue }: { data: DistributionPoint[]; onClick: (point: DistributionPoint) => void; centerLabel: string; centerValue: number }) {
  return (
    <div className="donut-layout">
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<LightTooltip />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="86%" paddingAngle={2} animationDuration={560} onClick={(data: any) => onClick(data)} cursor="pointer">
              {data.map((point, index) => <Cell key={point.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <button className="donut-center" onClick={() => data[0] && onClick({ name: "All", value: centerValue })}>
          <strong><CountUp value={centerValue} /></strong><span>{centerLabel}</span>
        </button>
      </div>
      <ClickLegend data={data} onClick={onClick} />
    </div>
  );
}

function InsightRow({ title, copy, count, tone = "blue", onClick }: { title: string; copy: string; count: string; tone?: "blue" | "yellow" | "red" | "ink"; onClick: () => void }) {
  return (
    <motion.button className={`insight-row insight-${tone}`} onClick={onClick} whileHover={{ x: 3 }}>
      <div className="insight-icon">{tone === "red" ? <AlertIcon /> : tone === "yellow" ? <InfoIcon /> : <ChevronRightIcon />}</div>
      <div><strong>{title}</strong><span>{copy}</span></div>
      <b>{count}</b>
      <ChevronRightIcon />
    </motion.button>
  );
}

function EmptyData({ children }: { children: React.ReactNode }) {
  return <div className="empty-data"><InfoIcon /><span>{children}</span></div>;
}

function useRows(bootstrap: DashboardBootstrap) {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [manualVisits, setManualVisits] = useState<ManualVisitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Underlying records could not be loaded.");
        return response.json() as Promise<DashboardPayload>;
      })
      .then((payload) => {
        setMembers(payload.members);
        setApplications(payload.applications);
        setManualVisits(payload.manualVisits);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason?.message || "Underlying records could not be loaded.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [bootstrap.meta.generatedAt]);

  return { members, applications, manualVisits, loading, error };
}

function DashboardFilters({
  filters,
  setFilters,
  members,
  resultCount,
  onExplore,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  members: MemberSummary[];
  resultCount: number;
  onExplore: () => void;
}) {
  const statusOptions = useMemo(() => [...new Set(members.filter((m) => m.isMasterMember).map((m) => m.membershipStatus))].sort(), [members]);
  const typeOptions = useMemo(() => [...new Set(members.filter((m) => m.isMasterMember).map((m) => m.membershipType))].sort(), [members]);
  const activeCount = [filters.search, filters.status !== "all", filters.membershipType !== "all", filters.quality !== "all", filters.source !== "all"].filter(Boolean).length;

  return (
    <div className="filter-shell">
      <label className="search-box global-search">
        <SearchIcon />
        <input value={filters.search} onChange={(event: any) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search a name, membership, affiliation or city…" />
        {filters.search && <button aria-label="Clear search" onClick={() => setFilters((current) => ({ ...current, search: "" }))}>×</button>}
      </label>
      <div className="filter-selects soft-scrollbar">
        <label><span>Status</span><select value={filters.status} onChange={(event: any) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">All statuses</option>{statusOptions.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
        <label><span>Membership</span><select value={filters.membershipType} onChange={(event: any) => setFilters((current) => ({ ...current, membershipType: event.target.value }))}><option value="all">All types</option>{typeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>Quality</span><select value={filters.quality} onChange={(event: any) => setFilters((current) => ({ ...current, quality: event.target.value }))}><option value="all">All quality</option><option value="reportable">Reportable</option><option value="quarantined">Quarantined</option></select></label>
        <label><span>Source</span><select value={filters.source} onChange={(event: any) => setFilters((current) => ({ ...current, source: event.target.value }))}><option value="all">All known people</option><option value="master">Master members</option><option value="application-only">Application-only</option></select></label>
      </div>
      <div className="filter-summary">
        <button className="scope-button" onClick={onExplore}><FilterIcon /><span><strong>{formatNumber(resultCount)}</strong> people in scope</span><ChevronRightIcon /></button>
        <AnimatePresence mode="popLayout" initial={false}>
          {activeCount > 0 && <motion.button layout className="clear-button" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} onClick={() => setFilters(EMPTY_FILTERS)}><RefreshIcon />Reset {activeCount}</motion.button>}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DateRangeBar({
  bootstrap,
  range,
  setRange,
  memberCount,
  applicationCount,
}: {
  bootstrap: DashboardBootstrap;
  range: DateRange;
  setRange: React.Dispatch<React.SetStateAction<DateRange>>;
  memberCount: number;
  applicationCount: number;
}) {
  const presets = [
    { id: "all", label: "All time", get: () => defaultAllRange(bootstrap) },
    { id: "koch", label: "Sep 2025 → now", get: () => kochRange(bootstrap) },
    { id: "year", label: `${bootstrap.meta.dataAsOf.slice(0, 4)} YTD`, get: () => yearRange(bootstrap) },
    { id: "90d", label: "Last 90 days", get: () => last90DaysRange(bootstrap) },
  ] as const;

  function updateBoundary(key: "from" | "to", value: string) {
    setRange((current) => {
      const next = { ...current, [key]: value, preset: "custom" as const };
      if (next.from > next.to) {
        if (key === "from") next.to = value;
        else next.from = value;
      }
      return next;
    });
  }

  return (
    <motion.section className="date-range-bar" layout>
      <div className="date-range-title"><CalendarIcon /><div><strong>Reporting range</strong><span>{rangeLabel(range)}</span></div></div>
      <div className="date-presets soft-scrollbar">
        {presets.map((preset) => <button key={preset.id} className={cn("date-preset", range.preset === preset.id && "active")} onClick={() => setRange(preset.get())}>{preset.label}</button>)}
      </div>
      <div className="date-inputs">
        <label><span>From</span><input type="date" value={range.from} max={range.to} onChange={(event: any) => updateBoundary("from", event.target.value)} /></label>
        <span className="date-arrow">→</span>
        <label><span>To</span><input type="date" value={range.to} min={range.from} max={bootstrap.meta.dataAsOf} onChange={(event: any) => updateBoundary("to", event.target.value)} /></label>
      </div>
      <div className="date-scope-summary" title="The selected range is applied to the dashboard">
        <strong>{formatNumber(memberCount)}</strong><span>people</span><i />
        <strong>{formatNumber(applicationCount)}</strong><span>applications</span>
      </div>
    </motion.section>
  );
}

function OverviewTab({
  bootstrap,
  members,
  applications,
  statusData,
  typeData,
  openExplore,
  loading,
  scoped,
}: {
  bootstrap: DashboardBootstrap;
  members: MemberSummary[];
  applications: ApplicationSummary[];
  statusData: DistributionPoint[];
  typeData: DistributionPoint[];
  openExplore: (query: ExploreQuery, mode?: ExploreMode) => void;
  loading: boolean;
  scoped: boolean;
}) {
  const useRows = scoped || members.length > 0;
  const approved = useRows ? members.filter((m) => m.membershipStatus === "approved").length : bootstrap.overview.approvedMembers;
  const engaged = useRows ? members.filter((m) => m.trackerVisits > 0).length : bootstrap.overview.engagedMembers;
  const applicationPeople = useRows ? new Set(applications.map((a) => a.memberId || a.id)).size : bootstrap.meta.distinctEnrichedMembers + bootstrap.meta.unmatchedApplications;
  const applicationRows = useRows ? applications.length : bootstrap.meta.applicationRows;
  const unmatchedApplications = useRows ? applications.filter((a) => !a.isMatchedToMaster).length : bootstrap.meta.unmatchedApplications;
  const observedVisits = useRows ? members.reduce((sum, member) => sum + member.trackerVisits, 0) : bootstrap.overview.trackerVisits;
  const quarantined = useRows ? members.filter((m) => m.dataQualityStatus === "quarantined").length : bootstrap.overview.quarantinedRecords;
  const master = useRows ? members.filter((m) => m.isMasterMember).length : bootstrap.meta.masterRows;

  return (
    <div className="tab-stack">
      <PageIntro eyebrow="Current picture" title="Member intelligence that explains itself" copy="Every number below is a doorway. Select a metric, chart segment, legend row or record to see exactly which people or applications make it up." />
      <div className="metric-grid six">
        <MetricCard label="Master members" value={master} detail="Current member records in the master source" onClick={() => openExplore(q("master", "Master members", "All people represented by the master membership source."))} tone="ink" helper="Open all records" />
        <MetricCard label="Approved members" value={approved} detail="Approved status in the current master source" onClick={() => openExplore(q("membership-status", "Approved members", "People whose master membership status is approved.", "approved"))} helper="See exactly who" />
        <MetricCard label="Tracker-active members" value={engaged} detail={`${formatNumber(observedVisits)} tracker visits in the tracker source window`} onClick={() => openExplore(q("engaged", "Members with observed activity", "People with tracker and/or confidently matched manual activity. Open Engagement for source-aware attendance."))} tone="yellow" helper="Open merged activity" />
        <MetricCard label="Application rows" value={applicationRows} detail={`${formatNumber(applicationPeople)} distinct people represented`} onClick={() => openExplore(q("application-details", "Application records", "Every enriched application row in the uploaded workbook."), "applications")} helper="Open application rows" />
        <MetricCard label="People with app detail" value={applicationPeople} detail="Distinct people with at least one attached application" onClick={() => openExplore(q("application-details", "People with application detail", "Distinct people with an application record attached to their profile."))} tone="ink" helper="Open people" />
        <MetricCard label="Quality attention" value={quarantined} detail="Master records marked quarantined" onClick={() => openExplore(q("data-quality", "Records needing data-quality attention", "Master records currently marked quarantined.", "quarantined"))} tone="red" helper="Review queue" />
      </div>

      <div className="two-column wide-left">
        <ChartPanel eyebrow="Membership" title="Status distribution" note="Click any bar to open the people behind it." actionLabel="Explore all members" onAction={() => openExplore(q("master", "All master members", "Every master member record in the current filtered scope."))}>
          <DistributionBar data={statusData.slice(0, 7)} horizontal onClick={(point) => openExplore(q("membership-status", `${humanize(point.name)} members`, `People whose membership status is ${humanize(point.name).toLowerCase()}.`, point.name))} />
        </ChartPanel>
        <ChartPanel eyebrow="Membership" title="Membership mix" note="A compact overview; the Membership tab goes deeper.">
          <Donut data={typeData.slice(0, 6)} centerLabel="people" centerValue={typeData.reduce((sum, item) => sum + item.value, 0)} onClick={(point) => point.name === "All" ? openExplore(q("master", "All master members", "Every master member in the current scope.")) : openExplore(q("membership-type", point.name, `People with ${point.name} as their master membership type.`, point.name))} />
        </ChartPanel>
      </div>

      <ChartPanel eyebrow="Where to look" title="Three useful next clicks" note={loading ? "Underlying record lists are loading; server-rendered totals are already available." : "These are derived from the current source, not generated recommendations."}>
        <div className="insight-list">
          <InsightRow title="Expired membership records" copy="A large expired population is the fastest way to understand lifecycle shape." count={formatNumber(scoped ? (statusData.find((d) => d.name === "expired")?.value ?? 0) : ((statusData.find((d) => d.name === "expired")?.value ?? bootstrap.membershipStatus.find((d) => d.name === "expired")?.value) || 0))} onClick={() => openExplore(q("membership-status", "Expired membership records", "People whose master membership status is expired.", "expired"))} tone="ink" />
          <InsightRow title="Quarantined source records" copy="These are separated from reportable records so quality work does not get hidden inside totals." count={formatNumber(quarantined)} onClick={() => openExplore(q("data-quality", "Quarantined records", "People marked quarantined in the master source.", "quarantined"))} tone="red" />
          <InsightRow title="Application rows not matched to master" copy="Useful reconciliation queue: the workbook contains an application but no exact email/name master match." count={formatNumber(unmatchedApplications)} onClick={() => openExplore(q("application-match", "Unmatched application rows", "Application records that did not match a master member by exact email or normalized name.", false), "applications")} tone="yellow" />
        </div>
      </ChartPanel>
    </div>
  );
}

function MembershipTab({ bootstrap, members, applications, statusData, typeData, openExplore, scoped }: { bootstrap: DashboardBootstrap; members: MemberSummary[]; applications: ApplicationSummary[]; statusData: DistributionPoint[]; typeData: DistributionPoint[]; openExplore: (query: ExploreQuery, mode?: ExploreMode) => void; scoped: boolean }) {
  const pending = statusData.find((d) => d.name === "pending")?.value ?? 0;
  const expired = statusData.find((d) => d.name === "expired")?.value ?? 0;
  const approved = statusData.find((d) => d.name === "approved")?.value ?? 0;
  const staff = statusData.find((d) => d.name === "staff")?.value ?? 0;
  const assistanceApps = applications.filter((application) => application.assistanceRequested);
  const assistancePeople = new Set(assistanceApps.map((application) => application.memberId || application.id)).size;
  const reducedRateRefs = applications.filter((application) => application.reducedRateReference).length;
  return (
    <div className="tab-stack">
      <PageIntro eyebrow="Membership" title="Understand the lifecycle, then open the people" copy="Status and membership-type charts are fully cross-filterable. Click a count, bar, donut slice or legend line to inspect the matching members." />
      <div className="metric-grid four">
        <MetricCard label="Approved" value={approved} detail="Current approved master status" onClick={() => openExplore(q("membership-status", "Approved members", "Members with approved status.", "approved"))} />
        <MetricCard label="Pending" value={pending} detail="Current pending master status" onClick={() => openExplore(q("membership-status", "Pending members", "Members with pending status.", "pending"))} tone="yellow" />
        <MetricCard label="Expired" value={expired} detail="Current expired master status" onClick={() => openExplore(q("membership-status", "Expired members", "Members with expired status.", "expired"))} tone="ink" />
        <MetricCard label="Staff" value={staff} detail="Staff status in the master source" onClick={() => openExplore(q("staff", "Staff records", "People marked as staff or employee in the available source."))} tone="ink" />
      </div>
      <div className="membership-overlay-strip">
        <button onClick={() => openExplore(q("assistance", "Membership assistance", "Membership-assistance applications inside the selected reporting range."), "applications")}><span className="overlay-dot yellow" /><div><span>Membership assistance</span><strong>{formatNumber(assistancePeople)} people · {formatNumber(assistanceApps.length)} {scoped ? `in range · ${formatNumber(bootstrap.overview.assistanceRequests)} all-time` : `application ${pluralize(assistanceApps.length, "row")}`}</strong></div><ChevronRightIcon /></button>
        <button onClick={() => openExplore(q("reduced-rate-reference", "Quilters / reduced-rate references", "Application rows with explicit quilter or reduced-rate wording."), "applications")}><span className="overlay-dot blue" /><div><span>Quilters / reduced-rate</span><strong>{formatNumber(reducedRateRefs)} in range{scoped ? ` · ${formatNumber(bootstrap.overview.reducedRateReferences)} all-time` : ""}</strong></div><ChevronRightIcon /></button>
        <div className="overlay-explain"><InfoIcon /><span>These application pathways are denoted alongside membership rather than treated as a separate database.</span></div>
      </div>
      <div className="two-column">
        <ChartPanel eyebrow="Status" title="Membership status" note="Horizontal bars preserve full status labels.">
          <DistributionBar data={statusData.slice(0, 8)} onClick={(point) => openExplore(q("membership-status", `${humanize(point.name)} members`, `Members with ${humanize(point.name).toLowerCase()} status.`, point.name))} height={340} />
        </ChartPanel>
        <ChartPanel eyebrow="Type" title="Membership type" note="Click a slice or the matching legend row.">
          <Donut data={typeData.slice(0, 7)} centerLabel="members" centerValue={members.length} onClick={(point) => point.name === "All" ? openExplore(q("master", "All master members", "All master members in the current scope.")) : openExplore(q("membership-type", point.name, `Members with ${point.name} as their master membership type.`, point.name))} />
        </ChartPanel>
      </div>
      <ChartPanel eyebrow="Membership types" title="Full ranked comparison" note="This view is deliberately redundant with the donut: the donut explains composition while the bars make exact ranking easier.">
        <DistributionBar data={typeData.slice(0, 12)} onClick={(point) => openExplore(q("membership-type", point.name, `Members with ${point.name} as their master membership type.`, point.name))} height={390} />
      </ChartPanel>
    </div>
  );
}

function EngagementTab({ bootstrap, members, manualEvents, dateRange, dateScopeActive, openExplore, openMember, scoped }: { bootstrap: DashboardBootstrap; members: MemberSummary[]; manualEvents: ManualVisitEvent[]; dateRange: DateRange; dateScopeActive: boolean; openExplore: (query: ExploreQuery, mode?: ExploreMode) => void; openMember: (id: string) => void; scoped: boolean }) {
  const memberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const trackerStart = bootstrap.meta.trackerCoverageStart;
  const trackerEnd = bootstrap.meta.trackerCoverageEnd;
  const rangeContainsTracker = !dateScopeActive || Boolean(trackerStart && trackerEnd && dateRange.from <= trackerStart && dateRange.to >= trackerEnd);
  const rangeOutsideTracker = Boolean(dateScopeActive && trackerStart && trackerEnd && (dateRange.to < trackerStart || dateRange.from > trackerEnd));
  const trackerDivisible = rangeContainsTracker || rangeOutsideTracker;

  const scopedManual = useMemo(() => manualEvents.filter((event) => {
    if (dateScopeActive && !inDateRange(event.visitDate, dateRange)) return false;
    if (event.classification === "member" && event.memberId && !memberIds.has(event.memberId)) return false;
    return true;
  }), [dateRange, dateScopeActive, manualEvents, memberIds]);

  const trackerVisits = rangeOutsideTracker ? 0 : members.reduce((sum, member) => sum + member.trackerVisits, 0);
  const manualMemberVisits = scopedManual.filter((event) => event.classification === "member").length;
  const manualGuests = scopedManual.filter((event) => event.classification === "guest").length;
  const reviewRows = scopedManual.filter((event) => event.classification === "review").length;
  const unreadableRows = scopedManual.filter((event) => event.classification === "unreadable").length;
  const unknownDateRows = dateScopeActive ? manualEvents.filter((event) => !event.visitDate).length : scopedManual.filter((event) => !event.visitDate).length;
  const possibleExactDuplicates = scopedManual.filter((event) => event.classification === "member" && event.possibleExactTrackerDuplicate).length;
  const combinedMinimum = trackerDivisible ? Math.max(0, trackerVisits + manualMemberVisits - possibleExactDuplicates) : manualMemberVisits;

  const memberManualCounts = useMemo(() => {
    const map = new Map<string, { visits: number; possibleDuplicates: number }>();
    scopedManual.forEach((event) => {
      if (event.classification !== "member" || !event.memberId) return;
      const current = map.get(event.memberId) ?? { visits: 0, possibleDuplicates: 0 };
      current.visits += 1;
      if (event.possibleExactTrackerDuplicate) current.possibleDuplicates += 1;
      map.set(event.memberId, current);
    });
    return map;
  }, [scopedManual]);

  const memberRows = useMemo(() => members.map((member) => {
    if (!dateScopeActive) return { member, manual: member.manualVisits, tracker: member.trackerVisits, combined: member.combinedObservedVisitsMinimum };
    const manualInfo = memberManualCounts.get(member.id) ?? { visits: 0, possibleDuplicates: 0 };
    const tracker = rangeOutsideTracker ? 0 : rangeContainsTracker ? member.trackerVisits : 0;
    return { member, manual: manualInfo.visits, tracker, combined: Math.max(0, manualInfo.visits + tracker - manualInfo.possibleDuplicates) };
  }), [dateScopeActive, memberManualCounts, members, rangeContainsTracker, rangeOutsideTracker]);

  const engaged = memberRows.filter((row) => row.combined > 0);
  const visitData = countBy(memberRows, (row) => visitFrequency(row.combined));
  const orderedBuckets = ["0 visits", "1 visit", "2–4 visits", "5–9 visits", "10+ visits"].map((name) => visitData.find((item) => item.name === name) ?? { name, value: 0 });
  const top = [...engaged].sort((a, b) => b.combined - a.combined).slice(0, 10);
  const datedManual = scopedManual.filter((event) => event.visitDate);
  const byDateMap = new Map<string, { date: string; total: number; members: number; guests: number }>();
  datedManual.forEach((event) => {
    const date = event.visitDate as string;
    const row = byDateMap.get(date) ?? { date, total: 0, members: 0, guests: 0 };
    row.total += 1;
    if (event.classification === "member") row.members += 1;
    if (event.classification === "guest") row.guests += 1;
    byDateMap.set(date, row);
  });
  const timeline = [...byDateMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const trackerDetail = trackerDivisible
    ? `${formatNumber(trackerVisits)} tracker visits ${rangeOutsideTracker ? "(selected dates are outside tracker coverage)" : `across ${formatDate(trackerStart)}–${formatDate(trackerEnd)}`}`
    : `Tracker has ${formatNumber(trackerVisits)} source-window visits, but the selected range cuts through ${formatDate(trackerStart)}–${formatDate(trackerEnd)} and cannot be split exactly`;

  return (
    <div className="tab-stack">
      <PageIntro eyebrow="Engagement" title="One attendance picture from tracker + manual sign-ins" copy="Manual sign-in sheets now fill the period before and around tracker adoption. High-confidence name matches are attached to members; clear nonmatches are guests; uncertain handwriting remains in a review queue instead of being guessed." />

      <div className="source-truth-banner">
        <InfoIcon />
        <div><strong>{trackerDivisible ? "This range can be totaled without inventing tracker dates." : "This range partially overlaps the tracker aggregate."}</strong><span>{trackerDetail}. {dateScopeActive ? `${formatNumber(unknownDateRows)} manual rows have no trustworthy date and are excluded from this custom range.` : `${formatNumber(unknownDateRows)} manual rows have no trustworthy date but remain visible in all-time totals.`}</span></div>
      </div>

      <div className="metric-grid six">
        <MetricCard label="Manual sign-ins" value={scopedManual.length} detail={`${formatNumber(datedManual.length)} dated rows in this view`} onClick={() => openExplore(q("manual-all", "Manual sign-in rows", "Detected rows from the scanned paper sign-in sheets in the current date scope."), "manual")} />
        <MetricCard label="Matched member sign-ins" value={manualMemberVisits} detail="High-confidence manual name matches" onClick={() => openExplore(q("manual-member", "Matched manual member visits", "Manual sign-ins confidently matched to an existing member."), "manual")} tone="blue" />
        <MetricCard label="Guest sign-ins" value={manualGuests} detail="Clear nonmember / nonmatched sign-ins" onClick={() => openExplore(q("manual-guest", "Guest sign-ins", "Manual sign-ins not matched to a current member. Guest handwriting stays private in the browser view."), "manual")} tone="ink" />
        <MetricCard label="Needs review" value={reviewRows + unreadableRows} detail={`${reviewRows} possible matches · ${unreadableRows} unreadable`} onClick={() => openExplore(q("manual-review", "Manual sign-ins needing review", "Rows with a plausible member suggestion that were not auto-linked."), "manual")} tone="yellow" />
        <MetricCard label={trackerDivisible ? "Tracker visits" : "Tracker source-window visits"} value={trackerVisits} detail={trackerDivisible ? "Tracker aggregate contribution for this range" : "Shown for context only; not safely divisible inside this partial tracker window"} onClick={() => openExplore(q("engaged", "Members with tracker/manual activity", "Members contributing observed activity across the available sources."))} tone="ink" />
        <MetricCard label={trackerDivisible ? "Combined member minimum" : "Manual member visits in-range"} value={combinedMinimum} detail={trackerDivisible ? "Tracker + confidently matched manual visits; conservative minimum" : "Tracker portion withheld from the exact in-range total"} onClick={() => openExplore(q("engaged", "Members with observed activity", "Members with tracker and/or confidently matched manual activity."))} tone="yellow" />
      </div>

      <div className="two-column wide-left">
        <ChartPanel eyebrow="Manual timeline" title="Dated paper sign-ins" note="Click any point to open the scanned rows from that date. Unknown-date rows are intentionally not plotted.">
          <div className="chart-wrap" style={{ height: 320 }}>
            {timeline.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={timeline} margin={{ top: 12, right: 16, left: -12, bottom: 8 }}><CartesianGrid stroke="#edf0f3" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#76818d" }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#76818d" }} /><Tooltip content={<LightTooltip />} /><Line type="monotone" dataKey="total" name="Sign-ins" stroke={BLUE} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6, onClick: (_: any, payload: any) => payload?.payload?.date && openExplore(q("manual-date", `Manual sign-ins · ${formatDate(payload.payload.date)}`, "Manual sign-in rows detected on this date.", payload.payload.date), "manual") }} animationDuration={650} /></LineChart></ResponsiveContainer> : <EmptyData>No dated manual sign-ins fall inside this range.</EmptyData>}
          </div>
        </ChartPanel>
        <ChartPanel eyebrow="Reconciliation" title="What happened to each paper row" note="Nothing ambiguous is silently assigned to a member.">
          <div className="insight-list">
            <InsightRow title="Matched to a member" copy="Conservative, high-confidence first/last-name reconciliation." count={formatNumber(manualMemberVisits)} onClick={() => openExplore(q("manual-member", "Matched manual member visits", "High-confidence manual-to-member matches."), "manual")} />
            <InsightRow title="Counted as guests" copy="No sufficiently strong current-member match." count={formatNumber(manualGuests)} onClick={() => openExplore(q("manual-guest", "Guest sign-ins", "Manual sign-ins classified as guests."), "manual")} tone="ink" />
            <InsightRow title="Possible member matches" copy="Suggested match exists, but confidence was not high enough to auto-link." count={formatNumber(reviewRows)} onClick={() => openExplore(q("manual-review", "Possible member matches", "Ambiguous rows held for staff review."), "manual")} tone="yellow" />
            <InsightRow title="Unreadable handwriting" copy="Kept in the source count without inventing a person." count={formatNumber(unreadableRows)} onClick={() => openExplore(q("manual-unreadable", "Unreadable manual rows", "Rows where handwriting could not be reliably interpreted."), "manual")} tone="red" />
          </div>
        </ChartPanel>
      </div>

      <ChartPanel eyebrow="Frequency" title={trackerDivisible ? "Observed member activity minimum" : "Manual member activity in this exact range"} note={trackerDivisible ? "Tracker aggregate plus high-confidence manual matches. Because tracker events are not individually timestamped, this is deliberately labeled as a minimum." : "The tracker aggregate cannot be split across a partial overlap, so this chart uses only dated manual member visits for the exact range."}>
        <DistributionBar data={orderedBuckets} horizontal={false} height={320} onClick={(point) => openExplore(q("visit-frequency", point.name, `Members with ${point.name} across the safely countable activity sources.`, point.name))} />
      </ChartPanel>

      <ChartPanel eyebrow="People" title="Most active members across countable sources" note="Tracker and manual contributions are shown separately. Select any row for full member detail." actionLabel="Open active members" onAction={() => openExplore(q("engaged", "Members with observed activity", "Every member with tracker or confidently matched manual activity."))}>
        <div className="rank-list">
          {top.map(({ member, manual, tracker, combined }, index) => <motion.button key={member.id} className="rank-row" onClick={() => openMember(member.id)} whileHover={{ x: 3 }}><span className="rank-number">{index + 1}</span><div><strong>{member.displayName}</strong><span>{formatNumber(tracker)} tracker · {formatNumber(manual)} manual</span></div><b>{combined} observed min.</b><ChevronRightIcon /></motion.button>)}
          {!top.length && <EmptyData>No member activity can be counted exactly in the current range.</EmptyData>}
        </div>
      </ChartPanel>
    </div>
  );
}

function ApplicationsTab({ bootstrap, applications, openExplore, scoped }: { bootstrap: DashboardBootstrap; applications: ApplicationSummary[]; openExplore: (query: ExploreQuery, mode?: ExploreMode) => void; scoped: boolean }) {
  const useRows = scoped || applications.length > 0;
  const typeData = useRows ? countBy(applications, (a) => a.membershipType) : bootstrap.applicationMembershipType;
  const statusData = useRows ? countBy(applications, (a) => a.applicationStatus) : bootstrap.applicationStatus;
  const model = useRows ? [
    { name: "Granted", value: applications.filter((a) => a.modelReleaseGranted === true).length },
    { name: "Not granted", value: applications.filter((a) => a.modelReleaseGranted === false).length },
  ] : bootstrap.modelRelease;
  const signed = useRows ? applications.filter((a) => a.signaturePresent).length : bootstrap.overview.signedApplications;
  const assistance = useRows ? applications.filter((a) => a.assistanceRequested).length : bootstrap.overview.assistanceRequests;
  const matched = useRows ? applications.filter((a) => a.isMatchedToMaster).length : bootstrap.meta.matchedApplications;
  const matchCoverage = useRows ? (applications.length ? Math.round((matched / applications.length) * 1000) / 10 : 0) : bootstrap.meta.enrichmentCoveragePercent;

  const monthly = useMemo(() => {
    if (!applications.length) return scoped ? [] : bootstrap.submissionTimeline;
    const map = new Map<string, number>();
    applications.forEach((a) => {
      if (!a.submittedAt) return;
      const key = a.submittedAt.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, label: new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" }), value }));
  }, [applications, bootstrap.submissionTimeline, scoped]);

  return (
    <div className="tab-stack">
      <PageIntro eyebrow="Applications" title="Application detail as a real operational layer" copy="Application rows remain separate from people so repeat submissions are preserved as history. Click any metric or chart segment to inspect the exact application rows behind it." />
      <div className="metric-grid six">
        <MetricCard label="Application rows" value={useRows ? applications.length : bootstrap.meta.applicationRows} detail="Rows in the uploaded detail workbook" onClick={() => openExplore(q("application-details", "All application rows", "Every application row in the uploaded workbook."), "applications")} />
        <MetricCard label="Matched to master" value={matched} detail={`${matchCoverage}% of application rows`} onClick={() => openExplore(q("application-match", "Applications matched to master", "Application rows matched to a master member by exact email or normalized name.", true), "applications")} tone="ink" />
        <MetricCard label="Unmatched rows" value={(useRows ? applications.filter((a) => !a.isMatchedToMaster).length : bootstrap.meta.unmatchedApplications)} detail="Reconciliation queue" onClick={() => openExplore(q("application-match", "Unmatched application rows", "Application rows that currently have no exact master-member match.", false), "applications")} tone="yellow" />
        <MetricCard label="Model release granted" value={model.find((m) => m.name === "Granted")?.value ?? 0} detail="Consent field in application rows" onClick={() => openExplore(q("model-release", "Model release granted", "Application rows where model-release permission is granted.", true), "applications")} />
        <MetricCard label="Signed applications" value={signed} detail="Signature-present flag is recorded" onClick={() => openExplore(q("signature", "Signed application rows", "Application rows with a signature-present flag.", true), "applications")} tone="ink" />
        <MetricCard label="Assistance requests" value={assistance} detail={scoped ? `${formatNumber(bootstrap.overview.assistanceRequests)} all-time · questionnaire captured for ${formatNumber(bootstrap.meta.assistanceQuestionnaireApplications)}` : `${formatNumber(bootstrap.meta.assistanceQuestionnaireApplications)} with questionnaire detail`} onClick={() => openExplore(q("assistance", "Membership assistance requests", "Application rows that use the membership-assistance pathway."), "applications")} tone="yellow" />
      </div>

      <div className="two-column wide-left">
        <ChartPanel eyebrow="Requested membership" title="Application membership selection" note="This comes from the application workbook, not the master membership type.">
          <DistributionBar data={typeData.slice(0, 9)} onClick={(point) => openExplore(q("application-type", point.name, `Application rows requesting ${point.name}.`, point.name), "applications")} height={340} />
        </ChartPanel>
        <ChartPanel eyebrow="Consent" title="Model release" note="Select either segment to inspect the application rows.">
          <Donut data={model} centerLabel="applications" centerValue={model.reduce((sum, d) => sum + d.value, 0)} onClick={(point) => point.name === "All" ? openExplore(q("application-details", "All applications", "Every application row."), "applications") : openExplore(q("model-release", `Model release: ${point.name}`, `Application rows with model release ${point.name.toLowerCase()}.`, point.name === "Granted"), "applications")} />
        </ChartPanel>
      </div>

      <ChartPanel eyebrow="Timeline" title="Application submissions over time" note="Select a month to open exactly the applications submitted in that month.">
        <div className="chart-wrap" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 12, right: 18, bottom: 8, left: 0 }} onClick={(state: any) => {
              const label = state?.activeLabel;
              const row = monthly.find((item) => item.label === label);
              if (row) openExplore(q("application-month", `${row.label} applications`, `Application rows submitted during ${row.label}.`, row.month), "applications");
            }}>
              <CartesianGrid stroke="#edf0f3" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#76818d", fontSize: 10 }} minTickGap={28} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#76818d", fontSize: 11 }} />
              <Tooltip content={<LightTooltip />} />
              <Line type="monotone" dataKey="value" name="Applications" stroke={BLUE} strokeWidth={3} dot={{ r: 3, fill: BLUE }} activeDot={{ r: 6, cursor: "pointer" }} animationDuration={650} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel eyebrow="Portal snapshot" title="Application status field" note="The uploaded workbook currently contains a highly concentrated status snapshot, so this is kept separate from membership status.">
        <DistributionBar data={statusData.slice(0, 8)} horizontal={false} height={260} onClick={(point) => openExplore(q("application-status", point.name, `Application rows with portal status “${point.name}”.`, point.name), "applications")} />
      </ChartPanel>
    </div>
  );
}

function PeopleTab({ bootstrap, members, applications, openExplore, scoped }: { bootstrap: DashboardBootstrap; members: MemberSummary[]; applications: ApplicationSummary[]; openExplore: (query: ExploreQuery, mode?: ExploreMode) => void; scoped: boolean }) {
  const useRows = scoped || applications.length > 0;
  const ageData = useRows ? countBy(applications, (a) => a.ageBand ?? "Unknown") : bootstrap.ageBands;
  const stateData = useRows ? countBy(applications, (a) => a.homeState ?? "Unknown") : bootstrap.homeStates;
  const cityData = useRows ? countBy(applications, (a) => a.homeCity ?? "Unknown") : bootstrap.homeCities;
  const affiliationData = (scoped || members.length) ? countBy(members.filter((m) => m.isMasterMember), (m) => m.studentAffiliation) : bootstrap.studentAffiliation;
  const applicationPeople = useRows ? new Set(applications.map((a) => a.memberId || a.id)).size : bootstrap.meta.distinctEnrichedMembers + bootstrap.meta.unmatchedApplications;
  return (
    <div className="tab-stack">
      <PageIntro eyebrow="People" title="Demographic and location context, without exposing raw PII" copy="Age bands and location aggregates come from the application workbook. Exact birthdates and street-level details never appear in the bulk analytics payload." />
      <div className="metric-grid four">
        <MetricCard label="People with app detail" value={applicationPeople} detail={`Distinct people represented by ${formatNumber(useRows ? applications.length : bootstrap.meta.applicationRows)} application rows`} onClick={() => openExplore(q("application-details", "People with application detail", "Distinct people who have at least one application attached."))} />
        <MetricCard label="WSU / WSU Tech affiliation" value={affiliationData.filter((d) => d.name.toLowerCase().includes("wsu")).reduce((s, d) => s + d.value, 0)} detail="Master student-affiliation labels containing WSU" onClick={() => openExplore(q("wsu-affiliation", "WSU / WSU Tech affiliation", "Members whose student-affiliation label includes WSU."))} tone="ink" helper="Open matching people" />
        <MetricCard label="Wichita application rows" value={cityData.find((d) => d.name === "Wichita")?.value ?? 0} detail="Application rows with Wichita as home city" onClick={() => openExplore(q("home-city", "Wichita applications", "Application rows with Wichita as the normalized home city.", "Wichita"), "applications")} tone="yellow" />
        <MetricCard label="Kansas application rows" value={stateData.find((d) => d.name === "KS")?.value ?? 0} detail="Application rows with KS as home state" onClick={() => openExplore(q("home-state", "Kansas application rows", "Application rows with KS as the normalized home state.", "KS"), "applications")} tone="ink" />
      </div>
      <div className="two-column">
        <ChartPanel eyebrow="Age" title="Age bands from application birthdates" note="Exact birthdates remain private; only bands are used here.">
          <DistributionBar data={ageData} horizontal={false} height={320} onClick={(point) => openExplore(q("age-band", `${point.name} application rows`, `Applications whose derived age band is ${point.name}.`, point.name), "applications")} />
        </ChartPanel>
        <ChartPanel eyebrow="Affiliation" title="Student affiliation" note="This comes from the master member source.">
          <DistributionBar data={affiliationData.slice(0, 8)} height={320} onClick={(point) => openExplore(q("student-affiliation", point.name, `Members with student affiliation “${point.name}”.`, point.name))} />
        </ChartPanel>
      </div>
      <div className="two-column">
        <ChartPanel eyebrow="Location" title="Top home cities" note="Application rows only; street addresses stay private.">
          <DistributionBar data={cityData.slice(0, 12)} height={390} onClick={(point) => openExplore(q("home-city", `${point.name} applications`, `Application rows with normalized home city ${point.name}.`, point.name), "applications")} />
        </ChartPanel>
        <ChartPanel eyebrow="Location" title="Home states" note="Select any state to inspect its application rows.">
          <DistributionBar data={stateData.slice(0, 12)} height={390} onClick={(point) => openExplore(q("home-state", `${point.name} applications`, `Application rows with home state ${point.name}.`, point.name), "applications")} />
        </ChartPanel>
      </div>
    </div>
  );
}

function CompletenessRow({ item, openExplore }: { item: FieldCompleteness; openExplore: (query: ExploreQuery, mode?: ExploreMode) => void }) {
  const canExplore = item.exploreSafe && item.key !== "medical_alerts";
  return (
    <div className="completeness-row">
      <div className="completeness-copy">
        <div><strong>{item.label}</strong><span className={`sensitivity sensitivity-${item.sensitivity}`}>{item.sensitivity}</span></div>
        <span>{formatNumber(item.count)} present · {formatNumber(item.missing)} missing</span>
      </div>
      <div className="completeness-meter" aria-label={`${item.percent}% complete`}><motion.i initial={{ width: 0 }} whileInView={{ width: `${item.percent}%` }} viewport={{ once: true }} transition={{ duration: 0.55 }} /></div>
      <button className="completeness-percent" onClick={() => canExplore ? openExplore(q("field-present", `${item.label}: present`, `Application rows where ${item.label.toLowerCase()} is present.`, true, { field: item.key as any }), "applications") : openExplore(q("privacy-info", `${item.label}: protected aggregate`, "This field is intentionally kept aggregate-only because it can reveal sensitive information.", undefined, { privacyNote: "Sensitive field contents and person-level medical-alert presence are not exposed by the public-safe dashboard." }), "applications")}><strong>{item.percent.toFixed(1)}%</strong><ChevronRightIcon /></button>
      {canExplore && <button className="missing-link" onClick={() => openExplore(q("field-missing", `${item.label}: missing`, `Application rows where ${item.label.toLowerCase()} is missing.`, true, { field: item.key as any }), "applications")}>{item.missing ? `Review ${item.missing} missing` : "No missing rows"}</button>}
    </div>
  );
}

function QualityTab({ bootstrap, members, applications, manualEvents, openExplore, openMember, scoped }: { bootstrap: DashboardBootstrap; members: MemberSummary[]; applications: ApplicationSummary[]; manualEvents: ManualVisitEvent[]; openExplore: (query: ExploreQuery, mode?: ExploreMode) => void; openMember: (id: string) => void; scoped: boolean }) {
  const useRows = scoped || members.length > 0;
  const reportable = useRows ? members.filter((m) => m.dataQualityStatus === "reportable").length : bootstrap.meta.masterRows - bootstrap.overview.quarantinedRecords;
  const quarantined = useRows ? members.filter((m) => m.dataQualityStatus === "quarantined").length : bootstrap.overview.quarantinedRecords;
  const useApplications = scoped || applications.length > 0;
  const matchedApplications = useApplications ? applications.filter((a) => a.isMatchedToMaster).length : bootstrap.meta.matchedApplications;
  const unmatchedApplications = useApplications ? applications.filter((a) => !a.isMatchedToMaster).length : bootstrap.meta.unmatchedApplications;
  const scopedManualRows = manualEvents.length;
  const scopedManualReview = manualEvents.filter((event) => event.classification === "review").length;
  const scopedAssistanceQuestionnaire = applications.filter((application) => application.assistanceQuestionnaireAvailable).length;
  const completeness = scoped ? bootstrap.fieldCompleteness.filter((item) => item.key !== "medical_alerts").map((item) => {
    const fieldKey = item.key as keyof ApplicationSummary["fields"];
    const count = applications.filter((application) => Boolean(application.fields?.[fieldKey])).length;
    const total = applications.length;
    return { ...item, count, missing: total - count, total, percent: total ? Math.round((count / total) * 1000) / 10 : 0 };
  }) : bootstrap.fieldCompleteness;
  return (
    <div className="tab-stack">
      <PageIntro eyebrow="Data quality" title="Coverage that tells you what is missing" copy="Completeness meters are interactive. Select a percentage to see records where the field is present, or use the missing link to open the exact cleanup queue. Sensitive fields stay aggregate-only." />
      <div className="metric-grid four">
        <MetricCard label="Reportable records" value={reportable} detail="Master records currently marked reportable" onClick={() => openExplore(q("data-quality", "Reportable records", "Master records marked reportable.", "reportable"))} />
        <MetricCard label="Quarantined records" value={quarantined} detail="Master records requiring quality attention" onClick={() => openExplore(q("data-quality", "Quarantined records", "Master records marked quarantined.", "quarantined"))} tone="red" />
        <MetricCard label="Matched application rows" value={matchedApplications} detail={useApplications && applications.length ? `${Math.round((matchedApplications / applications.length) * 1000) / 10}% of in-range applications` : `${bootstrap.meta.enrichmentCoveragePercent}% of uploaded applications`} onClick={() => openExplore(q("application-match", "Matched application rows", "Application rows that matched a master member.", true), "applications")} tone="ink" />
        <MetricCard label="Unmatched application rows" value={unmatchedApplications} detail="Application-to-master reconciliation queue" onClick={() => openExplore(q("application-match", "Unmatched application rows", "Application rows that have no exact master match.", false), "applications")} tone="yellow" />
      </div>
      <ChartPanel eyebrow="Source reconciliation" title="What is feeding these numbers" note="Each source keeps its own provenance. Select a source to inspect the records or reconciliation queue behind it.">
        <div className="insight-list">
          <InsightRow title="Manual sign-in archive" copy={`${formatNumber(bootstrap.meta.manualScanPages)} unique source pages · ${scoped ? "Date-scoped" : "All-time"} manual attendance rows`} count={formatNumber(scopedManualRows)} onClick={() => openExplore(q("manual-all", "Manual sign-in archive", "Safely exposed rows extracted from the scanned sign-in archive in the current reporting range."), "manual")} />
          <InsightRow title="Manual match review" copy="Possible member matches are held for review instead of being silently assigned." count={formatNumber(scopedManualReview)} onClick={() => openExplore(q("manual-review", "Manual sign-ins needing match review", "Handwritten sign-ins with a plausible member match that was not strong enough to auto-attach."), "manual")} tone="yellow" />
          <InsightRow title="Assistance questionnaire" copy={`${formatNumber(bootstrap.meta.assistanceQuestionnaireResponses)} raw questionnaire responses are retained server-side across ${formatNumber(bootstrap.meta.assistanceQuestionnaireApplications)} all-time assistance applications`} count={formatNumber(scopedAssistanceQuestionnaire)} onClick={() => openExplore(q("assistance", "Membership assistance questionnaire records", "Membership Assistance applications in the current dashboard scope; questionnaire free text stays private."), "applications")} tone="ink" />
        </div>
      </ChartPanel>
      <ChartPanel eyebrow="Workbook completeness" title={`Field coverage across ${formatNumber(scoped ? applications.length : bootstrap.meta.applicationRows)} application rows`} note={scoped ? "Private field values are not loaded here. Medical-alert presence is omitted from date-scoped completeness because that sensitive field remains aggregate-only." : "Private field values are not loaded into this screen; only presence/missing flags are available for safe drill-down."}>
        <div className="completeness-list">
          {completeness.map((item) => <CompletenessRow key={item.key} item={item} openExplore={openExplore} />)}
        </div>
      </ChartPanel>
      <ChartPanel eyebrow="Reconciliation" title="Application-only people" note="These applications did not match a master member by exact email or normalized name. Select a row to inspect the public-safe person record." actionLabel="Open all unmatched" onAction={() => openExplore(q("application-match", "Unmatched application rows", "All application rows without an exact master match.", false), "applications")}>
        <div className="unmatched-grid">
          {(scoped ? applications.filter((application) => !application.isMatchedToMaster).map((application) => ({ id: application.memberId || application.id, displayName: application.memberName, membershipType: application.membershipType, homeCity: application.homeCity, homeState: application.homeState })) : bootstrap.unmatchedApplications).map((item) => (
            <motion.button key={item.id} className="unmatched-card" onClick={() => openMember(item.id)} whileHover={{ y: -2 }}>
              <div className="member-avatar app">{item.displayName.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}</div>
              <div><strong>{item.displayName}</strong><span>{item.membershipType}</span><small>{[item.homeCity, item.homeState].filter(Boolean).join(", ") || "Location unavailable"}</small></div>
              <ChevronRightIcon />
            </motion.button>
          ))}
        </div>
      </ChartPanel>
      <div className="security-card">
        <div className="security-icon"><LockIcon /></div>
        <div><strong>Public-safe by default</strong><p>The generated client analytics payload excludes exact birthdates, street addresses, contact details, emergency-contact details and medical-alert contents. The member detail route masks private values unless the deployment explicitly enables full PII mode behind access control.</p></div>
      </div>
    </div>
  );
}

function MembersTab({ members, openExplore, openMember }: { members: MemberSummary[]; openExplore: (query: ExploreQuery, mode?: ExploreMode) => void; openMember: (id: string) => void }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"name" | "visits" | "status">("name");
  const pageSize = 25;
  const sorted = useMemo(() => [...members].sort((a, b) => sort === "visits" ? b.combinedObservedVisitsMinimum - a.combinedObservedVisitsMinimum : sort === "status" ? a.membershipStatus.localeCompare(b.membershipStatus) : a.displayName.localeCompare(b.displayName)), [members, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);
  useEffect(() => setPage(0), [members.length, sort]);
  return (
    <div className="tab-stack">
      <PageIntro eyebrow="Members" title="The whole people explorer" copy="Rows open member detail. Status, membership, quality and application badges are also clickable so you can jump from one person into the whole matching cohort." action={<button className="primary-button" onClick={() => openExplore(q("all", "Current people scope", "Every person matching the current dashboard filters."))}><MembersIcon />Open scope explorer</button>} />
      <div className="members-toolbar">
        <button className="members-count" onClick={() => openExplore(q("all", "Current people scope", "Every person matching the current dashboard filters."))}><strong><CountUp value={members.length} /></strong><span>people shown</span><ChevronRightIcon /></button>
        <div className="sort-control"><span>Sort</span><button className={sort === "name" ? "active" : ""} onClick={() => setSort("name")}>Name</button><button className={sort === "visits" ? "active" : ""} onClick={() => setSort("visits")}>Visits</button><button className={sort === "status" ? "active" : ""} onClick={() => setSort("status")}>Status</button></div>
      </div>
      <div className="member-table-shell">
        <div className="member-table-header"><span>Member</span><span>Status</span><span>Membership</span><span>Activity</span><span>Application</span><span /></div>
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((member, index) => (
            <motion.div layout key={member.id} className="member-table-row" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.008, 0.1) }}>
              <button className="table-member" onClick={() => openMember(member.id)}><div className="member-avatar">{member.displayName.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}</div><div><strong>{member.displayName}</strong><span>{member.studentAffiliation}</span></div></button>
              <button className="table-badge" style={{ borderColor: `${statusColor(member.membershipStatus)}55` }} onClick={() => openExplore(q("membership-status", `${humanize(member.membershipStatus)} members`, `Members with ${humanize(member.membershipStatus).toLowerCase()} status.`, member.membershipStatus))}>{humanize(member.membershipStatus)}</button>
              <button className="table-link" onClick={() => openExplore(q("membership-type", member.membershipType, `Members with ${member.membershipType}.`, member.membershipType))}>{member.membershipType}<ChevronRightIcon /></button>
              <button className="activity-cell" onClick={() => member.combinedObservedVisitsMinimum > 0 ? openExplore(q("visit-frequency", visitFrequency(member.combinedObservedVisitsMinimum), `Members with ${visitFrequency(member.combinedObservedVisitsMinimum)} across the countable attendance sources.`, visitFrequency(member.combinedObservedVisitsMinimum))) : openMember(member.id)}><strong>{member.combinedObservedVisitsMinimum}</strong><span>observed min.</span></button>
              {member.hasApplicationDetails ? <button className={cn("app-badge", member.assistanceRequested && "assistance")} onClick={() => member.assistanceRequested ? openExplore(q("assistance", "Membership assistance", "People with a membership-assistance application in the current scope.")) : openExplore(q("application-details", "People with application detail", "People with at least one attached application."))}>{member.assistanceRequested && <span className="assistance-mini-dot" aria-hidden="true" />}{member.assistanceRequested ? "Assistance" : `${member.applicationCount} app${member.applicationCount === 1 ? "" : "s"}`}<ChevronRightIcon /></button> : <button className="quiet-badge" onClick={() => openMember(member.id)}>No app detail</button>}
              <button className="row-open" onClick={() => openMember(member.id)} aria-label={`Open ${member.displayName}`}><ChevronRightIcon /></button>
            </motion.div>
          ))}
        </AnimatePresence>
        {!visible.length && <EmptyData>No people match the current filters.</EmptyData>}
      </div>
      <div className="table-pagination"><span>Page {Math.min(page + 1, pages)} of {pages}</span><div><button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button><button disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</button></div></div>
    </div>
  );
}

export default function Dashboard({ bootstrap }: Props) {
  const reduced = useReducedMotion();
  const { members, applications, manualVisits, loading, error } = useRows(bootstrap);
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [dateRange, setDateRange] = useState<DateRange>(() => defaultAllRange(bootstrap));
  const [explore, setExplore] = useState<{ query: ExploreQuery; mode: ExploreMode } | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  const baseFilteredMembers = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return members.filter((member) => {
      if (filters.source === "master" && !member.isMasterMember) return false;
      if (filters.source === "application-only" && member.isMasterMember) return false;
      if (filters.status !== "all" && member.membershipStatus !== filters.status) return false;
      if (filters.membershipType !== "all" && member.membershipType !== filters.membershipType) return false;
      if (filters.quality !== "all" && member.dataQualityStatus !== filters.quality) return false;
      if (needle && !`${member.displayName} ${member.membershipStatus} ${member.membershipType} ${member.studentAffiliation} ${member.homeCity ?? ""} ${member.homeState ?? ""} ${member.applicationMembershipType ?? ""} ${member.smallBusinessLabels.join(" ")} ${member.nonprofitLabels.join(" ")} ${member.reducedRateLabels.join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [filters, members]);

  const baseFilteredApplications = useMemo(() => {
    if (!applications.length) return [];
    const ids = new Set(baseFilteredMembers.map((member) => member.id));
    return applications.filter((app) => app.memberId && ids.has(app.memberId));
  }, [applications, baseFilteredMembers]);

  const dateScopeActive = dateRange.preset !== "all";
  const filteredMembers = useMemo(() => {
    if (!dateScopeActive) return baseFilteredMembers;
    return baseFilteredMembers.filter((member) => inDateRange(memberReportingDate(member), dateRange));
  }, [baseFilteredMembers, dateRange, dateScopeActive]);

  const filteredApplications = useMemo(() => {
    if (!dateScopeActive) return baseFilteredApplications;
    return baseFilteredApplications.filter((application) => inDateRange(application.submittedAt, dateRange));
  }, [baseFilteredApplications, dateRange, dateScopeActive]);

  // Engagement uses attendance dates when available. Membership-submission dates must not
  // remove someone who actually visited inside the selected period. Tracker rows remain an
  // aggregate source window and are handled explicitly inside EngagementTab.
  const activityMembers = useMemo(() => baseFilteredMembers.filter((member) => member.isMasterMember), [baseFilteredMembers]);

  const drawerManualVisits = useMemo(() => {
    const events = manualVisits?.events ?? [];
    if (!dateScopeActive) return events;
    return events.filter((event) => inDateRange(event.visitDate, dateRange));
  }, [dateRange, dateScopeActive, manualVisits]);

  const statusData = useMemo(() => members.length ? countBy(filteredMembers.filter((m) => m.isMasterMember), (m) => m.membershipStatus) : bootstrap.membershipStatus, [bootstrap.membershipStatus, filteredMembers, members.length]);
  const typeData = useMemo(() => members.length ? countBy(filteredMembers.filter((m) => m.isMasterMember), (m) => m.membershipType) : bootstrap.membershipType, [bootstrap.membershipType, filteredMembers, members.length]);

  const filterOnlyCount = [filters.search, filters.status !== "all", filters.membershipType !== "all", filters.quality !== "all", filters.source !== "all"].filter(Boolean).length;
  const activeFilterCount = filterOnlyCount + (dateScopeActive ? 1 : 0);
  const scopeCount = members.length ? filteredMembers.length : bootstrap.meta.knownPeople;
  const scopeLabel = `${activeFilterCount ? `${scopeCount.toLocaleString()} people · ${activeFilterCount} active ${pluralize(activeFilterCount, "filter")}` : `All ${scopeCount.toLocaleString()} known people`} · ${rangeLabel(dateRange)}`;

  function openExplore(query: ExploreQuery, mode: ExploreMode = "members") {
    setExplore({ query, mode });
  }

  function switchTab(next: DashboardTab) {
    setTab(next);
    if (next === "report" && dateRange.preset === "all") setDateRange(kochRange(bootstrap));
  }

  function exportCurrentScope() {
    const rows = filteredMembers.length || dateScopeActive || filterOnlyCount ? filteredMembers : members;
    if (!rows.length) return;
    const headers = ["name", "membership_status", "membership_type", "membership_submitted", "application_submitted", "tracker_visits", "matched_manual_visits", "combined_observed_minimum", "hosted_guests_tracker", "student_affiliation", "membership_assistance", "small_business_reference", "nonprofit_reference", "reduced_rate_reference", "data_quality"];
    const escape = (value: unknown) => {
      const raw = String(value ?? "");
      return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };
    const csv = [headers.join(","), ...rows.map((m) => [m.displayName, m.membershipStatus, m.membershipType, m.membershipSubmittedAt, m.applicationSubmittedAt, m.trackerVisits, m.manualVisits, m.combinedObservedVisitsMinimum, m.hostedGuestsInRange, m.studentAffiliation, m.assistanceRequested ? "yes" : "no", m.smallBusinessReference ? "yes" : "no", m.nonprofitReference ? "yes" : "no", m.reducedRateReference ? "yes" : "no", m.dataQualityStatus].map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gocreate-scope-${dateRange.from}-to-${dateRange.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printKochReport() {
    const previousTitle = document.title;
    document.title = `GoCreate Koch Report ${dateRange.from} to ${dateRange.to}`;
    window.print();
    window.setTimeout(() => { document.title = previousTitle; }, 250);
  }

  function showAllAssistance() {
    setFilters(EMPTY_FILTERS);
    setDateRange(defaultAllRange(bootstrap));
    setExplore({ query: q("assistance", "All membership assistance records", "Every membership-assistance application in the uploaded workbook, across all available dates."), mode: "applications" });
  }

  const scopedApplications = applications.length ? filteredApplications : [];
  const tabContent = {
    overview: <OverviewTab bootstrap={bootstrap} members={filteredMembers} applications={scopedApplications} statusData={statusData} typeData={typeData} openExplore={openExplore} loading={loading} scoped={dateScopeActive || filterOnlyCount > 0} />,
    membership: <MembershipTab bootstrap={bootstrap} members={filteredMembers.filter((m) => m.isMasterMember)} applications={scopedApplications} statusData={statusData} typeData={typeData} openExplore={openExplore} scoped={dateScopeActive || filterOnlyCount > 0} />,
    engagement: <EngagementTab bootstrap={bootstrap} members={activityMembers} manualEvents={manualVisits?.events ?? []} dateRange={dateRange} dateScopeActive={dateScopeActive} openExplore={openExplore} openMember={setMemberId} scoped={dateScopeActive || filterOnlyCount > 0} />,
    applications: <ApplicationsTab bootstrap={bootstrap} applications={scopedApplications} openExplore={openExplore} scoped={dateScopeActive || filterOnlyCount > 0} />,
    people: <PeopleTab bootstrap={bootstrap} members={filteredMembers} applications={scopedApplications} openExplore={openExplore} scoped={dateScopeActive || filterOnlyCount > 0} />,
    report: <KochReport bootstrap={bootstrap} members={filteredMembers} applications={scopedApplications} range={dateRange} openExplore={openExplore} onPrint={printKochReport} onShowAllAssistance={showAllAssistance} />,
    quality: <QualityTab bootstrap={bootstrap} members={filteredMembers.filter((m) => m.isMasterMember)} applications={scopedApplications} manualEvents={drawerManualVisits} openExplore={openExplore} openMember={setMemberId} scoped={dateScopeActive || filterOnlyCount > 0} />,
    members: <MembersTab members={filteredMembers} openExplore={openExplore} openMember={setMemberId} />,
  } satisfies Record<DashboardTab, React.ReactNode>;

  return (
    <main className="app-shell">
      <header className="top-header">
        <div className="header-inner">
          <GoCreateMark />
          <div className="header-context"><span>Member intelligence</span><small>Data as of {formatDate(bootstrap.meta.dataAsOf)}</small></div>
          <div className="header-actions">
            {loading ? <span className="sync-state"><i /> Loading records</span> : error ? <span className="sync-state error"><AlertIcon /> Data error</span> : <span className="sync-state ready"><CheckIcon /> Records ready</span>}
            <button className="secondary-button header-report-button" onClick={() => switchTab("report")}><ReportIcon />Koch report</button>
            <button className="secondary-button" onClick={() => switchTab("quality")}><QualityIcon />Data sources</button>
            <button className="primary-button" onClick={exportCurrentScope} disabled={!members.length}><DownloadIcon />Export scope</button>
          </div>
        </div>
      </header>

      <nav className="tab-nav" aria-label="Dashboard sections">
        <div className="tab-nav-inner soft-scrollbar">
          {tabs.map(({ id, label, description, Icon }) => (
            <button key={id} className={cn("top-tab", tab === id && "active")} onClick={() => switchTab(id)} aria-current={tab === id ? "page" : undefined} title={description}>
              <Icon />
              <span>{label}</span>
              {tab === id && <motion.i className="tab-indicator" layoutId="active-tab" transition={{ type: reduced ? "tween" : "spring", stiffness: 420, damping: 34 }} />}
            </button>
          ))}
        </div>
      </nav>

      <div className="dashboard-body">
        <DateRangeBar bootstrap={bootstrap} range={dateRange} setRange={setDateRange} memberCount={filteredMembers.length} applicationCount={filteredApplications.length} />
        <DashboardFilters filters={filters} setFilters={setFilters} members={members} resultCount={scopeCount} onExplore={() => openExplore(q("all", "Current people scope", `Every person matching the current dashboard filters and reporting range (${rangeLabel(dateRange)}).`))} />


        <AnimatePresence initial={false} mode="wait">
          <motion.div key={tab} className="tab-content" initial={{ opacity: 0, y: reduced ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -6 }} transition={{ duration: reduced ? 0.01 : 0.22 }}>
            {tabContent[tab]}
          </motion.div>
        </AnimatePresence>
      </div>

      <ExplorerDrawer
        query={explore?.query ?? null}
        mode={explore?.mode ?? "members"}
        members={filteredMembers}
        applications={filteredApplications}
        manualVisits={drawerManualVisits}
        loading={loading}
        contextLabel={scopeLabel}
        onClose={() => setExplore(null)}
        onMember={(id) => setMemberId(id)}
      />
      <MemberDetailDrawer memberId={memberId} onClose={() => setMemberId(null)} />
    </main>
  );
}
