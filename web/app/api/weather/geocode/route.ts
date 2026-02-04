import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();
  const countryCode = searchParams.get("countryCode")?.trim();

  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "zh");
  url.searchParams.set("format", "json");
  if (countryCode) url.searchParams.set("countryCode", countryCode);

  const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 * 30 }, 
   headers: { 'accept-language': 'zh-HK,zh-Hant;q=0.9,en;q=0.7' }
  }); 

  const data = await res.json();

  const first = data?.results?.[0];
  if (!first) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    latitude: first.latitude,
    longitude: first.longitude,
    resolvedName: [first.name, first.admin1, first.country].filter(Boolean).join(", "),
  });
}
