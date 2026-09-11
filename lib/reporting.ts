import type { ApplicationSummary, DashboardBootstrap, MemberSummary } from "@/lib/types";

export type DateRangePreset = "all" | "koch" | "year" | "90d" | "custom";
export type DateRange = { from: string; to: string; preset: DateRangePreset };

export function dateKey(value?: string | null) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function inDateRange(value: string | null | undefined, range: DateRange) {
  const key = dateKey(value);
  if (!key) return false;
  return key >= range.from && key <= range.to;
}

export function memberReportingDate(member: MemberSummary) {
  return member.isMasterMember ? member.membershipSubmittedAt : member.applicationSubmittedAt;
}

export function defaultAllRange(bootstrap: DashboardBootstrap): DateRange {
  const candidates = [bootstrap.meta.masterSubmissionMin, bootstrap.meta.applicationSubmissionMin].filter(Boolean) as string[];
  const from = candidates.sort()[0] ?? "2024-01-01";
  return { from, to: bootstrap.meta.dataAsOf, preset: "all" };
}

export function kochRange(bootstrap: DashboardBootstrap): DateRange {
  return { from: "2025-09-01", to: bootstrap.meta.dataAsOf, preset: "koch" };
}

export function yearRange(bootstrap: DashboardBootstrap): DateRange {
  const year = bootstrap.meta.dataAsOf.slice(0, 4);
  return { from: `${year}-01-01`, to: bootstrap.meta.dataAsOf, preset: "year" };
}

export function last90DaysRange(bootstrap: DashboardBootstrap): DateRange {
  const end = new Date(`${bootstrap.meta.dataAsOf}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 89);
  return { from: start.toISOString().slice(0, 10), to: bootstrap.meta.dataAsOf, preset: "90d" };
}

export function rangeLabel(range: DateRange) {
  const f = new Date(`${range.from}T12:00:00`);
  const t = new Date(`${range.to}T12:00:00`);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt.format(f)} – ${fmt.format(t)}`;
}

export function latestApplicationsByPerson(applications: ApplicationSummary[]) {
  const map = new Map<string, ApplicationSummary>();
  applications.forEach((app) => {
    const key = app.memberId || `application:${app.id}`;
    const existing = map.get(key);
    if (!existing || (app.submittedAt || "") > (existing.submittedAt || "")) map.set(key, app);
  });
  return [...map.values()];
}
