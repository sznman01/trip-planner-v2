// 無 "use client"
import { redirect } from "next/navigation";

export async function generateStaticParams() {
  return [
    { tripId: "acb6f4ba-3009-4a20-9bea-89ed28365972" },
    { tripId: "demo-tokyo-2026" }
  ];
}

export default async function TripEntryPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  redirect(`/trips/${tripId}/itinerary`);
}
