// app/api/fx/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "JPY").toUpperCase();
  const to = (searchParams.get("to") || "HKD").toUpperCase();

  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const r = await fetch(url, {
    // 30分鐘更新一次（你可自行改）
    next: { revalidate: 60 * 30 },
  });

  if (!r.ok) {
    return NextResponse.json({ ok: false, error: "fx_upstream_failed" }, { status: 502 });
  }

  const data = await r.json();
  return NextResponse.json({ ok: true, data });
}
