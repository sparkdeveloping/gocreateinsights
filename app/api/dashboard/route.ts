import { NextResponse } from "next/server";
import members from "@/data/analytics/members.json";
import applications from "@/data/analytics/applications.json";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ members, applications }, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
