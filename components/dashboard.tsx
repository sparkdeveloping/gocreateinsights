"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import GoCreateMark from "@/components/gocreate-mark";
import { formatDate, formatNumber, formatPercent, monthKey, monthLabel } from "@/lib/format";
import type { DashboardPayload, MemberDetail, MemberSummary } from "@/lib/types";

const BLUE = "#0b9de0";
const BLUE_2 = "#37bfff";
const YELLOW = "#f8c21c";
const WHITE = "#f5f7fa";
const GRAY = "#5d6875";
const STATUS_COLORS: Record<string, string> = {
  approved: BLUE,
  pending: YELLOW,
  expired: "#4b5563",
  denied: "#ef6a6a",
  unknown: "#7a8491",
  staff: "#8b5cf6",
};
const PIE_COLORS = [BLUE, YELLOW, "#8b5cf6", "#27c499", "#f07854", "#5d6875", "#d8dee6", "#ec4899"];
const DATA_DATE = new Date("2026-09-09T12:00:00-05:00");

type Focus = { kind: "status" | "type" | "engaged" | "expiring" | "quality"; value?: string } | null;
type Metric = "members" | "visits" | "guests";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function pct(n: number, d: number) {
  return d ? n / d : 0;
}

function countBy(members: MemberSummary[], key: keyof MemberSummary) {
  const map = new Map<string, number>();
  members.forEach((member) => {
    const value = String(member[key] ?? "Unspecified");
    map.set(value, (map.get(value) ?? 0) + 1);
  });
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function statusLabel(value: string | null) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function StatCard({ label, value, detail, accent = BLUE, onClick, active }: { label: string; value: string; detail: string; accent?: string; onClick?: () => void; active?: boolean }) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: .985 }}
      onClick={onClick}
      className={cn("glass group relative min-h-[132px] overflow-hidden rounded-[20px] p-5 text-left", active && "ring-1 ring-white/30")}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] opacity-90" style={{ background: accent }} />
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/42">{label}</div>
      <div className="mt-4 text-3xl font-black tracking-[-.045em] text-white">{value}</div>
      <div className="mt-2 text-xs leading-5 text-white/45">{detail}</div>
      <div className="absolute right-4 top-4 h-10 w-10 rounded-full opacity-10 blur-xl transition group-hover:opacity-25" style={{ background: accent }} />
    </motion.button>
  );
}

function MiniPill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
        active ? "border-[var(--brand-blue)] bg-[rgba(11,157,224,.12)] text-white" : "border-white/10 bg-white/[.025] text-white/52 hover:border-white/20 hover:text-white/80",
      )}
    >
      {children}
    </button>
  );
}

function SectionTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--brand-blue)]">{eyebrow}</div>
        <h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-white md:text-3xl">{title}</h2>
      </div>
      {note && <p className="max-w-xl text-xs leading-5 text-white/42 md:text-right">{note}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#090d12]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
      {label != null && <div className="mb-1 text-[10px] font-bold uppercase tracking-[.15em] text-white/40">{label}</div>}
      {payload.map((item: any) => (
        <div key={item.dataKey ?? item.name} className="flex items-center justify-between gap-5 text-xs">
          <span className="text-white/55">{item.name ?? item.dataKey}</span>
          <span className="font-bold text-white">{typeof item.value === "number" ? formatNumber(item.value) : item.value}</span>
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 border-b border-white/[.055] py-3 text-xs last:border-0">
      <span className="text-white/36">{label}</span>
      <span className="break-words text-right font-semibold text-white/82">{value ?? "—"}</span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07090c]">
      <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <GoCreateMark />
        <div className="mx-auto mt-6 h-1 w-36 overflow-hidden rounded-full bg-white/5">
          <motion.div className="h-full w-1/2 bg-[var(--brand-blue)]" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} />
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/30">Loading member intelligence</p>
      </motion.div>
    </div>
  );
}

