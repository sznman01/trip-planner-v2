import { redirect } from 'next/navigation'

export default function ItineraryRedirect() {
  redirect('..')  // 跳回父路由 /trips/[tripId]
}
