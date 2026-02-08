"use client";

import React, { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Trash2, Pencil } from "lucide-react";
import { CreateTripModal } from "@/components/CreateTripModal";

export type TripCardTrip = {
  id: string;
  title: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  coverImage?: string;
  itinerary?: Array<{ day: number }>;
};

type Props = {
  trip: TripCardTrip;
  onDelete: (tripId: string) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseYMDToUTC(ymd: string) {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function diffDaysUTC(a: Date, b: Date) {
  const ms =
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) -
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round(ms / 86400000);
}

function calcTotalDays(startDate: string, endDate: string) {
  const s = parseYMDToUTC(startDate);
  const e = parseYMDToUTC(endDate);
  if (!s || !e) return 0;
  const days = diffDaysUTC(e, s) + 1;
  return days > 0 ? days : 0;
}

function calcCountdownDays(startDate: string) {
  const s = parseYMDToUTC(startDate);
  if (!s) return 0;
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return diffDaysUTC(s, todayUTC);
}

function calcProgressPct(startDate: string, endDate: string) {
  const s = parseYMDToUTC(startDate);
  const e = parseYMDToUTC(endDate);
  if (!s || !e) return 0;

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const total = diffDaysUTC(e, s);
  if (total <= 0) return 100;

  const elapsed = diffDaysUTC(todayUTC, s);
  const pct = Math.round((elapsed / total) * 100);
  return clamp(pct, 0, 100);
}

export function TripCard({ trip, onDelete }: Props) {
  const router = useRouter();

  const totalDays = useMemo(
    () => calcTotalDays(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate]
  );

  const countdown = useMemo(() => calcCountdownDays(trip.startDate), [trip.startDate]);

  const progressPct = useMemo(
    () => calcProgressPct(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate]
  );

  const statusLabel = useMemo(() => {
    if (countdown > 0) return `距離出發 ${countdown} 天`;
    if (countdown === 0) return "今日出發";
    return "旅程進行中/已完結";
  }, [countdown]);

  const goItinerary = useCallback(() => {
    const url = `/trips/${trip.id}/itinerary`;
    router.push(url);
    window.setTimeout(() => {
      window.location.href = url;
    }, 100);
  }, [router, trip.id]);

  function confirmDelete() {
    const ok = confirm(`確定刪除「${trip.title}」？`);
    if (!ok) return;
    onDelete(trip.id);
  }

  return (
  <div
    className="
      overflow-hidden rounded-3xl
      border border-[color:var(--border)]
      bg-[color:var(--card)]
      shadow-sm
    "
  >

      {/* cover */}
      <div className="relative">
        {trip.coverImage ? (
          <img
            src={trip.coverImage}
            alt={trip.title}
            className="h-44 w-full object-cover"
            onClick={goItinerary}
          />
        ) : (
          <div
            className="h-44 w-full cursor-pointer bg-gradient-to-r from-pink-200 to-red-300"
            onClick={goItinerary}
          />
        )}

        {/* action buttons (top-right) */}
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <CreateTripModal
            mode="edit"
            tripId={trip.id}
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur-md hover:bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil size={16} />
                編輯
              </button>
            }
          />

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm backdrop-blur-md hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              confirmDelete();
            }}
          >
            <Trash2 size={16} />
            刪除
          </button>
        </div>
      </div>

      {/* body */}
      <div className="cursor-pointer p-4" onClick={goItinerary}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-gray-900">{trip.title}</div>

            <div className="mt-1 inline-flex items-center gap-1 text-sm text-gray-600">
              <MapPin size={16} />
              <span className="truncate">{trip.location}</span>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              {trip.startDate} → {trip.endDate}
              {totalDays ? `（${totalDays} 日）` : ""}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-xs font-semibold text-gray-700">{statusLabel}</div>
            <div className="mt-1 text-xs text-gray-500">旅程進度</div>
            <div className="mt-2 h-2 w-24 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-red-600"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-500">{progressPct}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
