"use client";

import React from "react";
import { useTripsStore } from "@/lib/store/trips";
import { CreateTripModal } from "@/components/CreateTripModal";
import { TripCard } from "@/components/TripCard";

export default function Page() {
  const trips = useTripsStore((s) => s.trips);
  const deleteTrip = useTripsStore((s) => s.deleteTrip);

  return (
    <main className="min-h-screen bg-[#F8F9FA] p-4 pb-24">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#2D3436]">我的旅程</h1>
        <p className="mt-1 text-sm text-gray-500">開始規劃你的下一趟旅行</p>
      </header>

      <CreateTripModal />

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        {trips.length === 0 ? (
          <div className="rounded-3xl border bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            你暫時未有旅程，按上面「新增旅程」開始。
          </div>
        ) : (
          trips.map((t) => (
            <TripCard key={t.id} trip={t} onDelete={deleteTrip} />
          ))
        )}
      </section>
    </main>
  );
}
