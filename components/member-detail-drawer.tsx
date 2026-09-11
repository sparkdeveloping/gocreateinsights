"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon, CloseIcon, InfoIcon, LockIcon } from "@/components/icons";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import type { MemberDetail } from "@/lib/types";

type Props = {
  memberId: string | null;
  onClose: () => void;
};

function DetailItem({ label, value, muted = false }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong className={muted ? "muted-value" : undefined}>{value || "—"}</strong>
    </div>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "good" | "warn" | "neutral" | "blue" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export default function MemberDetailDrawer({ memberId, onClose }: Props) {
  const reduced = useReducedMotion();
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!memberId) {
      setDetail(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    setHistoryOpen(false);
    fetch(`/api/member/${encodeURIComponent(memberId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Member detail could not be loaded.");
        return response.json();
      })
      .then(setDetail)
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason?.message || "Member detail could not be loaded.");
      });
    return () => controller.abort();
  }, [memberId]);

  return (
    <AnimatePresence>
      {memberId && (
        <motion.aside
          className="member-detail-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={detail ? `${detail.displayName} detail` : "Member detail"}
          initial={{ x: reduced ? 0 : "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: reduced ? 0 : "100%", opacity: 0 }}
          transition={{ type: reduced ? "tween" : "spring", stiffness: 360, damping: 36 }}
        >
          <header className="detail-header">
            <button className="icon-button" onClick={onClose} aria-label="Close member detail"><CloseIcon /></button>
            <div className="detail-header-title">Member detail</div>
            {detail?.piiMode === "masked" && <StatusPill tone="blue"><LockIcon /> Public-safe</StatusPill>}
          </header>

          {!detail && !error ? (
            <div className="detail-loading">
              <div className="skeleton-avatar" />
              <div className="skeleton-line wide" />
              <div className="skeleton-line" />
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
          ) : error ? (
            <div className="drawer-empty"><InfoIcon /><h3>Could not load this record</h3><p>{error}</p></div>
          ) : detail ? (
            <div className="detail-scroll soft-scrollbar">
              <section className="member-hero">
                <motion.div layoutId={`member-avatar-${detail.id}`} className="member-avatar large">
                  {detail.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                </motion.div>
                <div>
                  <div className="eyebrow">{detail.isMasterMember ? "Master member" : "Application-only person"}</div>
                  <h2>{detail.displayName}</h2>
                  <div className="hero-pills">
                    <StatusPill tone={detail.active ? "good" : "neutral"}>{humanize(detail.membershipStatus)}</StatusPill>
                    {detail.hasApplicationDetails && <StatusPill tone="blue">{detail.applicationCount} application{detail.applicationCount === 1 ? "" : "s"}</StatusPill>}
                    {detail.dataQualityStatus === "quarantined" && <StatusPill tone="warn">Quality attention</StatusPill>}
                  </div>
                </div>
              </section>

              {detail.piiMode === "masked" && (
                <div className="privacy-banner">
                  <LockIcon />
                  <div><strong>Private values are masked on this deployment.</strong><span>Set <code>GOCREATE_PII_MODE=full</code> only behind access control to reveal contact/application PII.</span></div>
                </div>
              )}

              <section className="detail-section">
                <div className="detail-section-title"><span>Membership</span><small>Current master record</small></div>
                <div className="detail-grid">
                  <DetailItem label="Status" value={humanize(detail.membershipStatus)} />
                  <DetailItem label="Type" value={detail.membershipType} />
                  <DetailItem label="Tracker visits" value={detail.trackerVisits.toLocaleString()} />
                  <DetailItem label="Matched manual visits" value={detail.manualVisits.toLocaleString()} />
                  <DetailItem label="Observed minimum" value={detail.combinedObservedVisitsMinimum.toLocaleString()} />
                  <DetailItem label="Hosted guests (tracker)" value={detail.hostedGuestsInRange.toLocaleString()} />
                  <DetailItem label="Last manual visit" value={formatDateTime(detail.manualVisitLastAt)} />
                  <DetailItem label="Student affiliation" value={detail.studentAffiliation} />
                  <DetailItem label="Data quality" value={humanize(detail.dataQualityStatus)} />
                </div>
              </section>

              <section className="detail-section">
                <div className="detail-section-title"><span>Contact</span><small>{detail.piiMode === "masked" ? "Masked" : "Protected view"}</small></div>
                <div className="detail-grid">
                  <DetailItem label="Email" value={detail.email} muted={detail.piiMode === "masked"} />
                  <DetailItem label="Phone" value={detail.phone} muted={detail.piiMode === "masked"} />
                </div>
              </section>

              {detail.application && (
                <section className="detail-section">
                  <div className="detail-section-title"><span>Latest application</span><small>{formatDateTime(detail.application.submittedOn)}</small></div>
                  <div className="detail-grid">
                    <DetailItem label="Requested membership" value={detail.application.membershipType} />
                    <DetailItem label="Portal status" value={detail.application.applicationStatus} />
                    <DetailItem label="Age" value={detail.application.age != null ? `${detail.application.age} (${detail.ageBand ?? "band unknown"})` : detail.ageBand} />
                    <DetailItem label="Birthdate" value={detail.application.birthdate} muted={detail.piiMode === "masked"} />
                    <DetailItem label="Location" value={[detail.application.homeCity, detail.application.homeState].filter(Boolean).join(", ")} />
                    <DetailItem label="Street" value={detail.application.homeAddressStreet} muted={detail.piiMode === "masked"} />
                    <DetailItem label="Model release" value={detail.modelReleaseGranted === null ? "Unknown" : detail.modelReleaseGranted ? "Granted" : "Not granted"} />
                    <DetailItem label="Signature" value={detail.application.signaturePresent ? <span className="inline-good"><CheckIcon /> Present</span> : "Not recorded"} />
                    <DetailItem label="Assistance" value={detail.assistanceRequested ? "Requested" : "Not requested"} />
                    {detail.assistanceQuestionnaireAvailable && <DetailItem label="Assistance questionnaire" value={`${detail.assistanceResponseCount} captured response${detail.assistanceResponseCount === 1 ? "" : "s"}`} />}
                    {detail.assistanceReason && <DetailItem label="Assistance reason category" value={detail.assistanceReason} />}
                    {detail.smallBusinessReference && <DetailItem label="Business signal" value={detail.smallBusinessLabels.join(", ") || "Detected"} />}
                    {detail.nonprofitReference && <DetailItem label="Nonprofit / org signal" value={detail.nonprofitLabels.join(", ") || "Detected"} />}
                    {detail.reducedRateReference && <DetailItem label="Reduced-rate signal" value={detail.reducedRateLabels.join(", ") || "Detected"} />}
                    <DetailItem label="Badge ID" value={detail.application.badgeId} muted={detail.piiMode === "masked"} />
                  </div>

                  {detail.application.medicalAlertOnFile && (
                    <div className="sensitive-presence"><LockIcon /><span>A medical-alert field exists for this application. Its contents are intentionally not returned by this dashboard API.</span></div>
                  )}
                </section>
              )}

              {(detail.applicationHistory?.length ?? 0) > 1 && (
                <section className="detail-section history-section">
                  <button className="history-toggle" onClick={() => setHistoryOpen((open) => !open)} aria-expanded={historyOpen}>
                    <div><span>Application history</span><small>{detail.applicationHistory?.length} submissions attached to this person</small></div>
                    <motion.span animate={{ rotate: historyOpen ? 180 : 0 }}><ChevronDownIcon /></motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {historyOpen && (
                      <motion.div className="history-list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        {detail.applicationHistory?.map((item, index) => (
                          <div className="history-row" key={`${item.sourceKey}-${index}`}>
                            <div className="history-dot" />
                            <div><strong>{item.membershipType || "Unspecified membership"}</strong><span>{formatDateTime(item.submittedOn)} · {item.applicationStatus || "No portal status"}</span></div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              )}

              {detail.application?.emergencyContacts?.length ? (
                <section className="detail-section">
                  <div className="detail-section-title"><span>Emergency contacts</span><small>{detail.application.emergencyContacts.length} records</small></div>
                  <div className="emergency-list">
                    {detail.application.emergencyContacts.map((contact, index) => (
                      <div className="emergency-card" key={`${contact.contactNumber}-${index}`}>
                        <div className="emergency-index">{index + 1}</div>
                        <div>
                          <strong>{contact.fullName || `Contact ${index + 1}`}</strong>
                          <span>{contact.relationship || "Relationship not recorded"}</span>
                          <small>{contact.primaryPhone || "No phone recorded"}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="detail-section detail-footnote">
                <InfoIcon />
                <p>Counts and classifications come from the current project source files. Blank source fields remain blank rather than being inferred.</p>
              </section>
            </div>
          ) : null}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
