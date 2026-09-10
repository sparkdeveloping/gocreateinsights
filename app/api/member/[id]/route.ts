import { NextRequest, NextResponse } from "next/server";
import details from "@/data/private/member-details.json";
import type { MemberDetail } from "@/lib/types";

export const runtime = "nodejs";

type DetailMap = Record<string, MemberDetail>;
const detailMap = details as DetailMap;

function maskEmail(value?: string | null) {
  if (!value || !value.includes("@")) return value ?? null;
  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}•••@${domain}`;
}

function maskPhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `••• ••• ${digits.slice(-4)}` : "••••";
}

function maskedDetail(member: MemberDetail): MemberDetail {
  const application = member.application
    ? {
        ...member.application,
        birthdate: member.application.birthdate ? "Private" : null,
        homeAddressStreet: member.application.homeAddressStreet ? "Private" : null,
        homeZip: member.application.homeZip ? "Private" : null,
        primaryPhone: maskPhone(member.application.primaryPhone),
        otherPhone: maskPhone(member.application.otherPhone),
        badgeId: member.application.badgeId ? "Private" : null,
        medicalAlertOnFile: false,
        emergencyContacts: member.application.emergencyContacts?.map((contact) => ({
          ...contact,
          fullName: contact.fullName ? `${contact.fullName.slice(0, 1)}•••` : null,
          primaryPhone: maskPhone(contact.primaryPhone),
          otherPhone: maskPhone(contact.otherPhone),
          streetAddress: contact.streetAddress ? "Private" : null,
          zip: contact.zip ? "Private" : null,
        })),
      }
    : null;

  return {
    ...member,
    email: maskEmail(member.email),
    phone: maskPhone(member.phone),
    application,
    piiMode: "masked",
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const member = detailMap[id];
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Keep the public deployment safe by default. Only reveal private values when the
  // deployment itself is access-controlled and this environment variable is explicitly set.
  if (process.env.GOCREATE_PII_MODE === "full") {
    return NextResponse.json({ ...member, piiMode: "full" }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return NextResponse.json(maskedDetail(member), { headers: { "Cache-Control": "private, no-store" } });
}
