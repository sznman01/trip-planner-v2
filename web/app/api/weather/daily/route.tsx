import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latitude = searchParams.get("latitude");
  const longitude = searchParams.get("longitude");
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!latitude || !longitude) return NextResponse.json({ error: "missing lat/lon" }, { status: 400 });

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set("daily", "weathercode,temperature_2m_min,temperature_2m_max");
  url.searchParams.set("timezone", "auto");
  if (start_date) url.searchParams.set("start_date", start_date);
  if (end_date) url.searchParams.set("end_date", end_date);

  // 天氣可設短 cache（例如 1 小時），但你想「每日更新」其實設 6–24 小時都得
  const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 } });
  if (!res.ok) return NextResponse.json({ error: "forecast failed" }, { status: 502 });

  const data = await res.json();
  return NextResponse.json(data);
}
