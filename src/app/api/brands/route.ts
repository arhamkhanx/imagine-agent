import { NextRequest, NextResponse } from "next/server";
import { listBrands, createBrand } from "@/lib/repo";

export async function GET() {
  return NextResponse.json(listBrands());
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  return NextResponse.json(createBrand(name.trim()));
}
