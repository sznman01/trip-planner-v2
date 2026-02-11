"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Image as ImageIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTripsStore, Trip, Activity } from "@/lib/store/trips";
import { getCurrencyCodeFromCountry } from "@/lib/constants/countryCurrency";

type Mode = "create" | "edit";

type Props = {
  mode?: Mode;
  tripId?: string; // edit required
  trigger?: React.ReactNode;
  onDone?: (tripId: string) => void;
};

type FormState = {
  title: string;
  location: string; // 建議：存國家名，例如 "Switzerland"
  currencyCode: string; // "CHF" / "JPY" / ...
  startDate: string;
  endDate: string;
  description: string;
  coverImage: string; // DataURL
};

// 你可以按需要加減國家
const COUNTRY_PRESETS = [
  { label: "瑞士 Switzerland", value: "Switzerland" },
  { label: "日本 Japan", value: "Japan" },
  { label: "香港 Hong Kong", value: "Hong Kong" },
  { label: "台灣 Taiwan", value: "Taiwan" },
  { label: "韓國 Korea", value: "Korea" },
  { label: "泰國 Thailand", value: "Thailand" },
  { label: "新加坡 Singapore", value: "Singapore" },
  { label: "美國 United States", value: "United States" },
  { label: "英國 United Kingdom", value: "United Kingdom" },
  { label: "歐元區（通用）Eurozone", value: "Eurozone" },
];

const CURRENCY_PRESETS = [
  { label: "香港 HKD", code: "HKD" },
  { label: "日本 JPY", code: "JPY" },
  { label: "韓國 KRW", code: "KRW" },
  { label: "台灣 TWD", code: "TWD" },
  { label: "泰國 THB", code: "THB" },
  { label: "新加坡 SGD", code: "SGD" },
  { label: "美國 USD", code: "USD" },
  { label: "英國 GBP", code: "GBP" },
  { label: "歐元區 EUR", code: "EUR" },
  { label: "瑞士 CHF", code: "CHF" },
  { label: "中國 CNY", code: "CNY" },
  { label: "澳洲 AUD", code: "AUD" },
  { label: "加拿大 CAD", code: "CAD" },
];

