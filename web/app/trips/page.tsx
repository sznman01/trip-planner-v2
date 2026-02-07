'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTripsStore } from '@/lib/store/trips'

export default function TripsPage() {
  const router = useRouter()
  const trips = useTripsStore(s => s.trips)
  
  useEffect(() => {
    if (trips.length > 0) {
      router.replace(`/trips/${trips[0].id}/itinerary`)
    }
  }, [trips, router])

  return (
    <div className="p-6">
      <div>Loading your first trip...</div>
    </div>
  )
}
