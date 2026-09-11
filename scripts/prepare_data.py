#!/usr/bin/env python3
"""Build privacy-aware GoCreate analytics JSON from the master CSV + enrichment XLSX.

The enrichment workbook is a deliberately minimal XLSX package (inline strings and worksheet
XML only), so this script parses it with Python's standard library. Bulk analytics never expose
street addresses, phones, emails, exact birthdates, emergency contacts, or free-form notes.
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
MASTER_PATH = ROOT / "data/source/gocreate-master-2026-09-09.csv"
DETAILS_PATH = ROOT / "data/source/gocreate_membership_details.xlsx"
ANALYTICS_DIR = ROOT / "data/analytics"
PRIVATE_DIR = ROOT / "data/private"
AS_OF = date.fromisoformat(os.environ.get("GOCREATE_AS_OF", date.today().isoformat()))
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


def parse_xlsx(path: Path) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    # The scraper workbook uses inline strings and keeps stable sheet order:
    # Applications, EmergencyContacts, FamilyMembers, Parking, RawControls, Errors.
    # RawControls contains the membership-assistance questionnaire responses that are
    # not flattened into the Applications sheet. Only aggregate classifications derived
    # from those responses are emitted into browser-safe analytics.
    with ZipFile(path) as zf:
        applications = parse_minimal_xlsx_sheet(zf, "xl/worksheets/sheet1.xml")
        contacts = parse_minimal_xlsx_sheet(zf, "xl/worksheets/sheet2.xml")
        raw_controls = parse_minimal_xlsx_sheet(zf, "xl/worksheets/sheet5.xml")
    return applications, contacts, raw_controls


def enrich_applications_with_raw_controls(applications: list[dict[str, str]], raw_controls: list[dict[str, str]]) -> None:
    """Attach only analysis-safe questionnaire helpers to in-memory application rows.

    The raw free-text responses are never copied into analytics JSON. They are used only
    during generation to derive broad report categories. This is intentionally narrower
    than serializing RawControls, which also contains contact/emergency/application PII.
    """
    by_source: dict[str, dict[str, str]] = defaultdict(dict)
    signal_text: dict[str, list[str]] = defaultdict(list)
    response_count: Counter[str] = Counter()

    for control in raw_controls:
        source_key = text(control.get("source_key"))
        if not source_key:
            continue
        ident = " ".join([text(control.get("id")), text(control.get("name")), text(control.get("label"))])
        match = re.search(r"MembershipAssistanceQ([1-5])", ident, flags=re.IGNORECASE)
        if not match:
            continue
        value = text(control.get("value"))
        if not value:
            continue
        q_key = f"_assist_q{match.group(1)}"
        by_source[source_key][q_key] = value
        signal_text[source_key].append(value)
        response_count[source_key] += 1

    for app in applications:
        source_key = text(app.get("source_key"))
        if source_key in by_source:
            app.update(by_source[source_key])
            app["_report_signal_text"] = "\n".join(signal_text[source_key])
            app["_assistance_response_count"] = str(response_count[source_key])


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


def parse_iso(value: str) -> datetime | None:
    value = text(value)
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None)
    except ValueError:
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
    return raw.title() if raw else None


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


def is_assistance(app: dict[str, str]) -> bool:
    return norm(app.get("assistance_tab")).startswith("with membership assistance") or norm(app.get("membership_type_list")) == "membership assistance"


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


# Only these semantically useful fields are scanned for report signals. The scanner deliberately
# excludes contact information and source URLs so strings such as an email address cannot become
# a false "4H" or "business" match.
def report_text(app: dict[str, str]) -> str:
    selected: list[str] = []
    explicit = {
        "application_notes", "employer_name", "selected_employer", "employment_type", "_report_signal_text",
    }
    useful_header_terms = (
        "reason", "assist", "business", "organization", "nonprofit", "non_profit", "project",
        "volunteer", "church", "club", "employer", "interest", "purpose", "use_case", "usecase",
        "rate", "quilt", "community", "foundation", "ministry",
    )
    excluded_header_terms = (
        "email", "phone", "address", "birth", "name", "url", "source_key", "scrape", "zip",
    )
    for key, value in app.items():
        if not text(value):
            continue
        key_norm = norm(key).replace(" ", "_")
        if any(term in key_norm for term in excluded_header_terms) and key_norm not in explicit:
            continue
        if key_norm in explicit or any(term in key_norm for term in useful_header_terms):
            selected.append(text(value))
    return "\n".join(selected)


def matched_labels(blob: str, rules: list[tuple[str, str]]) -> list[str]:
    labels: list[str] = []
    for label, pattern in rules:
        if re.search(pattern, blob, flags=re.IGNORECASE):
            labels.append(label)
    return labels


BUSINESS_RULES = [
    ("Small business", r"\bsmall\s+business\b"),
    ("Business owner", r"\bbusiness\s+owner\b|\bown(?:ing)?\s+(?:a|my)\s+business\b"),
    ("Entrepreneur / startup", r"\bentrepreneur\w*\b|\bstart[- ]?up\b"),
    ("Starting a business", r"\bstart(?:ing)?\s+(?:a|my|new)\s+business\b|\bconsidering\s+starting\s+a\s+business\b"),
    ("Prototype / product development", r"\bprototype\b|\bproduct\s+development\b"),
    ("LLC", r"\bllc\b"),
    ("Business project", r"\bbusiness\s+project\b"),
]

NONPROFIT_RULES = [
    ("Victory in the Valley", r"\bvictory\s+in\s+the\s+valley\b"),
    ("4-H", r"(?<!\w)4\s*[- ]?\s*h(?!\w)"),
    ("Church / faith organization", r"\bchurch\b|\bministry\b|\bfaith[- ]based\b"),
    ("Nonprofit", r"\bnon[- ]?profit\b|\bnot[- ]for[- ]profit\b"),
    ("Club", r"\bclub\b"),
    ("Foundation", r"\bfoundation\b"),
    ("Association / organization", r"\bassociation\b|\bcommunity\s+organization\b"),
    ("Volunteer activity", r"\bvolunteer(?:ing)?\b"),
    ("Scouts / youth group", r"\bscout\w*\b|\byouth\s+group\b"),
]

REDUCED_RATE_RULES = [
    ("Quilter / quilting", r"\bquilt(?:er|ers|ing)?\b"),
    ("Reduced rate", r"\breduced[- ]rate\b|\breduced\s+membership\b"),
    ("Discounted rate", r"\bdiscount(?:ed)?\s+(?:rate|membership)\b"),
    ("Scholarship", r"\bscholarship\b"),
]


def assistance_reason(app: dict[str, str]) -> str | None:
    # Q1 is the free-form "what would you use GoCreate for / why assistance" response
    # in the current scraper workbook. Older exports may instead expose a named reason field.
    raw = text(app.get("_assist_q1"))
    if not raw:
        for key, value in app.items():
            key_norm = norm(key).replace(" ", "_")
            if text(value) and "reason" in key_norm and ("assist" in key_norm or "membership" in key_norm):
                raw = text(value)
                break
    if not raw:
        return None

    n = norm(raw)
    if re.search(r"\btime[- ]?sensitive\b|\bimmediate\s+access\b|\burgent\b|\bdeadline\b", n):
        return "Immediate / time-sensitive project"
    if re.search(r"\bprototype\b|\binvent(?:ion|or|ing)?\b|\bmanufacturer\b|\bproduct\s+development\b|shopping cart", n):
        return "Prototype / invention / product development"
    if re.search(r"\bbusiness\b|\bentrepreneur\w*\b|\bstart[- ]?up\b|\bretail\b|\bshop\b|\bsell(?:ing)?\b|clothing line", n):
        return "Start or grow a business"
    if re.search(r"\bquilt\w*\b|\bsew(?:ing)?\b|\btextile\w*\b|\bembroid\w*\b|longarm", n):
        return "Quilting / textiles / sewing"
    if re.search(r"\bvolunteer\w*\b|\bcharit\w*\b|\bnon[- ]?profit\b|\bchurch\b|\bcommunity\b|\bfundrais\w*\b|homeless", n):
        return "Community / nonprofit / volunteer project"
    if re.search(r"\bstudent\w*\b|\bteacher\w*\b|\bschool\b|\bclass\b|\bengineering\b|\beducat\w*\b", n):
        return "Education / student project"
    if re.search(r"\blearn\w*\b|\bskill\w*\b|\bequipment\b|\bexperience\b|\bgocreate\b|\bopportunit\w*\b|\bpersonal\b|\bproject\b|\bcreate\w*\b|\bmake\w*\b", n):
        return "Learn, create, or experience GoCreate"
    return "Other / mixed use"


def classify_application(app: dict[str, str]) -> dict[str, Any]:
    blob = report_text(app)
    business = matched_labels(blob, BUSINESS_RULES)
    nonprofit = matched_labels(blob, NONPROFIT_RULES)
    reduced = matched_labels(blob, REDUCED_RATE_RULES)
    return {
        "assistanceReason": assistance_reason(app),
        "assistanceResponseCount": int_num(app.get("_assistance_response_count")),
        "assistanceQuestionnaireAvailable": int_num(app.get("_assistance_response_count")) > 0,
        "smallBusinessReference": bool(business),
        "smallBusinessLabels": business,
        "nonprofitReference": bool(nonprofit),
        "nonprofitLabels": nonprofit,
        "reducedRateReference": bool(reduced),
        "reducedRateLabels": reduced,
    }


def merge_labels(items: Iterable[list[str]]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for labels in items:
        for label in labels:
            if label not in seen:
                seen.add(label)
                merged.append(label)
    return merged


def distribution(rows: list[dict[str, Any]], key: str, blank: str = "Unspecified") -> list[dict[str, Any]]:
    counts = Counter(text(row.get(key)) or blank for row in rows)
    return [{"name": name, "value": value} for name, value in counts.most_common()]


def json_write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def iso_range(values: Iterable[datetime | None]) -> tuple[str | None, str | None]:
    actual = sorted(v for v in values if v is not None)
    if not actual:
        return None, None
    return actual[0].date().isoformat(), actual[-1].date().isoformat()


def student_affiliation_from_app(app: dict[str, str]) -> str:
    membership_type = norm(app.get("membership_type_list"))
    email = norm(app.get("email"))
    if "wsu" in membership_type or "wichita.edu" in email or "shockers.wichita.edu" in email:
        return "WSU / WSU Tech (unspecified)"
    return "Unknown"


def main() -> None:
    master = parse_master(MASTER_PATH)
    applications, contacts, raw_controls = parse_xlsx(DETAILS_PATH)
    enrich_applications_with_raw_controls(applications, raw_controls)
    app_classification = {text(app.get("source_key")): classify_application(app) for app in applications}

    contacts_by_source: dict[str, list[dict[str, str]]] = defaultdict(list)
    for contact in contacts:
        contacts_by_source[text(contact.get("source_key"))].append(contact)

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

    def refs_for_apps(app_rows: list[dict[str, str]]) -> dict[str, Any]:
        classifications = [app_classification.get(text(a.get("source_key")), {}) for a in app_rows]
        assistance_reasons = [c.get("assistanceReason") for c in classifications if c.get("assistanceReason")]
        business_labels = merge_labels([c.get("smallBusinessLabels", []) for c in classifications])
        nonprofit_labels = merge_labels([c.get("nonprofitLabels", []) for c in classifications])
        reduced_labels = merge_labels([c.get("reducedRateLabels", []) for c in classifications])
        return {
            "assistanceReason": assistance_reasons[-1] if assistance_reasons else None,
            "assistanceResponseCount": sum(int(c.get("assistanceResponseCount") or 0) for c in classifications),
            "assistanceQuestionnaireAvailable": any(bool(c.get("assistanceQuestionnaireAvailable")) for c in classifications),
            "smallBusinessReference": bool(business_labels),
            "smallBusinessLabels": business_labels,
            "nonprofitReference": bool(nonprofit_labels),
            "nonprofitLabels": nonprofit_labels,
            "reducedRateReference": bool(reduced_labels),
            "reducedRateLabels": reduced_labels,
        }

    for index, row in enumerate(master):
        apps_for_member = apps_by_master.get(index, [])
        app = max(apps_for_member, key=lambda item: parse_submission(item.get("submitted_on", "")) or datetime.min, default=None)
        refs = refs_for_apps(apps_for_member)

        raw_key = text(row.get("id")) or text(row.get("externalId")) or f"row-{index}-{norm(row.get('email'))}-{norm(row.get('displayName'))}"
        member_id = safe_id("m", raw_key)
        member_id_by_index[index] = member_id
        membership_status = norm(row.get("membershipStatus")) or "unknown"
        membership_type = text(row.get("membershipType")) or "Unspecified"
        visits = int_num(row.get("visitsInRange"))
        total_visits = int_num(row.get("totalVisits"))
        guests = int_num(row.get("hostedGuestsInRange"))
        app_type = text(app.get("membership_type_list")) if app else None
        app_status = text(app.get("application_status_list")) if app else None
        latest_submitted = parse_submission(app.get("submitted_on", "")) if app else None

        summary = {
            "id": member_id,
            "displayName": text(row.get("displayName")) or (text(app.get("member_name")) if app else "Unnamed member"),
            "isMasterMember": True,
            "sourceOrigin": "master",
            "membershipStatus": membership_status,
            "membershipType": membership_type,
            "studentAffiliation": text(row.get("studentAffiliation")) or "Unknown",
            "dataQualityStatus": text(row.get("dataQualityStatus")) or "unknown",
            "isEmployee": truthy(row.get("isEmployee")) or membership_status == "staff",
            "active": membership_status in {"approved", "staff"},
            "doorAccessDesired": truthy(row.get("doorAccessDesired")),
            "visitsInRange": visits,
            "totalVisits": total_visits,
            "hostedGuestsInRange": guests,
            "membershipSubmittedAt": text(row.get("membershipSubmittedAt")) or None,
            "membershipExpiresAt": text(row.get("membershipExpiresAt")) or None,
            "lastActivityAt": text(row.get("lastVisitAt")) or None,
            "lastVisitAt": text(row.get("lastVisitAt")) or None,
            "amountPaid": num(row.get("amountPaid")),
            "hasApplicationDetails": bool(apps_for_member),
            "applicationCount": len(apps_for_member),
            "applicationMembershipType": app_type,
            "applicationStatus": app_status,
            "modelReleaseGranted": model_release_granted(app),
            "assistanceRequested": any(is_assistance(a) for a in apps_for_member) if apps_for_member else None,
            "ageBand": age_band(app.get("birthdate", "")) if app else None,
            "homeCity": canonical_city(app.get("home_city", "")) if app else None,
            "homeState": canonical_state(app.get("home_state", "")) if app else None,
            "signaturePresent": truthy(app.get("signature_present")) if app and text(app.get("signature_present")) else None,
            "applicationSubmittedAt": latest_submitted.isoformat() if latest_submitted else None,
            "applicationFields": application_field_flags(app),
            **refs,
        }
        safe_members.append(summary)

        emergency = contacts_by_source.get(text(app.get("source_key")) if app else "", [])
        private_members.append({
            **summary,
            "recordKey": raw_key,
            "email": text(row.get("email")) or (text(app.get("email")) if app else None),
            "phone": text(row.get("phone")) or (text(app.get("primary_phone")) if app else None),
            "customerId": text(row.get("externalId")) or None,
            "membershipDescription": text(row.get("membershipTypeRaw")) or None,
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
                for history in sorted(apps_for_member, key=lambda item: parse_submission(item.get("submitted_on", "")) or datetime.min, reverse=True)
            ],
        })

    # Preserve application-only people so reconciliation work does not hide them.
    for app in unmatched_apps:
        source_key = text(app.get("source_key"))
        member_id = safe_id("a", source_key or text(app.get("email")) or text(app.get("member_name")))
        submitted = parse_submission(app.get("submitted_on", ""))
        refs = refs_for_apps([app])
        summary = {
            "id": member_id,
            "displayName": text(app.get("member_name")) or "Application-only person",
            "isMasterMember": False,
            "sourceOrigin": "application-only",
            "membershipStatus": norm(app.get("application_status_list")) or "pending",
            "membershipType": text(app.get("membership_type_list")) or "Unspecified",
            "studentAffiliation": student_affiliation_from_app(app),
            "dataQualityStatus": "reportable",
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
            "amountPaid": 0.0,
            "hasApplicationDetails": True,
            "applicationCount": 1,
            "applicationMembershipType": text(app.get("membership_type_list")) or None,
            "applicationStatus": text(app.get("application_status_list")) or None,
            "modelReleaseGranted": model_release_granted(app),
            "assistanceRequested": is_assistance(app),
            "ageBand": age_band(app.get("birthdate", "")),
            "homeCity": canonical_city(app.get("home_city", "")),
            "homeState": canonical_state(app.get("home_state", "")),
            "signaturePresent": truthy(app.get("signature_present")) if text(app.get("signature_present")) else None,
            "applicationSubmittedAt": submitted.isoformat() if submitted else None,
            "applicationFields": application_field_flags(app),
            **refs,
        }
        safe_members.append(summary)
        emergency = contacts_by_source.get(source_key, [])
        private_members.append({
            **summary,
            "recordKey": source_key,
            "email": text(app.get("email")) or None,
            "phone": text(app.get("primary_phone")) or text(app.get("phone")) or None,
            "customerId": None,
            "membershipDescription": None,
            "application": {
                "sourceKey": source_key,
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
            "applicationHistory": [{
                "sourceKey": source_key,
                "submittedOn": text(app.get("submitted_on")) or None,
                "membershipType": text(app.get("membership_type_list")) or None,
                "applicationStatus": text(app.get("application_status_list")) or None,
                "modelRelease": text(app.get("model_release_list")) or None,
                "assistanceTab": text(app.get("assistance_tab")) or None,
            }],
        })

    source_to_member_id: dict[str, str] = {}
    for master_index, history in apps_by_master.items():
        for app in history:
            source_to_member_id[text(app.get("source_key"))] = member_id_by_index[master_index]
    for app in unmatched_apps:
        source_to_member_id[text(app.get("source_key"))] = safe_id("a", text(app.get("source_key")) or text(app.get("email")) or text(app.get("member_name")))

    safe_applications: list[dict[str, Any]] = []
    for app in applications:
        source_key = text(app.get("source_key"))
        submitted = parse_submission(app.get("submitted_on", ""))
        classification = app_classification.get(source_key, {})
        safe_applications.append({
            "id": safe_id("app", source_key or f"{app.get('email')}-{app.get('submitted_on')}"),
            "memberId": source_to_member_id.get(source_key),
            "memberName": text(app.get("member_name")) or "Unnamed applicant",
            "submittedAt": submitted.isoformat() if submitted else None,
            "membershipType": text(app.get("membership_type_list")) or "Unspecified",
            "applicationStatus": text(app.get("application_status_list")) or "Unspecified",
            "modelReleaseGranted": model_release_granted(app),
            "assistanceRequested": is_assistance(app),
            "signaturePresent": truthy(app.get("signature_present")) if text(app.get("signature_present")) else None,
            "ageBand": age_band(app.get("birthdate", "")),
            "homeCity": canonical_city(app.get("home_city", "")),
            "homeState": canonical_state(app.get("home_state", "")),
            "isMatchedToMaster": source_key in matched_source_keys,
            "fields": application_field_flags(app),
            "activitySources": [],
            **classification,
        })

    master_summaries = [m for m in safe_members if m["isMasterMember"]]

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
        submitted = parse_submission(app.get("submitted_on", ""))
        if submitted:
            submission_months[submitted.strftime("%Y-%m")] += 1
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
    assistance = sum(is_assistance(app) for app in applications)
    signed = sum(truthy(app.get("signature_present")) for app in applications)
    assistance_apps = [app for app in applications if is_assistance(app)]
    assistance_source_keys = {text(app.get("source_key")) for app in assistance_apps}
    assistance_people = len({source_to_member_id.get(key, key) for key in assistance_source_keys if key})
    assistance_questionnaire_apps = sum(bool(app_classification.get(text(app.get("source_key")), {}).get("assistanceQuestionnaireAvailable")) for app in assistance_apps)
    assistance_questionnaire_responses = sum(int(app_classification.get(text(app.get("source_key")), {}).get("assistanceResponseCount") or 0) for app in assistance_apps)

    master_min, master_max = iso_range(parse_iso(row.get("membershipSubmittedAt", "")) for row in master)
    app_min, app_max = iso_range(parse_submission(app.get("submitted_on", "")) for app in applications)
    assistance_min, assistance_max = iso_range(parse_submission(app.get("submitted_on", "")) for app in assistance_apps)
    visit_min, visit_max = iso_range(parse_iso(row.get("lastVisitAt", "")) for row in master)

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
            "masterSubmissionMin": master_min,
            "masterSubmissionMax": master_max,
            "applicationSubmissionMin": app_min,
            "applicationSubmissionMax": app_max,
            "visitObservationMin": visit_min,
            "visitObservationMax": visit_max,
            "assistanceReasonRows": sum(bool(c.get("assistanceReason")) for c in app_classification.values()),
            "rawControlRows": len(raw_controls),
            "assistanceQuestionnaireApplications": assistance_questionnaire_apps,
            "assistanceQuestionnaireResponses": assistance_questionnaire_responses,
            "assistanceSubmissionMin": assistance_min,
            "assistanceSubmissionMax": assistance_max,
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
            "assistancePeople": assistance_people,
            "smallBusinessReferences": sum(bool(a["smallBusinessReference"]) for a in safe_applications),
            "nonprofitReferences": sum(bool(a["nonprofitReference"]) for a in safe_applications),
            "reducedRateReferences": sum(bool(a["reducedRateReference"]) for a in safe_applications),
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
        "modelRelease": [{"name": "Granted", "value": model_yes}, {"name": "Not granted", "value": model_no}],
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
    print(f"Corrected source dates: {sum(bool(m['membershipSubmittedAt']) for m in master_summaries):,} member submissions; {sum(bool(m['lastVisitAt']) for m in master_summaries):,} last-visit timestamps")
    print(f"Report signals: {sum(a['smallBusinessReference'] for a in safe_applications)} business, {sum(a['nonprofitReference'] for a in safe_applications)} nonprofit, {sum(a['reducedRateReference'] for a in safe_applications)} reduced-rate/quilter, {assistance} assistance")
    print(f"Safe member payload: {(ANALYTICS_DIR / 'members.json').stat().st_size / 1024:.1f} KB")
    print(f"Safe application payload: {(ANALYTICS_DIR / 'applications.json').stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