export default function Dashboard() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [membershipType, setMembershipType] = useState("all");
  const [quality, setQuality] = useState("all");
  const [doorOnly, setDoorOnly] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);
  const [metric, setMetric] = useState<Metric>("members");
  const [topN, setTopN] = useState(6);
  const [compactCharts, setCompactCharts] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error("Dashboard data could not be loaded.");
        return r.json();
      })
      .then(setPayload)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedMember) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/member/${selectedMember}`)
      .then((r) => r.json())
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  }, [selectedMember]);

  const members = payload?.members ?? [];
  const statuses = useMemo(() => countBy(members, "membershipStatus"), [members]);
  const types = useMemo(() => countBy(members, "membershipType"), [members]);
  const qualities = useMemo(() => countBy(members, "dataQualityStatus"), [members]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter((m) => {
      if (needle && !`${m.displayName ?? ""} ${m.membershipType ?? ""} ${m.membershipStatus ?? ""}`.toLowerCase().includes(needle)) return false;
      if (status !== "all" && m.membershipStatus !== status) return false;
      if (membershipType !== "all" && m.membershipType !== membershipType) return false;
      if (quality !== "all" && m.dataQualityStatus !== quality) return false;
      if (doorOnly && !m.doorAccessDesired) return false;
      if (focus?.kind === "status" && m.membershipStatus !== focus.value) return false;
      if (focus?.kind === "type" && m.membershipType !== focus.value) return false;
      if (focus?.kind === "engaged" && m.visitsInRange <= 0) return false;
      if (focus?.kind === "quality" && m.dataQualityStatus !== "quarantined") return false;
      if (focus?.kind === "expiring") {
        if (!m.membershipExpiresAt) return false;
        const exp = new Date(m.membershipExpiresAt);
        const days = (exp.getTime() - DATA_DATE.getTime()) / 86_400_000;
        if (days < 0 || days > 60) return false;
      }
      return true;
    });
  }, [members, search, status, membershipType, quality, doorOnly, focus]);

  useEffect(() => setPage(0), [search, status, membershipType, quality, doorOnly, focus]);

  const approved = filtered.filter((m) => m.membershipStatus === "approved").length;
  const visitSum = filtered.reduce((sum, m) => sum + (m.visitsInRange || 0), 0);
  const engaged = filtered.filter((m) => m.visitsInRange > 0).length;
  const door = filtered.filter((m) => m.doorAccessDesired).length;
  const reportable = filtered.filter((m) => m.dataQualityStatus === "reportable").length;
  const expiringSoon = filtered.filter((m) => {
    if (!m.membershipExpiresAt) return false;
    const days = (new Date(m.membershipExpiresAt).getTime() - DATA_DATE.getTime()) / 86_400_000;
    return days >= 0 && days <= 60;
  }).length;

  const statusData = useMemo(() => countBy(filtered, "membershipStatus").slice(0, topN), [filtered, topN]);
  const typeData = useMemo(() => countBy(filtered, "membershipType").slice(0, topN), [filtered, topN]);
  const affiliationData = useMemo(() => countBy(filtered, "studentAffiliation").slice(0, topN), [filtered, topN]);

  const monthly = useMemo(() => {
    const map = new Map<string, { members: number; visits: number; guests: number }>();
    filtered.forEach((m) => {
      const key = monthKey(m.membershipSubmittedAt);
      if (!key) return;
      const row = map.get(key) ?? { members: 0, visits: 0, guests: 0 };
      row.members += 1;
      row.visits += m.visitsInRange || 0;
      row.guests += m.hostedGuestsInRange || 0;
      map.set(key, row);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([key, value]) => ({ month: monthLabel(key), ...value }));
  }, [filtered]);

  const scatter = useMemo(() => filtered
    .filter((m) => m.totalVisits > 0 || m.visitsInRange > 0)
    .sort((a, b) => b.totalVisits - a.totalVisits)
    .slice(0, 120)
    .map((m) => ({ id: m.id, name: m.displayName ?? "Member", total: m.totalVisits, recent: m.visitsInRange, guests: m.hostedGuestsInRange })), [filtered]);

  const metricLabel = metric === "members" ? "Membership submissions" : metric === "visits" ? "Observed visits" : "Hosted guests";
  const activeFilters = [status !== "all", membershipType !== "all", quality !== "all", doorOnly, !!focus, !!search].filter(Boolean).length;
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  function resetFilters() {
    setSearch(""); setStatus("all"); setMembershipType("all"); setQuality("all"); setDoorOnly(false); setFocus(null);
  }

  function exportFiltered() {
    const headers = ["id","displayName","membershipStatus","membershipType","studentAffiliation","dataQualityStatus","doorAccessDesired","visitsInRange","totalVisits","lastVisitAt","membershipSubmittedAt","membershipExpiresAt"] as const;
    const esc = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers.join(","), ...filtered.map((m) => headers.map((h) => esc(m[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = href; a.download = "gocreate-filtered-members.csv"; a.click(); URL.revokeObjectURL(href);
  }

  if (error) return <div className="flex min-h-screen items-center justify-center p-8 text-center text-white/70">{error}</div>;
  if (!payload) return <LoadingScreen />;

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="grid-fade pointer-events-none fixed inset-0 opacity-60" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[92px] flex-col items-center border-r border-white/[.055] bg-[#080b10]/90 py-6 backdrop-blur-xl xl:flex">
        <GoCreateMark compact />
        <div className="mt-10 flex flex-1 flex-col items-center gap-3">
          {[['overview','OV'],['membership','MB'],['engagement','EN'],['members','DB']].map(([id,label]) => (
            <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[.02] text-[10px] font-black tracking-[.08em] text-white/42 transition hover:border-[var(--brand-blue)]/50 hover:text-white">{label}</button>
          ))}
        </div>
        <div className="h-2 w-2 rounded-full bg-[var(--brand-yellow)] shadow-[0_0_18px_rgba(248,194,28,.55)]" />
      </aside>

      <div className="relative z-10 xl:pl-[92px]">
        <header className="sticky top-0 z-30 border-b border-white/[.055] bg-[#080b10]/82 px-4 backdrop-blur-2xl md:px-7 xl:px-9">
          <div className="mx-auto flex h-[74px] max-w-[1600px] items-center justify-between gap-4">
            <div className="xl:hidden"><GoCreateMark /></div>
            <div className="hidden min-w-0 md:block xl:block">
              <div className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">Operations / Member Intelligence</div>
              <div className="mt-1 truncate text-sm font-bold text-white/80">GoCreate Master · September 9, 2026</div>
            </div>
            <div className="flex items-center gap-2">
              {activeFilters > 0 && <span className="hidden rounded-full border border-[var(--brand-yellow)]/30 bg-[rgba(248,194,28,.08)] px-3 py-1.5 text-[10px] font-bold text-[var(--brand-yellow)] sm:inline">{activeFilters} active filter{activeFilters === 1 ? "" : "s"}</span>}
              <button onClick={resetFilters} className="rounded-xl border border-white/10 bg-white/[.025] px-3.5 py-2 text-[11px] font-bold text-white/55 transition hover:text-white">Reset view</button>
              <button onClick={exportFiltered} className="rounded-xl bg-[var(--brand-blue)] px-3.5 py-2 text-[11px] font-black text-[#041018] shadow-[0_8px_30px_rgba(11,157,224,.18)] transition hover:brightness-110">Export CSV</button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 pb-20 pt-5 md:px-7 xl:px-9">
          <section id="overview" className="scroll-mt-24">
            <div className="glass relative overflow-hidden rounded-[28px] px-5 py-7 md:px-8 md:py-9">
              <motion.div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--brand-blue)]/10 blur-[90px]" animate={{ scale: [1, 1.18, 1], opacity: [.6, 1, .6] }} transition={{ duration: 8, repeat: Infinity }} />
              <motion.div className="absolute bottom-[-8rem] left-[32%] h-72 w-72 rounded-full bg-[var(--brand-yellow)]/[.055] blur-[100px]" animate={{ x: [-20, 25, -20] }} transition={{ duration: 10, repeat: Infinity }} />
              <div className="relative grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--brand-blue)]/25 bg-[rgba(11,157,224,.09)] px-3 py-1 text-[10px] font-black uppercase tracking-[.15em] text-[var(--brand-blue-2)]">Live analytic workspace</span>
                    <span className="rounded-full border border-white/8 bg-white/[.02] px-3 py-1 text-[10px] font-bold text-white/38">{formatNumber(payload.meta.rowCount)} records · {payload.meta.columnCount} source fields</span>
                  </div>
                  <h1 className="mt-6 max-w-4xl text-[clamp(2.4rem,5vw,5.4rem)] font-black leading-[.92] tracking-[-.065em] text-white">See the community.<br/><span className="text-[var(--brand-blue)]">Shape what happens next.</span></h1>
                  <p className="mt-5 max-w-2xl text-sm leading-6 text-white/48 md:text-base">A single-page operational cockpit for membership lifecycle, access demand, data health, and observed engagement. Every major visual can become a filter; every member row opens into a deeper operational record.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">Current view</div>
                    <div className="mt-2 text-3xl font-black tracking-[-.04em]">{formatNumber(filtered.length)}</div>
                    <div className="mt-1 text-xs text-white/35">members in scope</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">Observed activity</div>
                    <div className="mt-2 text-3xl font-black tracking-[-.04em] text-[var(--brand-yellow)]">{formatNumber(visitSum)}</div>
                    <div className="mt-1 text-xs text-white/35">visits in source range</div>
                  </div>
                  <div className="col-span-2 rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">Data confidence</div>
                        <div className="mt-2 text-xl font-black">{formatPercent(pct(reportable, filtered.length))} reportable</div>
                      </div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct(reportable, filtered.length) * 100}%` }} transition={{ duration: .8 }} className="h-full rounded-full bg-[var(--brand-blue)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Members in view" value={formatNumber(filtered.length)} detail={`${formatPercent(pct(filtered.length, members.length))} of source population`} accent={WHITE} />
              <StatCard label="Approved" value={formatNumber(approved)} detail={`${formatPercent(pct(approved, filtered.length))} of current view`} onClick={() => setFocus(focus?.kind === "status" && focus.value === "approved" ? null : { kind: "status", value: "approved" })} active={focus?.kind === "status" && focus.value === "approved"} />
              <StatCard label="Engaged" value={formatNumber(engaged)} detail={`${formatNumber(visitSum)} observed visits in range`} accent={YELLOW} onClick={() => setFocus(focus?.kind === "engaged" ? null : { kind: "engaged" })} active={focus?.kind === "engaged"} />
              <StatCard label="Door access desired" value={formatNumber(door)} detail={`${formatPercent(pct(door, filtered.length))} of members in view`} accent={BLUE_2} onClick={() => setDoorOnly(!doorOnly)} active={doorOnly} />
              <StatCard label="Expiring ≤60 days" value={formatNumber(expiringSoon)} detail="Based on recorded expiration dates" accent="#f07854" onClick={() => setFocus(focus?.kind === "expiring" ? null : { kind: "expiring" })} active={focus?.kind === "expiring"} />
            </div>
          </section>

          <section className="mt-10 scroll-mt-24" id="membership">
            <SectionTitle eyebrow="Control center" title="Adjust the story without leaving the page" note="Use global filters, then click chart segments to narrow the member table and every downstream visual." />
            <div className="panel mt-5 grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[.14em] text-white/35">Search</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, type, status…" className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/24 focus:border-[var(--brand-blue)]/60" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[.14em] text-white/35">Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0c1118] px-3 py-2.5 text-sm text-white outline-none">
                  <option value="all">All statuses</option>{statuses.map((s) => <option key={s.name} value={s.name}>{statusLabel(s.name)} · {s.value}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[.14em] text-white/35">Membership type</span>
                <select value={membershipType} onChange={(e) => setMembershipType(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0c1118] px-3 py-2.5 text-sm text-white outline-none">
                  <option value="all">All types</option>{types.map((s) => <option key={s.name} value={s.name}>{s.name} · {s.value}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[.14em] text-white/35">Data quality</span>
                <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0c1118] px-3 py-2.5 text-sm text-white outline-none">
                  <option value="all">All quality states</option>{qualities.map((s) => <option key={s.name} value={s.name}>{s.name} · {s.value}</option>)}
                </select>
              </label>
              <div className="lg:col-span-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/[.055] pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <MiniPill active={doorOnly} onClick={() => setDoorOnly(!doorOnly)}>Door access desired</MiniPill>
                  <MiniPill active={focus?.kind === "quality"} onClick={() => setFocus(focus?.kind === "quality" ? null : { kind: "quality" })}>Quarantined data</MiniPill>
                  {focus && <MiniPill active onClick={() => setFocus(null)}>Clear chart focus ×</MiniPill>}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-white/45">
                  <div className="flex items-center gap-2"><span>Top categories</span><input type="range" min="4" max="10" value={topN} onChange={(e) => setTopN(Number(e.target.value))} /><span className="w-4 font-bold text-white">{topN}</span></div>
                  <MiniPill active={compactCharts} onClick={() => setCompactCharts(!compactCharts)}>{compactCharts ? "Compact charts" : "Comfortable charts"}</MiniPill>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
              <div className="panel overflow-hidden p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black">Lifecycle trend</div>
                    <div className="mt-1 text-xs text-white/38">Monthly activity keyed to membership submission date</div>
                  </div>
                  <div className="flex gap-2">
                    {(["members","visits","guests"] as Metric[]).map((m) => <MiniPill key={m} active={metric === m} onClick={() => setMetric(m)}>{m === "members" ? "Members" : m === "visits" ? "Visits" : "Guests"}</MiniPill>)}
                  </div>
                </div>
                <div className={compactCharts ? "mt-4 h-[250px]" : "mt-5 h-[330px]"}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthly} margin={{ top: 12, right: 6, left: -22, bottom: 0 }}>
                      <defs><linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity={.34}/><stop offset="100%" stopColor={BLUE} stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,.35)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={22} />
                      <YAxis tick={{ fill: "rgba(255,255,255,.3)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey={metric} name={metricLabel} stroke={BLUE_2} strokeWidth={2.5} fill="url(#areaBlue)" animationDuration={900} activeDot={{ r: 5, fill: YELLOW, stroke: "#090d12", strokeWidth: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="panel p-4 md:p-5">
                <div className="text-sm font-black">Membership status</div>
                <div className="mt-1 text-xs text-white/38">Click a bar to focus the full workspace</div>
                <div className={compactCharts ? "mt-4 h-[250px]" : "mt-5 h-[330px]"}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} layout="vertical" margin={{ left: 20, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid stroke="rgba(255,255,255,.05)" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={68} tick={{ fill: "rgba(255,255,255,.5)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={statusLabel} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Members" radius={[0,8,8,0]} animationDuration={700}>
                        {statusData.map((entry) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? GRAY} opacity={focus?.kind === "status" && focus.value !== entry.name ? .24 : .9} onClick={() => setFocus(focus?.kind === "status" && focus.value === entry.name ? null : { kind: "status", value: entry.name })} cursor="pointer" />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="panel p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="text-sm font-black">Membership mix</div><div className="mt-1 text-xs text-white/38">Distribution across current filtered population</div></div>
                  <span className="rounded-full bg-white/[.04] px-3 py-1 text-[10px] font-bold text-white/40">{formatNumber(filtered.length)} total</span>
                </div>
                <div className="mt-3 grid min-h-[300px] items-center md:grid-cols-[1fr_.9fr]">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={typeData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={3} stroke="transparent" animationDuration={800}>
                          {typeData.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={focus?.kind === "type" && focus.value !== entry.name ? .2 : .95} onClick={() => setFocus(focus?.kind === "type" && focus.value === entry.name ? null : { kind: "type", value: entry.name })} cursor="pointer" />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {typeData.map((row, i) => (
                      <button key={row.name} onClick={() => setFocus(focus?.kind === "type" && focus.value === row.name ? null : { kind: "type", value: row.name })} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[.035]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-white/55">{row.name}</span>
                        <span className="text-[11px] font-black text-white">{formatNumber(row.value)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="panel p-4 md:p-5">
                <div className="text-sm font-black">Student affiliation</div>
                <div className="mt-1 text-xs text-white/38">Top affiliation labels in the current view</div>
                <div className="mt-5 space-y-3">
                  {affiliationData.map((row, i) => {
                    const max = affiliationData[0]?.value || 1;
                    return <motion.div key={row.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .035 }}>
                      <div className="mb-1.5 flex justify-between gap-4 text-[11px]"><span className="truncate text-white/55">{row.name}</span><span className="font-black text-white">{formatNumber(row.value)}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/[.045]"><motion.div initial={{ width: 0 }} animate={{ width: `${(row.value / max) * 100}%` }} transition={{ duration: .65, delay: i * .035 }} className="h-full rounded-full" style={{ background: i === 0 ? BLUE : i === 1 ? YELLOW : "rgba(255,255,255,.23)" }} /></div>
                    </motion.div>;
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-12 scroll-mt-24" id="engagement">
            <SectionTitle eyebrow="Engagement" title="Find the members creating activity" note="The source currently contains a limited number of observed visit records. This section emphasizes exactly what is present rather than extrapolating attendance." />
            <div className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
              <div className="panel p-4 md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><div className="text-sm font-black">Activity field</div><div className="mt-1 text-xs text-white/38">Each dot is a member with recorded activity; click one for detail</div></div>
                  <span className="rounded-full border border-[var(--brand-yellow)]/20 bg-[rgba(248,194,28,.06)] px-3 py-1 text-[10px] font-bold text-[var(--brand-yellow)]">{scatter.length} plotted</span>
                </div>
                <div className={compactCharts ? "mt-4 h-[270px]" : "mt-5 h-[360px]"}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(255,255,255,.055)" />
                      <XAxis type="number" dataKey="total" name="Total visits" tick={{ fill: "rgba(255,255,255,.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="number" dataKey="recent" name="Visits in range" tick={{ fill: "rgba(255,255,255,.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ strokeDasharray: "4 4", stroke: "rgba(255,255,255,.15)" }} content={<CustomTooltip />} />
                      <Scatter data={scatter} fill={BLUE} onClick={(point: any) => { const id = point?.payload?.id ?? point?.id; if (id) setSelectedMember(id); }} animationDuration={700} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="panel p-5">
                  <div className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Engagement concentration</div>
                  <div className="mt-4 flex items-end justify-between gap-3"><div className="text-4xl font-black tracking-[-.05em] text-[var(--brand-yellow)]">{formatPercent(pct(engaged, filtered.length))}</div><div className="pb-1 text-right text-xs leading-5 text-white/35">of members in view<br/>have an observed visit</div></div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5"><motion.div initial={{ width: 0 }} animate={{ width: `${pct(engaged, filtered.length) * 100}%` }} className="h-full bg-[var(--brand-yellow)]" /></div>
                </div>
                <div className="panel p-5">
                  <div className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Access demand</div>
                  <div className="mt-4 flex items-end justify-between gap-3"><div className="text-4xl font-black tracking-[-.05em] text-[var(--brand-blue)]">{formatPercent(pct(door, filtered.length))}</div><div className="pb-1 text-right text-xs leading-5 text-white/35">door access<br/>desired</div></div>
                  <button onClick={() => setDoorOnly(!doorOnly)} className="mt-5 w-full rounded-xl border border-white/10 bg-white/[.025] py-2.5 text-[11px] font-bold text-white/55 hover:text-white">{doorOnly ? "Show all members" : "Focus access requests"}</button>
                </div>
                <div className="panel p-5 sm:col-span-2 xl:col-span-1">
                  <div className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Quality exception queue</div>
                  <div className="mt-3 text-2xl font-black">{formatNumber(filtered.filter((m) => m.dataQualityStatus === "quarantined").length)}</div>
                  <p className="mt-2 text-xs leading-5 text-white/38">Records marked quarantined inside the current filter context.</p>
                  <button onClick={() => setFocus(focus?.kind === "quality" ? null : { kind: "quality" })} className="mt-4 text-[11px] font-black text-[var(--brand-blue-2)]">{focus?.kind === "quality" ? "Clear quality focus →" : "Open exception queue →"}</button>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-12 scroll-mt-24" id="members">
            <SectionTitle eyebrow="Member explorer" title="Click from aggregate to individual" note="The table responds to every filter above. Selecting a row opens the detailed record in an animated side panel without navigating away." />
            <div className="panel mt-5 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.055] px-4 py-4 md:px-5">
                <div className="text-xs text-white/45"><span className="font-black text-white">{formatNumber(filtered.length)}</span> matching records</div>
                <div className="flex items-center gap-2 text-[10px] text-white/35"><span>Page {Math.min(page + 1, pageCount)} / {pageCount}</span><button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-lg border border-white/10 px-2.5 py-1.5 font-bold text-white/55 disabled:opacity-25">Prev</button><button disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} className="rounded-lg border border-white/10 px-2.5 py-1.5 font-bold text-white/55 disabled:opacity-25">Next</button></div>
              </div>
              <div className="soft-scrollbar overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead><tr className="border-b border-white/[.055] text-[9px] font-black uppercase tracking-[.14em] text-white/28"><th className="px-5 py-3">Member</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Visits</th><th className="px-4 py-3">Last visit</th><th className="px-4 py-3">Quality</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {visibleRows.map((m) => (
                        <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={m.id} onClick={() => setSelectedMember(m.id)} className="group cursor-pointer border-b border-white/[.045] transition last:border-0 hover:bg-white/[.028]">
                          <td className="px-5 py-3.5"><div className="font-bold text-white/88">{m.displayName || "Unnamed member"}</div><div className="mt-1 text-[10px] text-white/30">{m.studentAffiliation || "Unknown affiliation"}</div></td>
                          <td className="px-4 py-3.5"><span className="inline-flex items-center gap-2 text-xs font-semibold text-white/62"><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[m.membershipStatus ?? "unknown"] ?? GRAY }} />{statusLabel(m.membershipStatus)}</span></td>
                          <td className="max-w-[260px] px-4 py-3.5 text-xs text-white/50"><div className="truncate">{m.membershipType || "Unspecified"}</div></td>
                          <td className="px-4 py-3.5 text-xs font-bold"><span className={m.doorAccessDesired ? "text-[var(--brand-blue-2)]" : "text-white/30"}>{m.doorAccessDesired ? "Desired" : "No"}</span></td>
                          <td className="px-4 py-3.5 text-xs font-black text-white/70">{m.visitsInRange}</td>
                          <td className="px-4 py-3.5 text-xs text-white/38">{formatDate(m.lastVisitAt)}</td>
                          <td className="px-4 py-3.5"><span className={cn("rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em]", m.dataQualityStatus === "reportable" ? "bg-[rgba(39,196,153,.09)] text-[#58d6b2]" : "bg-[rgba(240,120,84,.1)] text-[#f29a7e]")}>{m.dataQualityStatus || "unknown"}</span></td>
                          <td className="px-4 py-3.5 text-right text-sm text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/70">→</td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <footer className="mt-10 flex flex-col gap-3 border-t border-white/[.055] py-7 text-[10px] leading-5 text-white/28 md:flex-row md:items-center md:justify-between">
            <div>GoCreate Insight Studio · single-page analytics prototype</div>
            <div>Source: {payload.meta.sourceFile} · {formatNumber(payload.meta.rowCount)} records · member contact data is sensitive</div>
          </footer>
        </div>
      </div>

      <AnimatePresence>
        {selectedMember && (
          <>
            <motion.button aria-label="Close member detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedMember(null)} className="fixed inset-0 z-50 cursor-default bg-black/55 backdrop-blur-[2px]" />
            <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 280, damping: 30 }} className="fixed inset-y-0 right-0 z-[60] w-full max-w-[540px] border-l border-white/10 bg-[#090d12] shadow-[-24px_0_80px_rgba(0,0,0,.45)]">
              <div className="flex h-full flex-col">
                <div className="border-b border-white/[.065] p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[.17em] text-[var(--brand-blue)]">Member detail</div><h3 className="mt-2 truncate text-2xl font-black tracking-[-.035em]">{detail?.displayName ?? "Loading…"}</h3></div>
                    <button onClick={() => setSelectedMember(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.025] text-lg text-white/50 hover:text-white">×</button>
                  </div>
                </div>
                <div className="soft-scrollbar flex-1 overflow-y-auto p-5 md:p-6">
                  {detailLoading || !detail ? <div className="space-y-3">{Array.from({ length: 10 }).map((_, i) => <motion.div key={i} animate={{ opacity: [.22,.5,.22] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * .04 }} className="h-11 rounded-xl bg-white/[.035]" />)}</div> : (
                    <div className="space-y-5">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/28">Status</div><div className="mt-2 text-xs font-black" style={{ color: STATUS_COLORS[detail.membershipStatus ?? "unknown"] ?? WHITE }}>{statusLabel(detail.membershipStatus)}</div></div>
                        <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/28">Visits</div><div className="mt-2 text-xl font-black">{detail.visitsInRange}</div></div>
                        <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/28">Door</div><div className="mt-2 text-xs font-black text-[var(--brand-blue-2)]">{detail.doorAccessDesired ? "Desired" : "Not requested"}</div></div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[.018] px-4"><DetailRow label="Email" value={detail.email || "—"} /><DetailRow label="Phone" value={detail.phone || "—"} /><DetailRow label="Badge" value={detail.badgeNumber || "—"} /></div>
                      <div><div className="mb-2 text-[10px] font-black uppercase tracking-[.15em] text-white/32">Membership</div><div className="rounded-2xl border border-white/8 bg-white/[.018] px-4"><DetailRow label="Type" value={detail.membershipType || "Unspecified"} /><DetailRow label="Submitted" value={formatDate(detail.membershipSubmittedAt)} /><DetailRow label="Expires" value={formatDate(detail.membershipExpiresAt)} /><DetailRow label="Source" value={detail.membershipSource || "—"} /><DetailRow label="Affiliation" value={detail.studentAffiliation || "—"} /></div></div>
                      <div><div className="mb-2 text-[10px] font-black uppercase tracking-[.15em] text-white/32">Access & activity</div><div className="rounded-2xl border border-white/8 bg-white/[.018] px-4"><DetailRow label="Access source" value={detail.doorAccessSource || "—"} /><DetailRow label="Visits in range" value={detail.visitsInRange} /><DetailRow label="Total visits" value={detail.totalVisits} /><DetailRow label="Last visit" value={formatDate(detail.lastVisitAt)} /><DetailRow label="Guests hosted" value={detail.hostedGuestsInRange} /></div></div>
                      <div><div className="mb-2 text-[10px] font-black uppercase tracking-[.15em] text-white/32">Operational flags</div><div className="rounded-2xl border border-white/8 bg-white/[.018] px-4"><DetailRow label="Quality" value={detail.dataQualityStatus || "—"} /><DetailRow label="Reason" value={detail.dataQualityReason || "—"} /><DetailRow label="Employee" value={detail.isEmployee ? "Yes" : "No"} /><DetailRow label="Admin" value={detail.isAdmin ? "Yes" : "No"} /><DetailRow label="Super admin" value={detail.isSuperAdmin ? "Yes" : "No"} /><DetailRow label="Admin role" value={detail.adminRole || "—"} /></div></div>
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
