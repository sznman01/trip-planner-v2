"use client";

import { useThemeStore } from "@/lib/store/theme";  // ✅ 修正路徑
import { Settings, Plus } from "lucide-react";     // ✅ 加 Plus
import Link from "next/link";
import React from "react";
import { useTripsStore } from "@/lib/store/trips";
import { CreateTripModal } from "@/components/CreateTripModal";
import { TripCard } from "@/components/TripCard";

export default function Page() {
  const trips = useTripsStore((s) => s.trips);
  const deleteTrip = useTripsStore((s) => s.deleteTrip);

  return (
    <div className="px-4 pt-4 pb-10 relative min-h-dvh bg-gradient-to-b from-[color:var(--background)] to-[color:var(--card)]">
      {/* 右上角 Settings ← 完美！ */}
      <Link href="/settings" className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-semibold text-[color:var(--muted)] shadow-sm backdrop-blur-md hover:opacity-95 opacity-70">
        <Settings className="h-4 w-4" />
        <span>設定</span>
      </Link>

      <div className="mt-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[color:var(--foreground)]">我的旅程</h1>
          <p className="mt-2 text-lg text-[color:var(--muted-foreground)]">開始規劃你的下一趟旅行</p>
        </div>

        {/* 用你現有組件 ← 更好！ */}
        {trips.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-rose-400/20 to-pink-400/20 p-6">
              <Plus className="w-12 h-12 mx-auto text-rose-500" />
            </div>
            <p className="text-xl font-semibold text-[color:var(--foreground)] mb-2">還沒有旅程</p>
            <p className="text-[color:var(--muted-foreground)] mb-8">點擊下方按鈕新增你的第一個旅行計劃</p>
            <CreateTripModal />  {/* ← 如果你想加 */}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {trips.map((trip) => (
              <TripCard key={trip.id} 
              trip={trip} 
               onDelete={deleteTrip}  
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
