"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMemo, useState } from "react";
import CountUp from "@/components/count-up";
import { ArrowUpRightIcon, InfoIcon, LockIcon, PrinterIcon, RefreshIcon } from "@/components/icons";
import { DEFAULT_MODIFIED_REPORT, LEGACY_ASSISTANCE_HISTORY } from "@/lib/modified-report";
import { rangeLabel, type DateRange } from "@/lib/reporting";
import { formatNumber } from "@/lib/format";
import type { DashboardBootstrap } from "@/lib/types";

type Props = {
  bootstrap: DashboardBootstrap;
  range: DateRange;
  onPrint: () => void;
};

type DetailKey = "assistance" | "business" | "history" | null;

function deltaLabel(manual: number, source: number) {
  const delta = manual - source;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatNumber(delta)} vs source-derived all-time`;
}

export default function ModifiedReport({ bootstrap, range, onPrint }: Props) {
  const [assistance, setAssistance] = useState<number>(DEFAULT_MODIFIED_REPORT.membershipAssistance);
  const [smallBusinesses, setSmallBusinesses] = useState<number>(DEFAULT_MODIFIED_REPORT.smallBusinesses);
  const [detail, setDetail] = useState<DetailKey>(null);

  const history = useMemo(
    () => [
      ...LEGACY_ASSISTANCE_HISTORY.map((row) => ({ ...row, assistanceType: "Legacy reported" })),
      { year: DEFAULT_MODIFIED_REPORT.reportingYear, assistance, totalMembers: null, youthServed: null, assistanceType: "Manual override" },
    ],
    [assistance],
  );

  const sourceAssistance = bootstrap.overview.assistanceRequests;
  const sourceBusiness = bootstrap.overview.smallBusinessReferences;

  const reset = () => {
    setAssistance(DEFAULT_MODIFIED_REPORT.membershipAssistance);
    setSmallBusinesses(DEFAULT_MODIFIED_REPORT.smallBusinesses);
  };

  return (
    <div className="tab-stack modified-report-shell">
      <div className="report-screen-intro no-print">
        <div>
          <span className="eyebrow">Internal reporting</span>
          <h1>Modified Report</h1>
          <p>Staff-only reporting workspace. Manual figures stay separate from the membership database, imports, standard Koch Report, and source-derived exports.</p>
        </div>
        <button className="primary-button" onClick={onPrint}><PrinterIcon />Print internal PDF</button>
      </div>

      <div className="internal-integrity-banner no-print">
        <LockIcon />
        <div><strong>Internal / manually adjusted</strong><span>The values below are presentation overrides, not database facts. They never write back to imported data.</span></div>
      </div>

      <section className="report-page modified-report-page">
        <header className="report-brand-row">
          <Image src="/brand/gocreate/H_GoCreate_Blue_Black_Yellow.svg" alt="GoCreate" width={270} height={86} priority />
          <div><span>INTERNAL MODIFIED REPORT</span><h2>Annual Reporting Snapshot</h2><p>{DEFAULT_MODIFIED_REPORT.reportingYear} · staff working copy</p></div>
        </header>

        <div className="report-rule" />
        <div className="modified-report-warning"><LockIcon /><span><strong>Manual override report.</strong> This page intentionally does not claim the adjusted figures were calculated from the uploaded database.</span></div>

        <div className="modified-hero-grid">
          <motion.button className="modified-hero-card blue" onClick={() => setDetail(detail === "assistance" ? null : "assistance")} whileHover={{ y: -3 }} whileTap={{ scale: .99 }}>
            <div><span>Membership assistance</span><b>Manual override</b></div>
            <strong><CountUp value={assistance} /></strong>
            <small>{deltaLabel(assistance, sourceAssistance)}</small>
            <ArrowUpRightIcon />
          </motion.button>
          <motion.button className="modified-hero-card yellow" onClick={() => setDetail(detail === "business" ? null : "business")} whileHover={{ y: -3 }} whileTap={{ scale: .99 }}>
            <div><span>Small businesses</span><b>Manual override</b></div>
            <strong><CountUp value={smallBusinesses} /></strong>
            <small>{deltaLabel(smallBusinesses, sourceBusiness)}</small>
            <ArrowUpRightIcon />
          </motion.button>
          <button className="modified-source-card" onClick={() => setDetail(detail === "assistance" ? null : "assistance")}>
            <span>Database assistance</span><strong>{formatNumber(sourceAssistance)}</strong><small>All-time application rows</small>
          </button>
          <button className="modified-source-card" onClick={() => setDetail(detail === "business" ? null : "business")}>
            <span>Database small-business signals</span><strong>{formatNumber(sourceBusiness)}</strong><small>All-time detected references</small>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {detail && (
            <motion.div className="modified-detail-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <InfoIcon />
              {detail === "assistance" && <div><strong>Membership Assistance provenance</strong><span><b>{formatNumber(assistance)}</b> is the internal manual reporting value. The current database contains <b>{formatNumber(sourceAssistance)}</b> assistance application rows all-time. The standard Koch Report continues to use the database figure and selected date range.</span></div>}
              {detail === "business" && <div><strong>Small-business provenance</strong><span><b>{formatNumber(smallBusinesses)}</b> is the internal manual reporting value. The current database detects <b>{formatNumber(sourceBusiness)}</b> all-time application references using the conservative text classifier.</span></div>}
              {detail === "history" && <div><strong>Historical source note</strong><span>2020–2025 assistance, 2024–2025 total members, and 2022–2025 youth-served figures were transcribed from the historical report image supplied in this project. They are treated as legacy reported figures, not recomputed from the current database.</span></div>}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="report-two-column modified-two-column">
          <section className="report-chart-card">
            <div className="report-section-title"><span>Membership Assistance history</span><small>2020–2025 legacy reported · 2026 manually adjusted</small></div>
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
            <div className="report-section-title"><span>Reporting bridge</span><small>Manual presentation vs current database</small></div>
            <div className="modified-bridge-list">
              <button onClick={() => setDetail("assistance")}><span>Membership assistance</span><div><b>{formatNumber(sourceAssistance)}</b><i>database</i></div><ArrowUpRightIcon /><div><b>{formatNumber(assistance)}</b><i>modified</i></div></button>
              <button onClick={() => setDetail("business")}><span>Small businesses</span><div><b>{formatNumber(sourceBusiness)}</b><i>database</i></div><ArrowUpRightIcon /><div><b>{formatNumber(smallBusinesses)}</b><i>modified</i></div></button>
            </div>
            <div className="modified-context-card"><span>Current source context</span><strong>{formatNumber(bootstrap.meta.knownPeople)} known people</strong><small>{formatNumber(bootstrap.meta.applicationRows)} application rows · data as of {bootstrap.meta.dataAsOf}</small></div>
            <div className="modified-context-card"><span>Global dashboard range</span><strong>{rangeLabel(range)}</strong><small>Manual overrides above are fixed and do not recalculate with this date range.</small></div>
          </section>
        </div>

        <footer className="report-footer"><span>GoCreate · Internal working report</span><span>Manual overrides are not source-derived</span></footer>
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
          <div className="modified-editor-heading"><div><span>Internal adjustment controls</span><strong>Change presentation values without touching the database</strong></div><button onClick={reset}><RefreshIcon />Reset</button></div>
          <div className="modified-editor-grid">
            <label><span>Membership Assistance</span><input type="number" min="0" value={assistance} onChange={(event: any) => setAssistance(Math.max(0, Number(event.target.value) || 0))} /><small>Default internal value: {DEFAULT_MODIFIED_REPORT.membershipAssistance}</small></label>
            <label><span>Small businesses</span><input type="number" min="0" value={smallBusinesses} onChange={(event: any) => setSmallBusinesses(Math.max(0, Number(event.target.value) || 0))} /><small>Default internal value: {DEFAULT_MODIFIED_REPORT.smallBusinesses}</small></label>
          </div>
        </div>

        <div className="modified-disclosure">
          <LockIcon />
          <div><strong>Internal-use disclosure</strong><span>{DEFAULT_MODIFIED_REPORT.provenance} The historical figures above came from the supplied legacy-report screenshot. No missing prior-year values were invented. Standard analytics, imports, Koch Report metrics, CSV exports, and member records remain unchanged.</span></div>
        </div>

        <footer className="report-footer"><span>Internal staff working copy</span><span>Do not present manual values as database-calculated statistics</span></footer>
      </section>
    </div>
  );
}
