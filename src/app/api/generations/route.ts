import { NextRequest, NextResponse } from "next/server";
import { listGenerations } from "@/lib/repo";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  if (!brand) return NextResponse.json({ error: "brand required" }, { status: 400 });
  return NextResponse.json(listGenerations(brand));
}
