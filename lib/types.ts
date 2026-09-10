export type DistributionPoint = { name: string; value: number };

export type ApplicationFieldFlags = {
  member_name: boolean;
  email: boolean;
  primary_phone: boolean;
  birthdate: boolean;
  home_city: boolean;
  home_state: boolean;
  membership_type_list: boolean;
  model_release_list: boolean;
  submitted_on: boolean;
  signature_present: boolean;
  badge_id: boolean;
};

export type MemberSummary = {
  id: string;
  displayName: string;
  isMasterMember: boolean;
  sourceOrigin: "master" | "application-only";
  membershipStatus: string;
  membershipType: string;
  studentAffiliation: string;
  dataQualityStatus: string;
  isEmployee: boolean;
  active: boolean;
  doorAccessDesired: boolean;
  visitsInRange: number;
  totalVisits: number;
  hostedGuestsInRange: number;
  membershipSubmittedAt: string | null;
  membershipExpiresAt: string | null;
  lastActivityAt: string | null;
  lastVisitAt: string | null;
  amountPaid: number;
  hasApplicationDetails: boolean;
  applicationCount: number;
  applicationMembershipType: string | null;
  applicationStatus: string | null;
  modelReleaseGranted: boolean | null;
  assistanceRequested: boolean | null;
  ageBand: string | null;
  homeCity: string | null;
  homeState: string | null;
  signaturePresent: boolean | null;
  applicationSubmittedAt: string | null;
  applicationFields: ApplicationFieldFlags | null;
};

export type FieldCompleteness = {
  key: keyof ApplicationFieldFlags | "medical_alerts";
  label: string;
  count: number;
  missing: number;
  total: number;
  percent: number;
  sensitivity: "identity" | "private" | "sensitive" | "aggregate-safe";
  exploreSafe: boolean;
};

export type DashboardBootstrap = {
  meta: {
    generatedAt: string;
    dataAsOf: string;
    masterFile: string;
    enrichmentFile: string;
    masterRows: number;
    knownPeople: number;
    applicationRows: number;
    emergencyContactRows: number;
    matchedApplications: number;
    distinctEnrichedMembers: number;
    unmatchedApplications: number;
    enrichmentCoveragePercent: number;
  };
  overview: {
    masterMembers: number;
    knownPeople: number;
    approvedMembers: number;
    staffMembers: number;
    engagedMembers: number;
    observedVisits: number;
    hostedGuests: number;
    applicationDetails: number;
    quarantinedRecords: number;
    modelReleaseYes: number;
    modelReleaseNo: number;
    assistanceRequests: number;
    signedApplications: number;
  };
  membershipStatus: DistributionPoint[];
  membershipType: DistributionPoint[];
  studentAffiliation: DistributionPoint[];
  applicationMembershipType: DistributionPoint[];
  applicationStatus: DistributionPoint[];
  ageBands: DistributionPoint[];
  homeStates: DistributionPoint[];
  homeCities: DistributionPoint[];
  modelRelease: DistributionPoint[];
  visitFrequency: DistributionPoint[];
  submissionTimeline: Array<{ month: string; label: string; value: number }>;
  fieldCompleteness: FieldCompleteness[];
  unmatchedApplications: Array<{
    id: string;
    displayName: string;
    membershipType: string;
    homeCity: string | null;
    homeState: string | null;
  }>;
};

export type PrivateApplication = {
  sourceKey?: string | null;
  submittedOn?: string | null;
  birthdate?: string | null;
  age?: number | null;
  homeAddressStreet?: string | null;
  homeCity?: string | null;
  homeState?: string | null;
  homeZip?: string | null;
  primaryPhone?: string | null;
  otherPhone?: string | null;
  membershipType?: string | null;
  applicationStatus?: string | null;
  modelRelease?: string | null;
  signaturePresent?: boolean | null;
  badgeId?: string | null;
  assistanceTab?: string | null;
  selectedEmployer?: string | null;
  medicalAlertOnFile?: boolean;
  emergencyContacts?: Array<{
    contactNumber?: string | null;
    fullName?: string | null;
    relationship?: string | null;
    primaryPhone?: string | null;
    otherPhone?: string | null;
    streetAddress?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  }>;
};

export type MemberDetail = MemberSummary & {
  recordKey?: string | null;
  email?: string | null;
  phone?: string | null;
  customerId?: string | null;
  membershipDescription?: string | null;
  piiMode?: "masked" | "full";
  application?: PrivateApplication | null;
  applicationHistory?: Array<{
    sourceKey?: string | null;
    submittedOn?: string | null;
    membershipType?: string | null;
    applicationStatus?: string | null;
    modelRelease?: string | null;
    assistanceTab?: string | null;
  }>;
};

export type ApplicationSummary = {
  id: string;
  memberId: string | null;
  memberName: string;
  submittedAt: string | null;
  membershipType: string;
  applicationStatus: string;
  modelReleaseGranted: boolean | null;
  assistanceRequested: boolean;
  signaturePresent: boolean | null;
  ageBand: string | null;
  homeCity: string | null;
  homeState: string | null;
  isMatchedToMaster: boolean;
  fields: ApplicationFieldFlags;
};

export type DashboardPayload = { members: MemberSummary[]; applications: ApplicationSummary[] };

export type ExploreKind =
  | "all"
  | "master"
  | "application-only"
  | "membership-status"
  | "membership-type"
  | "student-affiliation"
  | "data-quality"
  | "engaged"
  | "visit-frequency"
  | "application-details"
  | "application-type"
  | "application-status"
  | "application-match"
  | "application-month"
  | "model-release"
  | "assistance"
  | "signature"
  | "age-band"
  | "home-state"
  | "home-city"
  | "field-present"
  | "field-missing"
  | "staff"
  | "wsu-affiliation"
  | "privacy-info";

export type ExploreQuery = {
  id: string;
  kind: ExploreKind;
  title: string;
  description: string;
  value?: string | boolean;
  field?: keyof ApplicationFieldFlags;
  privacyNote?: string;
};

export type DashboardTab =
  | "overview"
  | "membership"
  | "engagement"
  | "applications"
  | "people"
  | "quality"
  | "members";
