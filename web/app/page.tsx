"use client";

import { Settings, Plus } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useTripsStore } from "@/lib/store/trips";
import { CreateTripModal } from "@/components/CreateTripModal";
import { TripCard } from "@/components/TripCard";

export default function Page() {
  const trips = useTripsStore((s) => s.trips);
  const deleteTrip = useTripsStore((s) => s.deleteTrip);

  return (
    <div className="px-4 pt-4 pb-10 min-h-dvh bg-gradient-to-b from-[color:var(--background)] to-[color:var(--card)]">
      <div className="pt-2">
        {/* ✅ 標題同設定同一行 */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-[color:var(--foreground)]">我的旅程</h1>

          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-semibold text-[color:var(--muted)] shadow-sm backdrop-blur-md hover:opacity-95"
            aria-label="主題設定"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">設定</span>
          </Link>
        </div>

        <p className="mt-2 text-lg text-[color:var(--muted)]">開始規劃你的下一趟旅行</p>

        {/* ✅ 新增旅程按鈕：標題下面 */}
        <div className="grid grid-cols-1 gap-4 mt-4 mb-4">
          <CreateTripModal
            trigger={
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-4 py-4 text-sm font-semibold text-[color:var(--foreground)] shadow-sm hover:opacity-95"
              >
                <Plus className="h-5 w-5 text-[color:var(--primary)]" />
                新增旅程
              </button>
            }
          />
        </div>

        {/* 列表 */}
        {trips.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl font-semibold text-[color:var(--foreground)] mb-2">還沒有旅程</p>
            <p className="text-[color:var(--muted)]">
              點擊上方「新增旅程」開始你的第一個旅行計劃
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} onDelete={deleteTrip} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
