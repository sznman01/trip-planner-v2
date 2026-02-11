"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTripsStore, type ActivityType } from "@/lib/store/trips";

type InitialValues = {
  time: string;
  name: string;
  location: string;
  type: ActivityType;
  notes?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tripId: string;
  day: number;
  mode?: "create" | "edit";
  activityIndex?: number;  // ✅ 用 index 代替 id
  initialValues?: Partial<InitialValues>;
  onUpdated?: () => void;
};

const DEFAULTS: InitialValues = {
  time: "09:30",
  name: "",
  location: "",
  type: "sightseeing",
  notes: "",
};

export function CreateActivityModal({
  open,
  onClose,
  tripId,
  day,
  mode = "create",
  activityIndex,  // ✅ number | undefined
  initialValues,
  onUpdated,
}: Props) {
  // ✅ 正確 Zustand hooks
  const upsertTrip = useTripsStore((s) => s.upsertTrip);
  const trips = useTripsStore((s) => s.trips);

  // ✅ 自訂 addActivity（取代 store 無嘅方法）
  const addActivity = useCallback((tripId: string, payload: InitialValues & { day: number }): void => {
  const trip = trips.find(t => t.id === tripId);
  if (!trip) return;
  const nextTrip = {
    ...trip,
    itinerary: [...trip.itinerary, payload]
  };
  upsertTrip(nextTrip);
}, [trips, upsertTrip]);

const updateActivity = useCallback((
  tripId: string, 
  activityIndex: number,
  payload: InitialValues & { day: number }
): void => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    
    const nextItinerary = [...trip.itinerary];
    nextItinerary[activityIndex] = {
      ...nextItinerary[activityIndex],
      day: payload.day,
      time: payload.time,
      name: payload.name,
      location: payload.location,
      type: payload.type,
      notes: payload.notes,
    };
    
    const nextTrip = { ...trip, itinerary: nextItinerary };
    upsertTrip(nextTrip);
  }, [trips, upsertTrip]);

  const [time, setTime] = useState(DEFAULTS.time);
  const [name, setName] = useState(DEFAULTS.name);
  const [location, setLocation] = useState(DEFAULTS.location);
  const [type, setType] = useState<ActivityType>(DEFAULTS.type);
  const [notes, setNotes] = useState(DEFAULTS.notes);

  const title = mode === "edit" ? "編輯活動" : "新增活動";

  const canSubmit = useMemo(() => {
    return Boolean(time.trim() && name.trim() && location.trim() && tripId && tripId !== "undefined");
  }, [time, name, location, tripId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit") {
      setTime(initialValues?.time ?? DEFAULTS.time);
      setName(initialValues?.name ?? DEFAULTS.name);
      setLocation(initialValues?.location ?? DEFAULTS.location);
      setType((initialValues?.type as ActivityType) ?? DEFAULTS.type);
      setNotes(initialValues?.notes ?? DEFAULTS.notes);
      return;
    }

    setTime(DEFAULTS.time);
    setName(DEFAULTS.name);
    setLocation(DEFAULTS.location);
    setType(DEFAULTS.type);
    setNotes(DEFAULTS.notes);
  }, [open, mode, initialValues, day]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const payload = {
      day,
      time: time.trim(),
      name: name.trim(),
      location: location.trim(),
      type,
      notes: (notes ?? "").trim(),
    };

    if (mode === "edit") {
      if (typeof activityIndex !== "number") {
        alert("缺少 activityIndex（edit mode 必填）");
        return;
      }
      updateActivity(tripId, activityIndex, payload);  // ✅ 傳 index
      onUpdated?.();
      onClose();
      return;
    }

    addActivity(tripId, payload);
    onUpdated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="text-xs text-gray-500 mt-1">Day {day}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-sm"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="text-sm font-medium text-gray-700 mb-1">時間</div>
            <input
              type="time"
              className="w-full rounded-xl border px-3 py-2"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700 mb-1">活動</div>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：TeamLab / 食拉麵"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700 mb-1">地點</div>
            <input
              className="w-full rounded-xl border px-3 py-2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例如：Shinjuku / 淺草"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700 mb-1">類型</div>
            <select
              className="w-full rounded-xl border px-3 py-2"
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
            >
              <option value="sightseeing">觀光</option>
              <option value="food">飲食</option>
              <option value="shopping">購物</option>
              <option value="transport">交通</option>
              <option value="accommodation">住宿</option>
              <option value="relaxation">休息</option>
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700 mb-1">備註</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="可選"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border px-3 py-2 text-sm"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className={`flex-1 rounded-xl px-3 py-2 text-sm text-[var(--primary-foreground)] ${
              canSubmit ? "bg-black" : "bg-gray-300"
            }`}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {mode === "edit" ? "儲存" : "新增"}
          </button>
        </div>
      </div>
    </div>
  );
}
