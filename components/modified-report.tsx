"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMemo, useState } from "react";
import CountUp from "@/components/count-up";
import { ArrowUpRightIcon, InfoIcon, LockIcon, PrinterIcon, RefreshIcon } from "@/components/icons";
import { DEFAULT_MODIFIED_REPORT, LEGACY_ASSISTANCE_HISTORY } from "@/lib/modified-report";
import { inDateRange, rangeLabel, type DateRange } from "@/lib/reporting";
import { formatNumber } from "@/lib/format";
import type { ApplicationSummary, DashboardBootstrap } from "@/lib/types";

type Props = {
  bootstrap: DashboardBootstrap;
  applications: ApplicationSummary[];
  range: DateRange;
  onPrint: () => void;
};

type DetailKey = "assistance" | "business" | "history" | null;

function deltaLabel(manual: number, source: number | null) {
  if (source == null) return "Loading same-period database comparison…";
  const delta = manual - source;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatNumber(delta)} vs database for this reporting window`;
}

export default function ModifiedReport({ bootstrap, applications, range, onPrint }: Props) {
  const [assistance, setAssistance] = useState<number>(DEFAULT_MODIFIED_REPORT.membershipAssistance);
  const [smallBusinesses, setSmallBusinesses] = useState<number>(DEFAULT_MODIFIED_REPORT.smallBusinesses);
  const [detail, setDetail] = useState<DetailKey>(null);

  const sourceReady = applications.length > 0;
  const periodApplications = useMemo(
    () => applications.filter((application) => inDateRange(application.submittedAt, range)),
    [applications, range],
  );
  const sourceAssistance = sourceReady ? periodApplications.filter((application) => application.assistanceRequested).length : null;
  const sourceBusiness = sourceReady ? periodApplications.filter((application) => application.smallBusinessReference).length : null;
  const sourcePeople = sourceReady ? new Set(periodApplications.map((application) => application.memberId || application.id)).size : null;

  const history = useMemo(
    () => LEGACY_ASSISTANCE_HISTORY.map((row) => ({ ...row, assistanceType: "Legacy reported" })),
    [],
  );

  const reset = () => {
    setAssistance(DEFAULT_MODIFIED_REPORT.membershipAssistance);
    setSmallBusinesses(DEFAULT_MODIFIED_REPORT.smallBusinesses);
  };

  const sourceValue = (value: number | null) => value == null ? "—" : formatNumber(value);

  return (
    <div className="tab-stack modified-report-shell">
      <div className="report-screen-intro no-print">
        <div>
          <span className="eyebrow">Internal reporting</span>
          <h1>Modified Report</h1>
          <p>This staff-only working report is fixed to {rangeLabel(range)}. Every manual adjustment on this page belongs to that reporting window only—not to all-time totals.</p>
        </div>
        <button className="primary-button" onClick={onPrint}><PrinterIcon />Print internal PDF</button>
      </div>

      <div className="internal-integrity-banner no-print">
        <LockIcon />
        <div><strong>Internal / manually adjusted · {rangeLabel(range)}</strong><span>The adjusted figures stay separate from imported source data and the standard Koch Report. They are scoped to this fixed reporting period.</span></div>
      </div>

      <section className="report-page modified-report-page">
        <header className="report-brand-row">
          <Image src="/brand/gocreate/H_GoCreate_Blue_Black_Yellow.svg" alt="GoCreate" width={270} height={86} priority />
          <div><span>INTERNAL MODIFIED REPORT</span><h2>Reporting Period Snapshot</h2><p>{rangeLabel(range)} · staff working copy</p></div>
        </header>

        <div className="report-rule" />
        <div className="modified-report-warning"><LockIcon /><span><strong>Period-specific manual report.</strong> The adjusted values below apply only to {rangeLabel(range)}. They do not represent all-time database totals.</span></div>

        <div className="modified-hero-grid">
          <motion.button className="modified-hero-card blue" onClick={() => setDetail(detail === "assistance" ? null : "assistance")} whileHover={{ y: -3 }} whileTap={{ scale: .99 }}>
            <div><span>Membership assistance</span><b>Adjusted period value</b></div>
            <strong><CountUp value={assistance} /></strong>
            <small>{deltaLabel(assistance, sourceAssistance)}</small>
            <ArrowUpRightIcon />
          </motion.button>
          <motion.button className="modified-hero-card yellow" onClick={() => setDetail(detail === "business" ? null : "business")} whileHover={{ y: -3 }} whileTap={{ scale: .99 }}>
            <div><span>Small businesses</span><b>Adjusted period value</b></div>
            <strong><CountUp value={smallBusinesses} /></strong>
            <small>{deltaLabel(smallBusinesses, sourceBusiness)}</small>
            <ArrowUpRightIcon />
          </motion.button>
          <button className="modified-source-card" onClick={() => setDetail(detail === "assistance" ? null : "assistance")}>
            <span>Database assistance</span><strong>{sourceValue(sourceAssistance)}</strong><small>Same {rangeLabel(range)} window</small>
          </button>
          <button className="modified-source-card" onClick={() => setDetail(detail === "business" ? null : "business")}>
            <span>Database small-business signals</span><strong>{sourceValue(sourceBusiness)}</strong><small>Same {rangeLabel(range)} window</small>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {detail && (
            <motion.div className="modified-detail-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <InfoIcon />
              {detail === "assistance" && <div><strong>Membership Assistance provenance</strong><span><b>{formatNumber(assistance)}</b> is the internal adjusted reporting value for {rangeLabel(range)}. The current database has <b>{sourceValue(sourceAssistance)}</b> Assistance application rows in that same window. The standard Koch Report remains database-derived.</span></div>}
              {detail === "business" && <div><strong>Small-business provenance</strong><span><b>{formatNumber(smallBusinesses)}</b> is the internal adjusted reporting value for {rangeLabel(range)}. The current database detects <b>{sourceValue(sourceBusiness)}</b> small-business references in that same window using the conservative classifier.</span></div>}
              {detail === "history" && <div><strong>Historical source note</strong><span>2020–2025 Assistance, 2024–2025 total members, and 2022–2025 youth-served figures were transcribed from the historical report image supplied with this project. They are reference context only and are not mixed with the {rangeLabel(range)} adjusted figures.</span></div>}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="report-two-column modified-two-column">
          <section className="report-chart-card">
            <div className="report-section-title"><span>Membership Assistance history</span><small>2020–2025 legacy reported context only</small></div>
            <div className="modified-line-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 12, right: 18, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#edf0f3" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#6d7780", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6d7780", fontSize: 11 }} />
                  <Tooltip formatter={(value: any) => [formatNumber(Number(value) || 0), "Assistance"]} labelFormatter={(label: any) => `${label}`} />
                  <Line type="monotone" dataKey="assistance" stroke="#0b9de0" strokeWidth={3} dot={{ r: 5, fill: "#ffffff", strokeWidth: 3 }} activeDot={{ r: 7 }} animationDuration={700} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <button className="modified-history-note" onClick={() => setDetail(detail === "history" ? null : "history")}><InfoIcon /><span>Open historical provenance</span><ArrowUpRightIcon /></button>
          </section>

          <section className="report-chart-card">
            <div className="report-section-title"><span>Reporting bridge</span><small>Adjusted values vs database in the same period</small></div>
            <div className="modified-bridge-list">
              <button onClick={() => setDetail("assistance")}><span>Membership assistance</span><div><b>{sourceValue(sourceAssistance)}</b><i>database period</i></div><ArrowUpRightIcon /><div><b>{formatNumber(assistance)}</b><i>adjusted period</i></div></button>
              <button onClick={() => setDetail("business")}><span>Small businesses</span><div><b>{sourceValue(sourceBusiness)}</b><i>database period</i></div><ArrowUpRightIcon /><div><b>{formatNumber(smallBusinesses)}</b><i>adjusted period</i></div></button>
            </div>
            <div className="modified-context-card"><span>Fixed reporting window</span><strong>{rangeLabel(range)}</strong><small>{sourceReady ? `${formatNumber(periodApplications.length)} application rows · ${formatNumber(sourcePeople ?? 0)} people represented` : "Loading same-period source rows…"}</small></div>
            <div className="modified-context-card"><span>Source context</span><strong>{formatNumber(bootstrap.meta.knownPeople)} known people all-time</strong><small>{formatNumber(bootstrap.meta.applicationRows)} total application rows · data as of {bootstrap.meta.dataAsOf}</small></div>
          </section>
        </div>

        <footer className="report-footer"><span>GoCreate · Internal working report</span><span>Adjusted values apply to {rangeLabel(range)} only</span></footer>
      </section>

      <section className="report-page modified-report-page">
        <header className="report-page-heading"><div><span>LEGACY CONTEXT</span><h2>Prior-year reported figures</h2></div><p>Reference image supplied Sep. 11, 2026</p></header>

        <div className="modified-history-table-wrap">
          <table className="modified-history-table">
            <thead><tr><th>Metric</th>{LEGACY_ASSISTANCE_HISTORY.map((row) => <th key={row.year}>{row.year}</th>)}</tr></thead>
            <tbody>
              <tr><th># using assistance</th>{LEGACY_ASSISTANCE_HISTORY.map((row) => <td key={row.year}><button onClick={() => setDetail("history")}>{formatNumber(row.assistance)}</button></td>)}</tr>
              <tr><th>Total members</th>{LEGACY_ASSISTANCE_HISTORY.map((row) => <td key={row.year}>{row.totalMembers == null ? "—" : formatNumber(row.totalMembers)}</td>)}</tr>
              <tr><th>Youth served</th>{LEGACY_ASSISTANCE_HISTORY.map((row) => <td key={row.year}>{row.youthServed == null ? "—" : formatNumber(row.youthServed)}</td>)}</tr>
            </tbody>
          </table>
        </div>

        <div className="modified-editor no-print">
          <div className="modified-editor-heading"><div><span>Internal adjustment controls</span><strong>Adjust this reporting period without touching the database</strong></div><button onClick={reset}><RefreshIcon />Reset</button></div>
          <div className="modified-editor-grid">
            <label><span>Membership Assistance · {rangeLabel(range)}</span><input type="number" min="0" value={assistance} onChange={(event: any) => setAssistance(Math.max(0, Number(event.target.value) || 0))} /><small>Default adjusted period value: {DEFAULT_MODIFIED_REPORT.membershipAssistance}</small></label>
            <label><span>Small businesses · {rangeLabel(range)}</span><input type="number" min="0" value={smallBusinesses} onChange={(event: any) => setSmallBusinesses(Math.max(0, Number(event.target.value) || 0))} /><small>Default adjusted period value: {DEFAULT_MODIFIED_REPORT.smallBusinesses}</small></label>
          </div>
        </div>

        <div className="modified-disclosure">
          <LockIcon />
          <div><strong>Internal-use disclosure</strong><span>{DEFAULT_MODIFIED_REPORT.provenance} Both manual defaults are defined specifically for {rangeLabel(range)}. Historical figures above came from the supplied legacy-report screenshot. No missing prior-year values were invented. Standard analytics, imports, Koch Report metrics, CSV exports, and member records remain source-derived.</span></div>
        </div>

        <footer className="report-footer"><span>Internal staff working copy · {rangeLabel(range)}</span><span>Adjusted figures are period-specific, not all-time totals</span></footer>
      </section>
    </div>
  );
}
