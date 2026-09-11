#!/usr/bin/env python3
"""Merge preprocessed handwritten/manual sign-in events into GoCreate analytics.

This does not pretend the tracker export contains event history. It keeps tracker totals and manual
sign-ins as separate sources, then adds conservative per-member combined-minimum counts only for
high-confidence manual matches. Ambiguous scan rows remain in the review queue.
"""
from __future__ import annotations
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANALYTICS = ROOT / "data/analytics"
PRIVATE = ROOT / "data/private"

manual_path = ANALYTICS / "manual-visits.json"
members_path = ANALYTICS / "members.json"
dashboard_path = ANALYTICS / "dashboard.json"
private_path = PRIVATE / "member-details.json"

if not manual_path.exists():
    raise SystemExit("manual-visits.json is missing. Run scripts/prepare_manual_visits.py first.")

manual = json.loads(manual_path.read_text(encoding="utf-8"))
members = json.loads(members_path.read_text(encoding="utf-8"))
dashboard = json.loads(dashboard_path.read_text(encoding="utf-8"))
private = json.loads(private_path.read_text(encoding="utf-8")) if private_path.exists() else {}
events = manual.get("events", [])
meta = manual.get("meta", {})

matched = [event for event in events if event.get("classification") == "member" and event.get("memberId")]
by_member = defaultdict(list)
for event in matched:
    by_member[event["memberId"]].append(event)

for member in members:
    tracker = int(member.get("visitsInRange") or 0)
    rows = by_member.get(member["id"], [])
    exact_dupes = sum(bool(row.get("possibleExactTrackerDuplicate")) for row in rows)
    manual_count = len(rows)
    dated = [row.get("visitDate") for row in rows if row.get("visitDate")]
    member["trackerVisits"] = tracker
    member["manualVisits"] = manual_count
    member["manualDatedVisits"] = len(dated)
    member["manualVisitLastAt"] = max(dated) if dated else None
    member["manualTrackerOverlapRows"] = sum(bool(row.get("trackerCoverageOverlap")) for row in rows)
    member["combinedObservedVisitsMinimum"] = max(0, tracker + manual_count - exact_dupes)
    member["activitySources"] = [source for source, present in (("tracker", tracker > 0), ("manual", manual_count > 0)) if present]
    if member["id"] in private:
        private[member["id"]].update({
            "trackerVisits": member["trackerVisits"],
            "manualVisits": member["manualVisits"],
            "manualDatedVisits": member["manualDatedVisits"],
            "manualVisitLastAt": member["manualVisitLastAt"],
            "manualTrackerOverlapRows": member["manualTrackerOverlapRows"],
            "combinedObservedVisitsMinimum": member["combinedObservedVisitsMinimum"],
            "activitySources": member["activitySources"],
        })

tracker_total = sum(int(member.get("trackerVisits") or 0) for member in members if member.get("isMasterMember"))
manual_member = sum(event.get("classification") == "member" for event in events)
exact_dupes = sum(bool(event.get("possibleExactTrackerDuplicate")) for event in events if event.get("classification") == "member")
manual_guest = sum(event.get("classification") == "guest" for event in events)
manual_review = sum(event.get("classification") == "review" for event in events)
manual_unreadable = sum(event.get("classification") == "unreadable" for event in events)

# Add source-aware reporting metadata without changing the original tracker totals.
dashboard.setdefault("meta", {}).update({
    "manualScanPages": meta.get("uniqueScanPages", 0),
    "duplicateManualScansIgnored": meta.get("duplicateScansIgnored", 0),
    "manualSignInRows": meta.get("signInRowsDetected", len(events)),
    "manualDatedRows": meta.get("datedRows", 0),
    "manualUnknownDateRows": meta.get("unknownDateRows", 0),
    "manualDateMin": meta.get("manualDateMin"),
    "manualDateMax": meta.get("manualDateMax"),
    "trackerCoverageStart": meta.get("trackerCoverageStart"),
    "trackerCoverageEnd": meta.get("trackerCoverageEnd"),
    "manualRowsInsideTrackerCoverage": meta.get("manualRowsInsideTrackerCoverage", 0),
    "manualRowsBeforeTrackerCoverage": meta.get("manualRowsBeforeTrackerCoverage", 0),
    "manualPossibleExactTrackerDuplicates": meta.get("possibleExactTrackerDuplicates", 0),
})
dashboard.setdefault("overview", {}).update({
    "trackerVisits": tracker_total,
    "manualMemberVisits": manual_member,
    "manualGuestVisits": manual_guest,
    "manualReviewRows": manual_review,
    "manualUnreadableRows": manual_unreadable,
    "manualAttendanceRows": len(events),
    "combinedMemberVisitsMinimum": max(0, tracker_total + manual_member - exact_dupes),
})

# A source-aware frequency view is useful for rankings, while the original tracker-only frequency
# remains preserved as visitFrequency.
combined_buckets = Counter()
for member in members:
    if not member.get("isMasterMember"):
        continue
    value = int(member.get("combinedObservedVisitsMinimum") or 0)
    bucket = "0 visits" if value == 0 else "1 visit" if value == 1 else "2–4 visits" if value <= 4 else "5–9 visits" if value <= 9 else "10+ visits"
    combined_buckets[bucket] += 1
dashboard["combinedVisitFrequency"] = [
    {"name": key, "value": combined_buckets[key]}
    for key in ["0 visits", "1 visit", "2–4 visits", "5–9 visits", "10+ visits"]
]

members_path.write_text(json.dumps(members, indent=2, ensure_ascii=False), encoding="utf-8")
dashboard_path.write_text(json.dumps(dashboard, indent=2, ensure_ascii=False), encoding="utf-8")
if private_path.exists():
    private_path.write_text(json.dumps(private, indent=2, ensure_ascii=False), encoding="utf-8")

print(json.dumps({
    "trackerVisits": tracker_total,
    "manualMemberVisits": manual_member,
    "manualGuestVisits": manual_guest,
    "manualReviewRows": manual_review,
    "manualUnreadableRows": manual_unreadable,
    "manualAttendanceRows": len(events),
}, indent=2))
