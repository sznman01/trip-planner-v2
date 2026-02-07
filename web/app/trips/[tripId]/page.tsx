import { redirect } from "next/navigation";

export default function TripEntryPage({
  params,
}: {
  params: { tripId: string };
}) {
  const { tripId } = params;
  redirect(`/trips/${tripId}/itinerary`);
}
