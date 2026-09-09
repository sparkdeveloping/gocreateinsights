export type MemberSummary = {
  id: string;
  displayName: string | null;
  membershipStatus: string | null;
  membershipType: string | null;
  studentAffiliation: string | null;
  dataQualityStatus: string | null;
  isEmployee: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  active: boolean;
  doorAccessDesired: boolean;
  doorAccessSource: string | null;
  visitsInRange: number;
  totalVisits: number;
  lastVisitAt: string | null;
  hostedGuestsInRange: number;
  membershipSubmittedAt: string | null;
  membershipExpiresAt: string | null;
  membershipSource: string | null;
};

export type MemberDetail = MemberSummary & {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  badgeNumber: number | null;
  dataQualityReason: string | null;
  membershipStatusRaw: string | null;
  membershipTypeRaw: string | null;
  membershipTypes: string | null;
  gender: string | null;
  age: number | null;
  ageBand: string | null;
  staffRole: string | null;
  primaryArea: string | null;
  adminRole: string | null;
  autoPay: string | null;
  paymentStatus: number | null;
  paymentPlan: number | null;
  amountPaid: number | null;
};

export type DashboardPayload = {
  members: MemberSummary[];
  meta: {
    sourceFile: string;
    generatedAt: string;
    rowCount: number;
    columnCount: number;
  };
};
