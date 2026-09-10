#!/usr/bin/env python3
"""Build privacy-aware GoCreate analytics JSON from the master CSV + enrichment XLSX.

The workbook in this project is intentionally parsed with Python's standard library because
its export is a minimal XLSX package (inline strings, no sharedStrings/workbook metadata).
No third-party Python packages are required.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
MASTER_PATH = ROOT / "data/source/gocreate-master-2026-09-09.csv"
DETAILS_PATH = ROOT / "data/source/gocreate_membership_details.xlsx"
ANALYTICS_DIR = ROOT / "data/analytics"
PRIVATE_DIR = ROOT / "data/private"
AS_OF = date(2026, 9, 10)
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def norm(value: Any) -> str:
    return re.sub(r"\s+", " ", text(value).lower())


def truthy(value: Any) -> bool:
    return norm(value) in {"1", "true", "yes", "y", "active", "approved"}


def num(value: Any) -> float:
    try:
        return float(text(value) or 0)
    except (ValueError, TypeError):
        return 0.0


def int_num(value: Any) -> int:
    return int(round(num(value)))


def safe_id(prefix: str, raw: str) -> str:
    return f"{prefix}_{hashlib.sha1(raw.encode('utf-8', errors='ignore')).hexdigest()[:14]}"


def column_index(cell_ref: str) -> int:
    letters = re.match(r"([A-Z]+)", cell_ref)
    if not letters:
        return 0
    result = 0
    for ch in letters.group(1):
        result = result * 26 + ord(ch) - 64
    return result - 1


def parse_minimal_xlsx_sheet(zf: ZipFile, name: str) -> list[dict[str, str]]:
    root = ET.fromstring(zf.read(name))
    rows: list[list[str]] = []
    for row in root.findall(".//m:sheetData/m:row", NS):
        cells: dict[int, str] = {}
        for cell in row.findall("m:c", NS):
            index = column_index(cell.attrib.get("r", "A1"))
            inline = cell.find("m:is", NS)
            value = cell.find("m:v", NS)
            if inline is not None:
                cell_text = "".join((node.text or "") for node in inline.findall(".//m:t", NS))
            elif value is not None:
                cell_text = value.text or ""
            else:
                cell_text = ""
            cells[index] = cell_text
        if cells:
            rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
    if not rows:
        return []
    headers = rows[0]
    return [
        {headers[i]: (row[i] if i < len(row) else "") for i in range(len(headers)) if headers[i]}
        for row in rows[1:]
    ]


def parse_xlsx(path: Path) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    with ZipFile(path) as zf:
        applications = parse_minimal_xlsx_sheet(zf, "xl/worksheets/sheet1.xml")
        contacts = parse_minimal_xlsx_sheet(zf, "xl/worksheets/sheet2.xml")
    return applications, contacts


def parse_master(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def parse_birthdate(value: str) -> date | None:
    value = text(value)
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    return None


def parse_submission(value: str) -> datetime | None:
    value = text(value)
    if not value:
        return None
    for fmt in ("%m/%d/%Y %I:%M %p", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            pass
    return None


def age_from_birthdate(value: str) -> int | None:
    born = parse_birthdate(value)
    if born is None:
        return None
    return AS_OF.year - born.year - ((AS_OF.month, AS_OF.day) < (born.month, born.day))


def age_band(value: str) -> str | None:
    age = age_from_birthdate(value)
    if age is None:
        return None
    if age < 18:
        return "Under 18"
    if age < 25:
        return "18–24"
    if age < 35:
        return "25–34"
    if age < 45:
        return "35–44"
    if age < 55:
        return "45–54"
    if age < 65:
        return "55–64"
    return "65+"


def canonical_city(value: str) -> str | None:
    raw = re.sub(r"\s+", " ", text(value))
    if not raw:
        return None
    # title() produces the most useful normalization for this dataset while retaining source detail in private records.
    return raw.title()


def canonical_state(value: str) -> str | None:
    raw = text(value)
    return raw.upper() if raw else None


def model_release_granted(app: dict[str, str] | None) -> bool | None:
    if not app:
        return None
    value = norm(app.get("model_release_list") or app.get("model_release"))
    if value in {"yes", "i hearby grant permission", "i hereby grant permission"}:
        return True
    if value in {"no", "i hearby do not grant permission", "i hereby do not grant permission"}:
        return False
    return None


def application_field_flags(app: dict[str, str] | None) -> dict[str, bool] | None:
    if not app:
        return None
    return {
        "member_name": bool(text(app.get("member_name"))),
        "email": bool(text(app.get("email"))),
        "primary_phone": bool(text(app.get("primary_phone"))),
        "birthdate": bool(text(app.get("birthdate"))),
        "home_city": bool(text(app.get("home_city"))),
        "home_state": bool(text(app.get("home_state"))),
        "membership_type_list": bool(text(app.get("membership_type_list"))),
        "model_release_list": bool(text(app.get("model_release_list"))),
        "submitted_on": bool(text(app.get("submitted_on"))),
        "signature_present": bool(text(app.get("signature_present"))),
        "badge_id": bool(text(app.get("badge_id"))),
    }


def distribution(rows: list[dict[str, Any]], key: str, blank: str = "Unspecified") -> list[dict[str, Any]]:
    counts = Counter(text(row.get(key)) or blank for row in rows)
    return [{"name": name, "value": value} for name, value in counts.most_common()]


def json_write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    master = parse_master(MASTER_PATH)
    applications, contacts = parse_xlsx(DETAILS_PATH)

    contacts_by_source: dict[str, list[dict[str, str]]] = defaultdict(list)
    for contact in contacts:
        contacts_by_source[text(contact.get("source_key"))].append(contact)

    # Match each application independently so repeat applications become history instead of duplicates.
    master_email_index: dict[str, list[int]] = defaultdict(list)
    master_name_index: dict[str, list[int]] = defaultdict(list)
    for index, row in enumerate(master):
        if norm(row.get("email")):
            master_email_index[norm(row.get("email"))].append(index)
        if norm(row.get("displayName")):
            master_name_index[norm(row.get("displayName"))].append(index)

    apps_by_master: dict[int, list[dict[str, str]]] = defaultdict(list)
    matched_source_keys: set[str] = set()
    unmatched_apps: list[dict[str, str]] = []
    for app in applications:
        candidates = master_email_index.get(norm(app.get("email")), [])
        if not candidates:
            candidates = master_name_index.get(norm(app.get("member_name")), [])
        if candidates:
            apps_by_master[candidates[0]].append(app)
            matched_source_keys.add(text(app.get("source_key")))
        else:
            unmatched_apps.append(app)

    safe_members: list[dict[str, Any]] = []
    private_members: list[dict[str, Any]] = []
    member_id_by_index: dict[int, str] = {}

    for index, row in enumerate(master):
        apps_for_member = apps_by_master.get(index, [])
        app = max(
            apps_for_member,
            key=lambda item: parse_submission(item.get("submitted_on", "")) or datetime.min,
            default=None,
        )

        raw_key = text(row.get("recordKey")) or text(row.get("customerId")) or f"row-{index}-{norm(row.get('email'))}-{norm(row.get('displayName'))}"
        member_id = safe_id("m", raw_key)
        member_id_by_index[index] = member_id
        membership_status = norm(row.get("membershipStatus")) or "unknown"
        membership_type = text(row.get("membershipType")) or "Unspecified"
        visits = int_num(row.get("visitsInRange"))
        total_visits = int_num(row.get("totalVisits"))
        guests = int_num(row.get("hostedGuestsInRange"))
        app_type = text(app.get("membership_type_list")) if app else None
        app_status = text(app.get("application_status_list")) if app else None
        assistance = None
        if app:
            assistance_value = norm(app.get("assistance_tab"))
            assistance = assistance_value.startswith("with membership assistance") or norm(app_type) == "membership assistance"

        summary = {
            "id": member_id,
            "displayName": text(row.get("displayName")) or (text(app.get("member_name")) if app else "Unnamed member"),
            "isMasterMember": True,
            "sourceOrigin": "master",
            "membershipStatus": membership_status,
            "membershipType": membership_type,
            "studentAffiliation": text(row.get("studentAffiliation")) or "Unknown",
            "dataQualityStatus": text(row.get("dataQualityStatus")) or "unknown",
            "isEmployee": truthy(row.get("employeeInRange")) or membership_status == "staff",
            "active": membership_status in {"approved", "staff"},
            "doorAccessDesired": truthy(row.get("doorAccess")),
            "visitsInRange": visits,
            "totalVisits": total_visits,
            "hostedGuestsInRange": guests,
            "membershipSubmittedAt": text(row.get("membershipSubmissionDate")) or None,
            "membershipExpiresAt": text(row.get("membershipExpiration")) or None,
            "lastActivityAt": text(row.get("lastActivityDate")) or None,
            "lastVisitAt": text(row.get("lastMemberVisitDate")) or None,
            "amountPaid": num(row.get("amountPaid")),
            "hasApplicationDetails": bool(apps_for_member),
            "applicationCount": len(apps_for_member),
            "applicationMembershipType": app_type,
            "applicationStatus": app_status,
            "modelReleaseGranted": model_release_granted(app),
            "assistanceRequested": assistance,
            "ageBand": age_band(app.get("birthdate", "")) if app else None,
            "homeCity": canonical_city(app.get("home_city", "")) if app else None,
            "homeState": canonical_state(app.get("home_state", "")) if app else None,
            "signaturePresent": truthy(app.get("signature_present")) if app and text(app.get("signature_present")) else None,
            "applicationSubmittedAt": (parse_submission(app.get("submitted_on", "")).isoformat() if app and parse_submission(app.get("submitted_on", "")) else None),
            "applicationFields": application_field_flags(app),
        }
        safe_members.append(summary)

        emergency = contacts_by_source.get(text(app.get("source_key")) if app else "", [])
        private_members.append({
            **summary,
            "recordKey": raw_key,
            "email": text(row.get("email")) or (text(app.get("email")) if app else None),
            "phone": text(row.get("phone")) or (text(app.get("primary_phone")) if app else None),
            "customerId": text(row.get("customerId")) or None,
            "membershipDescription": text(row.get("membershipDescription")) or None,
            "applicationCount": len(apps_for_member),
            "application": None if not app else {
                "sourceKey": text(app.get("source_key")),
                "submittedOn": text(app.get("submitted_on")) or None,
                "birthdate": text(app.get("birthdate")) or None,
                "age": age_from_birthdate(app.get("birthdate", "")),
                "homeAddressStreet": text(app.get("home_address_street")) or None,
                "homeCity": text(app.get("home_city")) or None,
                "homeState": text(app.get("home_state")) or None,
                "homeZip": text(app.get("home_zip")) or None,
                "primaryPhone": text(app.get("primary_phone")) or None,
                "otherPhone": text(app.get("other_phone")) or None,
                "membershipType": text(app.get("membership_type_list")) or None,
                "applicationStatus": text(app.get("application_status_list")) or None,
                "modelRelease": text(app.get("model_release_list")) or None,
                "signaturePresent": truthy(app.get("signature_present")),
                "badgeId": text(app.get("badge_id")) or None,
                "assistanceTab": text(app.get("assistance_tab")) or None,
                "selectedEmployer": text(app.get("selected_employer")) or None,
                "medicalAlertOnFile": bool(text(app.get("medical_alerts"))),
                "emergencyContacts": [
                    {
                        "contactNumber": text(contact.get("contact_number")) or None,
                        "fullName": text(contact.get("full_name")) or None,
                        "relationship": text(contact.get("relationship")) or None,
                        "primaryPhone": text(contact.get("primary_phone")) or None,
                        "otherPhone": text(contact.get("other_phone")) or None,
                        "streetAddress": text(contact.get("street_address")) or None,
                        "city": text(contact.get("city")) or None,
                        "state": text(contact.get("state")) or None,
                        "zip": text(contact.get("zip_code")) or None,
                        "country": text(contact.get("country")) or None,
                    }
                    for contact in emergency
                ],
            },
            "applicationHistory": [
                {
                    "sourceKey": text(history.get("source_key")),
                    "submittedOn": text(history.get("submitted_on")) or None,
                    "membershipType": text(history.get("membership_type_list")) or None,
                    "applicationStatus": text(history.get("application_status_list")) or None,
                    "modelRelease": text(history.get("model_release_list")) or None,
                    "assistanceTab": text(history.get("assistance_tab")) or None,
                }
                for history in sorted(
                    apps_for_member,
                    key=lambda item: parse_submission(item.get("submitted_on", "")) or datetime.min,
                    reverse=True,
                )
            ],
        })

    for app in unmatched_apps:
        member_id = safe_id("a", text(app.get("source_key")) or text(app.get("email")) or text(app.get("member_name")))
        app_type = text(app.get("membership_type_list")) or "Unspecified"
        assistance_value = norm(app.get("assistance_tab"))
        submitted = parse_submission(app.get("submitted_on", ""))
        summary = {
            "id": member_id,
            "displayName": text(app.get("member_name")) or "Application-only person",
            "isMasterMember": False,
            "sourceOrigin": "application-only",
            "membershipStatus": "application-only",
            "membershipType": app_type,
            "studentAffiliation": "WSU / WSU Tech (application)" if "wsu" in norm(app_type) else "Unknown",
            "dataQualityStatus": "application-only",
            "isEmployee": False,
            "active": False,
            "doorAccessDesired": False,
            "visitsInRange": 0,
            "totalVisits": 0,
            "hostedGuestsInRange": 0,
            "membershipSubmittedAt": None,
            "membershipExpiresAt": None,
            "lastActivityAt": None,
            "lastVisitAt": None,
            "amountPaid": 0,
            "hasApplicationDetails": True,
            "applicationCount": 1,
            "applicationMembershipType": app_type,
            "applicationStatus": text(app.get("application_status_list")) or None,
            "modelReleaseGranted": model_release_granted(app),
            "assistanceRequested": assistance_value.startswith("with membership assistance") or norm(app_type) == "membership assistance",
            "ageBand": age_band(app.get("birthdate", "")),
            "homeCity": canonical_city(app.get("home_city", "")),
            "homeState": canonical_state(app.get("home_state", "")),
            "signaturePresent": truthy(app.get("signature_present")) if text(app.get("signature_present")) else None,
            "applicationSubmittedAt": submitted.isoformat() if submitted else None,
            "applicationFields": application_field_flags(app),
        }
        safe_members.append(summary)
        emergency = contacts_by_source.get(text(app.get("source_key")), [])
        private_members.append({
            **summary,
            "recordKey": None,
            "email": text(app.get("email")) or None,
            "phone": text(app.get("primary_phone")) or None,
            "customerId": None,
            "membershipDescription": None,
            "applicationCount": 1,
            "application": {
                "sourceKey": text(app.get("source_key")),
                "submittedOn": text(app.get("submitted_on")) or None,
                "birthdate": text(app.get("birthdate")) or None,
                "age": age_from_birthdate(app.get("birthdate", "")),
                "homeAddressStreet": text(app.get("home_address_street")) or None,
                "homeCity": text(app.get("home_city")) or None,
                "homeState": text(app.get("home_state")) or None,
                "homeZip": text(app.get("home_zip")) or None,
                "primaryPhone": text(app.get("primary_phone")) or None,
                "otherPhone": text(app.get("other_phone")) or None,
                "membershipType": app_type,
                "applicationStatus": text(app.get("application_status_list")) or None,
                "modelRelease": text(app.get("model_release_list")) or None,
                "signaturePresent": truthy(app.get("signature_present")),
                "badgeId": text(app.get("badge_id")) or None,
                "assistanceTab": text(app.get("assistance_tab")) or None,
                "selectedEmployer": text(app.get("selected_employer")) or None,
                "medicalAlertOnFile": bool(text(app.get("medical_alerts"))),
                "emergencyContacts": [
                    {
                        "contactNumber": text(contact.get("contact_number")) or None,
                        "fullName": text(contact.get("full_name")) or None,
                        "relationship": text(contact.get("relationship")) or None,
                        "primaryPhone": text(contact.get("primary_phone")) or None,
                        "otherPhone": text(contact.get("other_phone")) or None,
                        "streetAddress": text(contact.get("street_address")) or None,
                        "city": text(contact.get("city")) or None,
                        "state": text(contact.get("state")) or None,
                        "zip": text(contact.get("zip_code")) or None,
                        "country": text(contact.get("country")) or None,
                    }
                    for contact in emergency
                ],
            },
            "applicationHistory": [
                {
                    "sourceKey": text(app.get("source_key")),
                    "submittedOn": text(app.get("submitted_on")) or None,
                    "membershipType": app_type,
                    "applicationStatus": text(app.get("application_status_list")) or None,
                    "modelRelease": text(app.get("model_release_list")) or None,
                    "assistanceTab": text(app.get("assistance_tab")) or None,
                }
            ],
        })

    source_to_member_id: dict[str, str] = {}
    for master_index, history in apps_by_master.items():
        for app in history:
            source_to_member_id[text(app.get("source_key"))] = member_id_by_index[master_index]
    for app in unmatched_apps:
        source_to_member_id[text(app.get("source_key"))] = safe_id(
            "a", text(app.get("source_key")) or text(app.get("email")) or text(app.get("member_name"))
        )

    safe_applications = []
    for app in applications:
        source_key = text(app.get("source_key"))
        submitted = parse_submission(app.get("submitted_on", ""))
        safe_applications.append({
            "id": safe_id("app", source_key or f"{app.get('email')}-{app.get('submitted_on')}"),
            "memberId": source_to_member_id.get(source_key),
            "memberName": text(app.get("member_name")) or "Unnamed applicant",
            "submittedAt": submitted.isoformat() if submitted else None,
            "membershipType": text(app.get("membership_type_list")) or "Unspecified",
            "applicationStatus": text(app.get("application_status_list")) or "Unspecified",
            "modelReleaseGranted": model_release_granted(app),
            "assistanceRequested": norm(app.get("assistance_tab")).startswith("with membership assistance")
                or norm(app.get("membership_type_list")) == "membership assistance",
            "signaturePresent": truthy(app.get("signature_present")) if text(app.get("signature_present")) else None,
            "ageBand": age_band(app.get("birthdate", "")),
            "homeCity": canonical_city(app.get("home_city", "")),
            "homeState": canonical_state(app.get("home_state", "")),
            "isMatchedToMaster": source_key in matched_source_keys,
            "fields": application_field_flags(app),
        })

    master_summaries = [m for m in safe_members if m["isMasterMember"]]
    enriched = [m for m in safe_members if m["hasApplicationDetails"]]

    field_defs = [
        ("member_name", "Member name", "identity"),
        ("email", "Email", "private"),
        ("primary_phone", "Primary phone", "private"),
        ("birthdate", "Birthdate", "sensitive"),
        ("home_city", "Home city", "aggregate-safe"),
        ("home_state", "Home state", "aggregate-safe"),
        ("membership_type_list", "Membership selection", "aggregate-safe"),
        ("model_release_list", "Model release", "aggregate-safe"),
        ("submitted_on", "Submission date", "aggregate-safe"),
        ("signature_present", "Signature present", "aggregate-safe"),
        ("badge_id", "Badge ID", "private"),
        ("medical_alerts", "Medical alert field", "sensitive"),
    ]
    completeness = []
    for key, label, sensitivity in field_defs:
        count = sum(1 for app in applications if text(app.get(key)))
        completeness.append({
            "key": key,
            "label": label,
            "count": count,
            "missing": len(applications) - count,
            "total": len(applications),
            "percent": round((count / len(applications) * 100) if applications else 0, 1),
            "sensitivity": sensitivity,
            "exploreSafe": key != "medical_alerts",
        })

    submission_months: Counter[str] = Counter()
    for app in applications:
        dt = parse_submission(app.get("submitted_on", ""))
        if dt:
            submission_months[dt.strftime("%Y-%m")] += 1
    submission_timeline = [
        {"month": key, "label": datetime.strptime(key, "%Y-%m").strftime("%b %Y"), "value": submission_months[key]}
        for key in sorted(submission_months)
    ]

    visit_buckets = Counter()
    for member in master_summaries:
        visits = member["visitsInRange"]
        bucket = "0 visits" if visits == 0 else "1 visit" if visits == 1 else "2–4 visits" if visits <= 4 else "5–9 visits" if visits <= 9 else "10+ visits"
        visit_buckets[bucket] += 1
    bucket_order = ["0 visits", "1 visit", "2–4 visits", "5–9 visits", "10+ visits"]

    approved = sum(m["membershipStatus"] == "approved" for m in master_summaries)
    staff = sum(m["membershipStatus"] == "staff" for m in master_summaries)
    engaged = sum(m["visitsInRange"] > 0 for m in master_summaries)
    visit_total = sum(m["visitsInRange"] for m in master_summaries)
    guest_total = sum(m["hostedGuestsInRange"] for m in master_summaries)
    quarantined = sum(m["dataQualityStatus"] == "quarantined" for m in master_summaries)
    model_yes = sum(model_release_granted(app) is True for app in applications)
    model_no = sum(model_release_granted(app) is False for app in applications)
    assistance = sum(
        norm(app.get("assistance_tab")).startswith("with membership assistance")
        or norm(app.get("membership_type_list")) == "membership assistance"
        for app in applications
    )
    signed = sum(truthy(app.get("signature_present")) for app in applications)

    dashboard = {
        "meta": {
            "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
            "dataAsOf": AS_OF.isoformat(),
            "masterFile": MASTER_PATH.name,
            "enrichmentFile": DETAILS_PATH.name,
            "masterRows": len(master),
            "knownPeople": len(safe_members),
            "applicationRows": len(applications),
            "emergencyContactRows": len(contacts),
            "matchedApplications": len(applications) - len(unmatched_apps),
            "distinctEnrichedMembers": len(apps_by_master),
            "unmatchedApplications": len(unmatched_apps),
            "enrichmentCoveragePercent": round((len(applications) - len(unmatched_apps)) / len(applications) * 100, 1) if applications else 0,
        },
        "overview": {
            "masterMembers": len(master_summaries),
            "knownPeople": len(safe_members),
            "approvedMembers": approved,
            "staffMembers": staff,
            "engagedMembers": engaged,
            "observedVisits": visit_total,
            "hostedGuests": guest_total,
            "applicationDetails": len(applications),
            "quarantinedRecords": quarantined,
            "modelReleaseYes": model_yes,
            "modelReleaseNo": model_no,
            "assistanceRequests": assistance,
            "signedApplications": signed,
        },
        "membershipStatus": distribution(master_summaries, "membershipStatus"),
        "membershipType": distribution(master_summaries, "membershipType"),
        "studentAffiliation": distribution(master_summaries, "studentAffiliation"),
        "applicationMembershipType": distribution(applications, "membership_type_list"),
        "applicationStatus": distribution(applications, "application_status_list"),
        "ageBands": distribution([{"ageBand": age_band(a.get("birthdate", "")) or "Unknown"} for a in applications], "ageBand"),
        "homeStates": distribution([{"homeState": canonical_state(a.get("home_state", "")) or "Unknown"} for a in applications], "homeState"),
        "homeCities": distribution([{"homeCity": canonical_city(a.get("home_city", "")) or "Unknown"} for a in applications], "homeCity"),
        "modelRelease": [
            {"name": "Granted", "value": model_yes},
            {"name": "Not granted", "value": model_no},
        ],
        "visitFrequency": [{"name": key, "value": visit_buckets[key]} for key in bucket_order],
        "submissionTimeline": submission_timeline,
        "fieldCompleteness": completeness,
        "unmatchedApplications": [
            {
                "id": safe_id("a", text(a.get("source_key")) or text(a.get("email")) or text(a.get("member_name"))),
                "displayName": text(a.get("member_name")) or "Application-only person",
                "membershipType": text(a.get("membership_type_list")) or "Unspecified",
                "homeCity": canonical_city(a.get("home_city", "")),
                "homeState": canonical_state(a.get("home_state", "")),
            }
            for a in unmatched_apps
        ],
    }

    ANALYTICS_DIR.mkdir(parents=True, exist_ok=True)
    PRIVATE_DIR.mkdir(parents=True, exist_ok=True)
    json_write(ANALYTICS_DIR / "dashboard.json", dashboard)
    json_write(ANALYTICS_DIR / "members.json", safe_members)
    json_write(ANALYTICS_DIR / "applications.json", safe_applications)
    json_write(PRIVATE_DIR / "member-details.json", {member["id"]: member for member in private_members})

    print(f"Generated dashboard for {len(master_summaries):,} master members + {len(unmatched_apps):,} application-only people")
    print(f"Application enrichment: {len(applications) - len(unmatched_apps):,}/{len(applications):,} rows matched across {len(apps_by_master):,} distinct master members ({dashboard['meta']['enrichmentCoveragePercent']}%)")
    print(f"Safe member payload: {(ANALYTICS_DIR / 'members.json').stat().st_size / 1024:.1f} KB")
    print(f"Safe application payload: {(ANALYTICS_DIR / 'applications.json').stat().st_size / 1024:.1f} KB")
    print(f"Private detail payload: {(PRIVATE_DIR / 'member-details.json').stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
