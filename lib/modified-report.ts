export const LEGACY_ASSISTANCE_HISTORY = [
  { year: "2020", assistance: 104, totalMembers: null, youthServed: null },
  { year: "2021", assistance: 88, totalMembers: null, youthServed: null },
  { year: "2022", assistance: 328, totalMembers: null, youthServed: 1450 },
  { year: "2023", assistance: 370, totalMembers: null, youthServed: 1400 },
  { year: "2024", assistance: 410, totalMembers: 805, youthServed: 3200 },
  { year: "2025", assistance: 843, totalMembers: 1685, youthServed: 3450 },
] as const;

export const DEFAULT_MODIFIED_REPORT = {
  reportingPeriodStart: "2025-09-01",
  membershipAssistance: 84,
  smallBusinesses: 62,
  provenance: "Manual internal reporting adjustments supplied by GoCreate staff on Sep 11, 2026.",
} as const;
