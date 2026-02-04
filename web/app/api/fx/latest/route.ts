import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FRANKFURTER_LATEST = "https://api.frankfurter.dev/v1/latest";
const DEFAULT_BASE = "HKD";
const DEFAULT_SYMBOLS = [
  "HKD",
  "JPY",
  "KRW",
  "TWD",
  "THB",
  "SGD",
  "USD",
  "GBP",
  "EUR",
  "CHF",
  "CNY",
  "AUD",
  "CAD",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const base = (searchParams.get("base") || DEFAULT_BASE).toUpperCase();
  const symbols = (searchParams.get("symbols") || DEFAULT_SYMBOLS.join(","))
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const url = `${FRANKFURTER_LATEST}?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(
    symbols.join(",")
  )}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60  } }); // cache 24h（每日更新模式）
    if (!res.ok) {
      return NextResponse.json({ error: "Frankfurter fetch failed" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }
}
