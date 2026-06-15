import { NextRequest, NextResponse } from "next/server";
import { listVersions, type AssetType } from "@/lib/repo";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") as AssetType | null;
  const id = req.nextUrl.searchParams.get("id");
  if (!type || !id) return NextResponse.json({ error: "type and id required" }, { status: 400 });
  return NextResponse.json(listVersions(type, id));
}
