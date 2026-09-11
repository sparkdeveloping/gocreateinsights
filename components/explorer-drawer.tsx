"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import CountUp from "@/components/count-up";
import { CloseIcon, DownloadIcon, SearchIcon, ChevronRightIcon, InfoIcon } from "@/components/icons";
import { applicationMatchesExplore, memberMatchesExplore } from "@/lib/explore";
import { formatDate, humanize } from "@/lib/format";
import type { ApplicationSummary, ExploreQuery, MemberSummary } from "@/lib/types";

type LocalFacet = { kind: "status" | "type"; value: string } | null;

type Props = {
  query: ExploreQuery | null;
  mode: "members" | "applications";
  members: MemberSummary[];
  applications: ApplicationSummary[];
  loading?: boolean;
  contextLabel?: string;
  onClose: () => void;
  onMember: (id: string) => void;
};

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function facetCounts(values: string[]) {
  const map = new Map<string, number>();
  values.forEach((value) => map.set(value || "Unspecified", (map.get(value || "Unspecified") ?? 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export default function ExplorerDrawer({ query, mode, members, applications, loading = false, contextLabel, onClose, onMember }: Props) {
  const reduced = useReducedMotion();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [facet, setFacet] = useState<LocalFacet>(null);
  const pageSize = 18;

  useEffect(() => {
    setSearch("");
    setPage(0);
    setFacet(null);
  }, [query?.id, mode]);

  const matchedMembers = useMemo(() => {
    if (!query || mode !== "members") return [];
    const needle = search.trim().toLowerCase();
    return members.filter((member) => {
      if (!memberMatchesExplore(member, query)) return false;
      if (facet?.kind === "status" && member.membershipStatus !== facet.value) return false;
      if (facet?.kind === "type" && member.membershipType !== facet.value) return false;
      if (needle && !`${member.displayName} ${member.membershipStatus} ${member.membershipType} ${member.studentAffiliation}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [facet, members, mode, query, search]);

  const matchedApplications = useMemo(() => {
    if (!query || mode !== "applications") return [];
    const needle = search.trim().toLowerCase();
    return applications.filter((application) => {
      if (!applicationMatchesExplore(application, query)) return false;
      if (facet?.kind === "status" && application.applicationStatus !== facet.value) return false;
      if (facet?.kind === "type" && application.membershipType !== facet.value) return false;
      if (needle && !`${application.memberName} ${application.membershipType} ${application.applicationStatus} ${application.homeCity ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [applications, facet, mode, query, search]);

  const records = mode === "members" ? matchedMembers : matchedApplications;
  const total = records.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const visible = records.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    if (page >= pages) setPage(Math.max(0, pages - 1));
  }, [page, pages]);

  const statusFacets = useMemo(() => facetCounts(mode === "members" ? matchedMembers.map((m) => humanize(m.membershipStatus)) : matchedApplications.map((a) => a.applicationStatus)), [matchedApplications, matchedMembers, mode]);
  const typeFacets = useMemo(() => facetCounts(mode === "members" ? matchedMembers.map((m) => m.membershipType) : matchedApplications.map((a) => a.membershipType)), [matchedApplications, matchedMembers, mode]);

  function exportRows() {
    if (mode === "members") {
      downloadCsv("gocreate-members-export.csv", matchedMembers.map((m) => ({
        name: m.displayName,
        membership_status: m.membershipStatus,
        membership_type: m.membershipType,
        membership_submitted: m.membershipSubmittedAt,
        visits: m.visitsInRange,
        guests: m.hostedGuestsInRange,
        student_affiliation: m.studentAffiliation,
        membership_assistance: m.assistanceRequested ? "yes" : "no",
        small_business_reference: m.smallBusinessReference ? "yes" : "no",
        nonprofit_reference: m.nonprofitReference ? "yes" : "no",
        reduced_rate_reference: m.reducedRateReference ? "yes" : "no",
        data_quality: m.dataQualityStatus,
        application_details: m.hasApplicationDetails ? "yes" : "no",
      })));
    } else {
      downloadCsv("gocreate-applications-export.csv", matchedApplications.map((a) => ({
        name: a.memberName,
        submitted_at: a.submittedAt,
        membership_type: a.membershipType,
        application_status: a.applicationStatus,
        model_release: a.modelReleaseGranted === null ? "unknown" : a.modelReleaseGranted ? "granted" : "not granted",
        assistance: a.assistanceRequested ? "yes" : "no",
        assistance_reason: a.assistanceReason,
        small_business_reference: a.smallBusinessReference ? "yes" : "no",
        nonprofit_reference: a.nonprofitReference ? "yes" : "no",
        reduced_rate_reference: a.reducedRateReference ? "yes" : "no",
        matched_to_master: a.isMatchedToMaster ? "yes" : "no",
        age_band: a.ageBand,
        city: a.homeCity,
        state: a.homeState,
      })));
    }
  }

  return (
    <AnimatePresence>
      {query && (
        <>
          <motion.button
            className="drawer-backdrop"
            aria-label="Close record explorer"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="explorer-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={query.title}
            initial={{ x: reduced ? 0 : "100%", opacity: 0.7 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reduced ? 0 : "100%", opacity: 0 }}
            transition={{ type: reduced ? "tween" : "spring", stiffness: 330, damping: 34 }}
          >
            <header className="drawer-header">
              <div className="drawer-header-copy">
                <div className="eyebrow">Record explorer</div>
                <h2>{query.title}</h2>
                <p>{query.description}</p>
              </div>
              <button className="icon-button" onClick={onClose} aria-label="Close"><CloseIcon /></button>
            </header>

            <div className="drawer-count-row">
              <button className="drawer-count" onClick={() => { setSearch(""); setFacet(null); }} title="Reset local narrowing">
                <strong><CountUp value={total} /></strong>
                <span>{mode === "members" ? "people" : "application rows"}</span>
              </button>
              <div className="drawer-context">
                <InfoIcon />
                <span>{contextLabel || "Current dashboard scope"}</span>
              </div>
            </div>

            {query.privacyNote && <div className="privacy-note"><InfoIcon /><span>{query.privacyNote}</span></div>}

            <div className="drawer-tools">
              <label className="search-box drawer-search">
                <SearchIcon />
                <input value={search} onChange={(event: any) => { setSearch(event.target.value); setPage(0); }} placeholder={`Search ${mode === "members" ? "people" : "applications"}…`} />
              </label>
              <button className="secondary-button" onClick={exportRows} disabled={!total}><DownloadIcon />Export</button>
            </div>

            <div className="facet-strip" aria-label="Quick narrow">
              {statusFacets.slice(0, 3).map(([label, count]) => {
                const raw = mode === "members"
                  ? matchedMembers.find((m) => humanize(m.membershipStatus) === label)?.membershipStatus ?? label
                  : label;
                const active = facet?.kind === "status" && facet.value === raw;
                return <button key={`status-${label}`} className={active ? "facet-chip active" : "facet-chip"} onClick={() => { setFacet(active ? null : { kind: "status", value: raw }); setPage(0); }}>{label}<span>{count}</span></button>;
              })}
              {typeFacets.slice(0, 2).map(([label, count]) => {
                const active = facet?.kind === "type" && facet.value === label;
                return <button key={`type-${label}`} className={active ? "facet-chip active" : "facet-chip"} onClick={() => { setFacet(active ? null : { kind: "type", value: label }); setPage(0); }}>{label}<span>{count}</span></button>;
              })}
            </div>

            <div className="drawer-list soft-scrollbar">
              {loading && !records.length ? (
                <div className="drawer-empty"><div className="skeleton-line wide"/><div className="skeleton-line"/><p>Loading underlying records…</p></div>
              ) : !visible.length ? (
                <div className="drawer-empty"><SearchIcon /><h3>No records in this scope</h3><p>Clear the local search or dashboard filters to broaden the result.</p></div>
              ) : mode === "members" ? (
                <AnimatePresence initial={false} mode="popLayout">
                  {(visible as MemberSummary[]).map((member, index) => (
                    <motion.button
                      layout
                      key={member.id}
                      className="explorer-row"
                      onClick={() => onMember(member.id)}
                      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: reduced ? 0 : Math.min(index * 0.012, 0.14) }}
                    >
                      <div className="member-avatar">{member.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
                      <div className="explorer-row-main">
                        <strong>{member.displayName}</strong>
                        <span>{humanize(member.membershipStatus)} · {member.membershipType}</span>
                        {(member.assistanceRequested || member.smallBusinessReference || member.nonprofitReference || member.reducedRateReference) && <div className="row-signal-tags">
                          {member.assistanceRequested && <em className="signal-tag assistance">Assistance</em>}
                          {member.smallBusinessReference && <em className="signal-tag">Business</em>}
                          {member.nonprofitReference && <em className="signal-tag ink">Nonprofit / org</em>}
                          {member.reducedRateReference && <em className="signal-tag yellow">Reduced rate</em>}
                        </div>}
                      </div>
                      <div className="row-metrics">
                        <span>{member.visitsInRange} visits</span>
                        {member.hasApplicationDetails && <span>{member.applicationCount} app{member.applicationCount === 1 ? "" : "s"}</span>}
                      </div>
                      <ChevronRightIcon />
                    </motion.button>
                  ))}
                </AnimatePresence>
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {(visible as ApplicationSummary[]).map((application, index) => (
                    <motion.button
                      layout
                      key={application.id}
                      className="explorer-row"
                      onClick={() => application.memberId && onMember(application.memberId)}
                      disabled={!application.memberId}
                      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: reduced ? 0 : Math.min(index * 0.012, 0.14) }}
                    >
                      <div className="member-avatar app">{application.memberName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
                      <div className="explorer-row-main">
                        <strong>{application.memberName}</strong>
                        <span>{application.membershipType}</span>
                        {(application.assistanceRequested || application.smallBusinessReference || application.nonprofitReference || application.reducedRateReference) && <div className="row-signal-tags">
                          {application.assistanceRequested && <em className="signal-tag assistance">Assistance</em>}
                          {application.smallBusinessReference && <em className="signal-tag">Business</em>}
                          {application.nonprofitReference && <em className="signal-tag ink">Nonprofit / org</em>}
                          {application.reducedRateReference && <em className="signal-tag yellow">Reduced rate</em>}
                        </div>}
                      </div>
                      <div className="row-metrics">
                        <span>{application.applicationStatus}</span>
                        <span>{formatDate(application.submittedAt)}</span>
                      </div>
                      {application.memberId && <ChevronRightIcon />}
                    </motion.button>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <footer className="drawer-footer">
              <span>Page {Math.min(page + 1, pages)} of {pages}</span>
              <div>
                <button className="text-button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>Previous</button>
                <button className="text-button" onClick={() => setPage((value) => Math.min(pages - 1, value + 1))} disabled={page >= pages - 1}>Next</button>
              </div>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
