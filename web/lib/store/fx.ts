// app/api/fx/latest/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const base = (searchParams.get("base") || "HKD").toUpperCase();
  const symbolsRaw = (searchParams.get("symbols") || "").trim();

  const symbols = symbolsRaw
    ? symbolsRaw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .filter((s) => s !== base)
    : [];

  const url =
    symbols.length > 0
      ? `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(
          symbols.join(",")
        )}`
      : `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`;

  const r = await fetch(url, {
    // 30分鐘更新一次（你可改）
    next: { revalidate: 60 * 30 },
  });

  if (!r.ok) {
    return NextResponse.json({ ok: false, error: "fx_upstream_failed" }, { status: 502 });
  }

  const data = await r.json();

  return NextResponse.json({
    base,
    date: data?.date,
    rates: data?.rates || {},
  });
}
