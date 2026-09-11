import type { ApplicationSummary, ExploreQuery, MemberSummary } from "@/lib/types";

export function visitFrequency(value: number) {
  if (value <= 0) return "0 visits";
  if (value === 1) return "1 visit";
  if (value <= 4) return "2–4 visits";
  if (value <= 9) return "5–9 visits";
  return "10+ visits";
}

export function memberMatchesExplore(member: MemberSummary, query: ExploreQuery) {
  const value = String(query.value ?? "");
  switch (query.kind) {
    case "all": return true;
    case "master": return member.isMasterMember;
    case "application-only": return !member.isMasterMember;
    case "membership-status": return member.membershipStatus === value;
    case "membership-type": return member.membershipType === value;
    case "student-affiliation": return member.studentAffiliation === value;
    case "data-quality": return member.dataQualityStatus === value;
    case "engaged": return member.visitsInRange > 0;
    case "visit-frequency": return visitFrequency(member.visitsInRange) === value;
    case "application-details": return member.hasApplicationDetails;
    case "application-type": return member.applicationMembershipType === value;
    case "application-status": return member.applicationStatus === value;
    case "model-release": return member.modelReleaseGranted === (query.value === true || value === "true");
    case "assistance": return member.assistanceRequested === true;
    case "signature": return member.signaturePresent === (query.value === true || value === "true");
    case "age-band": return (member.ageBand ?? "Unknown") === value;
    case "home-state": return (member.homeState ?? "Unknown") === value;
    case "home-city": return (member.homeCity ?? "Unknown") === value;
    case "field-present": return Boolean(query.field && member.applicationFields?.[query.field]);
    case "field-missing": return Boolean(query.field && member.hasApplicationDetails && !member.applicationFields?.[query.field]);
    case "staff": return member.membershipStatus === "staff" || member.isEmployee;
    case "wsu-affiliation": return member.studentAffiliation.toLowerCase().includes("wsu");
    case "koch-wsu": return `${member.membershipType} ${member.studentAffiliation}`.toLowerCase().includes("wsu") || member.studentAffiliation.toLowerCase().includes("wichita state");
    case "business-reference": return member.smallBusinessReference;
    case "business-reference-label": return member.smallBusinessLabels.includes(value);
    case "nonprofit-reference": return member.nonprofitReference;
    case "nonprofit-reference-label": return member.nonprofitLabels.includes(value);
    case "reduced-rate-reference": return member.reducedRateReference;
    case "reduced-rate-reference-label": return member.reducedRateLabels.includes(value);
    case "assistance-reason": return member.assistanceReason === value;
    case "privacy-info": return false;
    default: return true;
  }
}

export function applicationMatchesExplore(application: ApplicationSummary, query: ExploreQuery) {
  const value = String(query.value ?? "");
  switch (query.kind) {
    case "all": return true;
    case "application-details": return true;
    case "application-only": return !application.isMatchedToMaster;
    case "application-type": return application.membershipType === value;
    case "application-status": return application.applicationStatus === value;
    case "application-match": return application.isMatchedToMaster === (query.value === true || value === "true");
    case "application-month": return Boolean(application.submittedAt && application.submittedAt.slice(0, 7) === value);
    case "model-release": return application.modelReleaseGranted === (query.value === true || value === "true");
    case "assistance": return application.assistanceRequested;
    case "signature": return application.signaturePresent === (query.value === true || value === "true");
    case "age-band": return (application.ageBand ?? "Unknown") === value;
    case "home-state": return (application.homeState ?? "Unknown") === value;
    case "home-city": return (application.homeCity ?? "Unknown") === value;
    case "field-present": return Boolean(query.field && application.fields?.[query.field]);
    case "field-missing": return Boolean(query.field && !application.fields?.[query.field]);
    case "business-reference": return application.smallBusinessReference;
    case "business-reference-label": return application.smallBusinessLabels.includes(value);
    case "nonprofit-reference": return application.nonprofitReference;
    case "nonprofit-reference-label": return application.nonprofitLabels.includes(value);
    case "reduced-rate-reference": return application.reducedRateReference;
    case "reduced-rate-reference-label": return application.reducedRateLabels.includes(value);
    case "assistance-reason": return application.assistanceReason === value;
    case "privacy-info": return false;
    default: return true;
  }
}

export function q(kind: ExploreQuery["kind"], title: string, description: string, value?: ExploreQuery["value"], extras?: Partial<ExploreQuery>): ExploreQuery {
  return {
    id: `${kind}-${String(value ?? "all")}-${extras?.field ?? ""}`,
    kind,
    title,
    description,
    value,
    ...extras,
  };
}
