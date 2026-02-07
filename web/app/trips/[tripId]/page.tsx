'use client'

import { redirect } from "next/navigation";
import ItineraryPage from './itinerary/page'


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

