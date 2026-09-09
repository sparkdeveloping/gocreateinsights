import { NextResponse } from "next/server";
import members from "@/src/data/members-summary.json";
import meta from "@/src/data/dataset-meta.json";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    members,
    meta: {
      sourceFile: meta.sourceFile,
      generatedAt: meta.generatedAt,
      rowCount: meta.rowCount,
      columnCount: meta.columnCount,
    },
  });
}
