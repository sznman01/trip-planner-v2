// ✅ Server Component（無 "use client"）
import ClientItineraryPage from './ClientItineraryPage'

export async function generateStaticParams() {
  return [
    { tripId: "acb6f4ba-3009-4a20-9bea-89ed28365972" },
    { tripId: "demo-tokyo-2026" },
  ]
}

export default ClientItineraryPage