function parseYMDToUTC(ymd: string) {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUTCToYMD(d: Date) {
  return d.toISOString().split("T")[0]!;
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function diffDaysUTC(a: Date, b: Date) {
  const ms =
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) -
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round(ms / 86400000);
}

function buildDatesUTC(start: string, end: string) {
  const dates: string[] = [];
  const s = parseYMDToUTC(start);
  const e = parseYMDToUTC(end);
  if (!s || !e) return dates;
  if (s.getTime() > e.getTime()) return dates;

  for (let d = new Date(s); d.getTime() <= e.getTime(); d = addDaysUTC(d, 1)) {
    dates.push(formatUTCToYMD(d));
  }
  return dates;
}

/**
 * 將活動 day 依照「原本活動對應日曆日期」搬位到新範圍
 * oldDate = oldStart + (oldDay-1)
 * newDay = (oldDate - newStart) + 1
 * clamp to [1..newTotalDays]
 */
function remapItineraryDaysByDate(params: {
  itinerary: Activity[];
  oldStart: string;
  newStart: string;
  newEnd: string;
}): Activity[] {
  const { itinerary, oldStart, newStart, newEnd } = params;

  const oldS = parseYMDToUTC(oldStart);
  const newS = parseYMDToUTC(newStart);
  const newE = parseYMDToUTC(newEnd);
  if (!oldS || !newS || !newE) return itinerary;

  const newTotalDays = diffDaysUTC(newE, newS) + 1;
  if (!Number.isFinite(newTotalDays) || newTotalDays <= 0) return itinerary;

  return itinerary.map((a) => {
    const oldDay = Number((a as any).day ?? 1);
    const oldDate = addDaysUTC(oldS, Math.max(0, oldDay - 1));
    const newDayRaw = diffDaysUTC(oldDate, newS) + 1;
    const newDay = Math.min(newTotalDays, Math.max(1, newDayRaw));
    return { ...(a as any), day: newDay };
  });
}

export function CreateTripModal(props: Props) {
  const mode: Mode = props.mode ?? "create";
  const router = useRouter();

  const addTrip = useTripsStore((s) => s.addTrip);
  const upsertTrip = useTripsStore((s) => s.upsertTrip);
  const trips = useTripsStore((s) => s.trips);

  const editingTrip = useMemo(() => {
    if (mode !== "edit") return null;
    if (!props.tripId) return null;
    return trips.find((t) => t.id === props.tripId) ?? null;
  }, [mode, props.tripId, trips]);

  const [open, setOpen] = useState(false);

  const [form, setForm] = useState<FormState>({
    title: "",
    location: "",
    currencyCode: "HKD",
    startDate: "",
    endDate: "",
    description: "",
    coverImage: "",
  });

  const fileRef = useRef<HTMLInputElement>(null);

  // open 時（或換 tripId 時）預填資料
  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && editingTrip) {
      setForm({
        title: editingTrip.title ?? "",
        location: editingTrip.location ?? "",
        currencyCode: String(editingTrip.currencyCode ?? "HKD").toUpperCase(),
        startDate: editingTrip.startDate ?? "",
        endDate: editingTrip.endDate ?? "",
        description: editingTrip.description ?? "",
        coverImage: editingTrip.coverImage ?? "",
      });
      return;
    }

    // create
    setForm({
      title: "",
      location: "",
      currencyCode: "HKD",
      startDate: "",
      endDate: "",
      description: "",
      coverImage: "",
    });
  }, [open, mode, editingTrip]);

  const canSubmit = useMemo(() => {
    return (
      !!form.title &&
      !!form.location &&
      !!form.currencyCode &&
      !!form.startDate &&
      !!form.endDate
    );
  }, [form]);

  const onChangeCountry = (country: string) => {
    setForm((p) => ({
      ...p,
      location: country,
      currencyCode: getCurrencyCodeFromCountry(country).toUpperCase(),
    }));
  };

  function close() {
    setOpen(false);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    // 避免 localStorage 內存爆炸（base64 會更大）
    if (f.size > 2 * 1024 * 1024) {
      alert("圖片太大（> 2MB），請揀細一點嘅相。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((s) => ({ ...s, coverImage: String(reader.result || "") }));
    };
    reader.readAsDataURL(f);

    // 允許同一張相再揀一次都會觸發 change
    e.target.value = "";
  }

  async function submit() {
    if (!canSubmit) {
      alert("請填寫：旅程名稱 / 國家 / 開始日期 / 結束日期");
      return;
    }

    // create
    if (mode === "create") {
      const tripId = addTrip({
        title: form.title,
        location: form.location, // 國家名，例如 Switzerland
        currencyCode: form.currencyCode, // CHF
        startDate: form.startDate,
        endDate: form.endDate,
        dates: buildDatesUTC(form.startDate, form.endDate),

        description: form.description,
        coverImage: form.coverImage,

        itinerary: [],
        accommodations: {},
        reservations: { flights: [], hotels: [], tickets: [] },

        totalBudget: 0,
        expenses: [],

        shoppingList: [],
        checklist: [],
        members: [],
      });

      close();
      props.onDone?.(tripId);
      router.push(`/trips/${tripId}/itinerary`);
      return;
    }

    // edit
    if (!props.tripId || !editingTrip) return;

    const nextDates = buildDatesUTC(form.startDate, form.endDate);
    const nextItinerary =
      editingTrip.startDate !== form.startDate || editingTrip.endDate !== form.endDate
        ? remapItineraryDaysByDate({
            itinerary: editingTrip.itinerary ?? [],
            oldStart: editingTrip.startDate,
            newStart: form.startDate,
            newEnd: form.endDate,
          })
        : (editingTrip.itinerary ?? []);

    const nextTrip: Trip = {
      ...editingTrip,
      title: form.title,
      location: form.location,
      currencyCode: form.currencyCode,
      startDate: form.startDate,
      endDate: form.endDate,
      dates: nextDates,
      description: form.description ?? "",
      coverImage: form.coverImage || "",
      itinerary: nextItinerary,
    };

    upsertTrip(nextTrip);
    close();
    props.onDone?.(props.tripId);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    border: "1px solid var(--border)",
    borderRadius: 16,
    background: "var(--card)",
    color: "var(--foreground)",
    outline: "none",
    boxShadow: "0 0 0 0 rgba(0,0,0,0)",
  };

  const defaultCreateTrigger = (
    <button
      onClick={() => setOpen(true)}
      style={{
        width: "100%",
        marginTop: 12,
        border: "2px dashed color-mix(in srgb, var(--border) 70%, var(--primary) 30%)",
        borderRadius: 16,
        padding: 16,
        background: "var(--card)",
        fontWeight: 700,
        color: "var(--foreground)",
      }}
      type="button"
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <Plus size={18} /> 新增旅程
      </span>
    </button>
  );

  return (
    <>
      {props.trigger ? (
        <span
          onClickCapture={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          style={{ display: "inline-block" }}
        >
          {props.trigger}
        </span>
      ) : mode === "create" ? (
        defaultCreateTrigger
      ) : null}

      {open && (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "color-mix(in srgb, var(--card) 92%, transparent)",
              borderRadius: 24,
              padding: 20,
              backdropFilter: "blur(12px)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {mode === "edit" ? "編輯旅程" : "新增旅程"}
              </div>
              <button onClick={close} style={{ padding: 6 }} type="button" aria-label="close">
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {/* 封面圖上傳 */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                style={{ display: "none" }}
              />

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  width: "100%",
                    border: "2px dashed var(--border)",
                  borderRadius: 16,
                  padding: 14,
                    background: "var(--card)",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                    color: "var(--foreground)",
                }}
              >
                <ImageIcon size={18} />
                選擇/更換封面圖
              </button>

              {form.coverImage ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <img
                    src={form.coverImage}
                    alt="cover"
                    style={{
                      width: "100%",
                      height: 160,
                      objectFit: "cover",
                      borderRadius: 16,
                      border: "1px solid #E9D5C8",
                      background: "#fff",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, coverImage: "" }))}
                    style={{
                      width: "100%",
                      borderRadius: 16,
                      padding: 12,
                        background: "var(--card)",
                      border: "1px solid var(--border)",
                      fontWeight: 800,
                      color: "var(--foreground)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Trash2 size={16} />
                    移除封面
                  </button>
                </div>
              ) : null}

              {/* 表單 */}
              <input
                style={inputStyle}
                placeholder="旅程名稱"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              />

              {/* 國家（會自動更新 currencyCode） */}
              <select
                style={inputStyle}
                value={form.location}
                onChange={(e) => onChangeCountry(e.target.value)}
              >
                <option value="">選擇國家/地區</option>
                {COUNTRY_PRESETS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>

              {/* 幣種（仍可手動覆蓋） */}
              <select
                style={inputStyle}
                value={form.currencyCode}
                onChange={(e) => setForm((s) => ({ ...s, currencyCode: e.target.value.toUpperCase() }))}
              >
                {CURRENCY_PRESETS.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.label}
                  </option>
                ))}
              </select>

              <input
                style={{ ...inputStyle, width: 365 }}
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
              />
              <input
                style={{ ...inputStyle, width: 365 }}
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))}
              />

              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: "none" }}
                placeholder="簡介（可選）"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              />

              <button
                onClick={submit}
                type="button"
                style={{
                  marginTop: 6,
                  borderRadius: 16,
                  padding: 14,
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  fontWeight: 800,
                  opacity: canSubmit ? 1 : 0.6,
                }}
              >
                {mode === "edit" ? "儲存" : "建立"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
