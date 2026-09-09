import { NextRequest, NextResponse } from "next/server";
import details from "@/src/data/member-details.json";

export const runtime = "nodejs";

type DetailMap = Record<string, unknown>;
const detailMap = details as DetailMap;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const member = detailMap[id];

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json(member);
}
