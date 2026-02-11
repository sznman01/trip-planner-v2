"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  BedDouble,
  Calendar,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Sun,
  Trash2,
} from "lucide-react"

import { useTripsStore } from "@/lib/store/trips"
import type { ActivityType, Geo, Trip } from "@/lib/store/trips"

type ItineraryItem = {
  day: number
  time: string
  name: string
  location: string
  type: ActivityType
  notes?: string
  cost?: number
}

type WeatherKind = "sun" | "cloudSun" | "cloud" | "rain" | "snow"

type WeatherDaily = {
  kind: WeatherKind
  tempMin: number
  tempMax: number
  description: string
  resolvedName?: string
}

const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
const weekdayNames = ["日", "一", "二", "三", "四", "五", "六"]

function toIsoDateOnly(d: Date) {
  return d.toISOString().split("T")[0]
}

function buildDatesFromRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return []
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  const out: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(toIsoDateOnly(d))
  return out
}

function formatDateDisplay(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}年${monthNames[d.getMonth()]}${d.getDate()}日`
}

function formatDateRangeChinese(dates?: string[]) {
  if (!Array.isArray(dates) || dates.length === 0) return ""
  const start = new Date(dates[0])
  const end = new Date(dates[dates.length - 1])
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ""
  const s = `${start.getFullYear()}年${monthNames[start.getMonth()]}${start.getDate()}日`
  const e = `${end.getFullYear()}年${monthNames[end.getMonth()]}${end.getDate()}日`
  return `${s} – ${e}`
}

function parseTimeToNumber(t?: string) {
  if (!t) return 0
  return Number.parseInt(t.replace(":", ""), 10) || 0
}

function countdownDaysToStart(startDate?: string) {
  if (!startDate) return 0
  const today = new Date()
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return 0
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function countdownDaysText(days: number) {
  if (days > 0) return String(days)
  if (days === 0) return "今日出發"
  return "已出發"
}

function countdownProgress(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const today = new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const total = end.getTime() - start.getTime()
  if (total <= 0) return 100
  const current = Math.min(Math.max(today.getTime() - start.getTime(), 0), total)
  return Math.round((current / total) * 100)
}

function mapsSearchUrl(q: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`
}

function WeatherIcon({ kind }: { kind: WeatherKind }) {
  const cls = "h-7 w-7"
  if (kind === "sun") return <Sun className={cls} />
  if (kind === "cloudSun") return <CloudSun className={cls} />
  if (kind === "cloud") return <Cloud className={cls} />
  if (kind === "rain") return <CloudRain className={cls} />
  return <CloudSnow className={cls} />
}

function weatherCodeToKind(code: number): WeatherKind {
  if (code === 0) return "sun"
  if (code >= 1 && code <= 3) return "cloudSun"
  if (code === 45 || code === 48) return "cloud"
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code === 95 || code === 96 || code === 99) return "rain"
  if (code >= 71 && code <= 77) return "snow"
  return "cloudSun"
}

function weatherCodeToText(code: number) {
  if (code === 0) return "晴天"
  if (code >= 1 && code <= 3) return "多雲"
  if (code === 45 || code === 48) return "有霧"
  if (code >= 51 && code <= 67) return "有雨"
  if (code >= 71 && code <= 77) return "有雪"
  if (code >= 80 && code <= 82) return "驟雨"
  if (code === 95 || code === 96 || code === 99) return "雷雨"
  return "多雲"
}

async function geocodePlace(name: string): Promise<Geo> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name
  )}&count=1&language=zh-HK&format=json`

  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error("地點搜尋失敗")
  const data = (await res.json()) as {
    results?: Array<{
      name: string
      latitude: number
      longitude: number
      country?: string
      timezone?: string
    }>
  }

  const r = data.results?.[0]
  if (!r) throw new Error("搵唔到呢個地點，試下加多啲字（例如：Shinjuku Tokyo）")

  return {
    latitude: r.latitude,
    longitude: r.longitude,
    resolvedName: r.name,
    country: r.country,
    timezone: r.timezone,
  }
}

async function fetchDailyWeather(geo: Geo, isoDate: string): Promise<WeatherDaily> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(String(geo.latitude))}` +
    `&longitude=${encodeURIComponent(String(geo.longitude))}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto` +
    `&start_date=${encodeURIComponent(isoDate)}` +
    `&end_date=${encodeURIComponent(isoDate)}`

  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error("此日期距離今日超過 16 日，暫未能提供天氣預報。")

  const data = (await res.json()) as {
    daily?: {
      weathercode?: number[]
      temperature_2m_min?: number[]
      temperature_2m_max?: number[]
    }
  }

  const code = data.daily?.weathercode?.[0]
  const tmin = data.daily?.temperature_2m_min?.[0]
  const tmax = data.daily?.temperature_2m_max?.[0]

  if (typeof code !== "number" || typeof tmin !== "number" || typeof tmax !== "number") {
    throw new Error("天氣資料格式唔完整")
  }

  return {
    kind: weatherCodeToKind(code),
    tempMin: Math.round(tmin),
    tempMax: Math.round(tmax),
    description: weatherCodeToText(code),
    resolvedName: geo.resolvedName,
  }
}

type ActivityFormState = {
  time: string
  name: string
  location: string
  type: ActivityType
  notes: string
}

const emptyActivityForm: ActivityFormState = {
  time: "",
  name: "",
  location: "",
  type: "sightseeing",
  notes: "",
}

function activityTypeMeta(type: ActivityType) {
  const map: Record<ActivityType, { label: string; dot: string }> = {
    food: { label: "餐廳", dot: "bg-orange-400" },
    sightseeing: { label: "景點", dot: "bg-sky-500" },
    transport: { label: "交通", dot: "bg-emerald-500" },
    accommodation: { label: "住宿", dot: "bg-violet-500" },
    shopping: { label: "購物", dot: "bg-pink-500" },
    relaxation: { label: "休息", dot: "bg-amber-500" },
  }
  return map[type] ?? { label: "其他", dot: "bg-zinc-400" }
}

export default function Page() {
  const router = useRouter()
  const params = useParams<{ tripId: string }>()
  const tripId = typeof params?.tripId === "string" ? params.tripId : String(params?.tripId ?? "")

  const trip = useTripsStore((s) => s.trips.find((t) => t.id === tripId))
  const upsertTrip = useTripsStore((s) => s.upsertTrip)

  const [selectedDateIndex, setSelectedDateIndex] = useState(0)

  // 活動彈窗
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [activityForm, setActivityForm] = useState<ActivityFormState>(emptyActivityForm)
  const [editingActivityFullIndex, setEditingActivityFullIndex] = useState<number | null>(null)
  const [activeActivityMenuFullIndex, setActiveActivityMenuFullIndex] = useState<number | null>(null)

  // 住宿彈窗
  const [showAccommodationModal, setShowAccommodationModal] = useState(false)
  const [accommodationName, setAccommodationName] = useState("")

  // 刪除確認
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingDeleteActivityFullIndex, setPendingDeleteActivityFullIndex] = useState<number | null>(null)

  // 日期列表
  const dates = useMemo(() => {
    if (!trip) return []
    return trip.dates?.length ? trip.dates : buildDatesFromRange(trip.startDate, trip.endDate)
  }, [trip])

  const selectedIsoDate = dates[selectedDateIndex] ?? dates[0] ?? ""
  const dayNum = selectedDateIndex + 1

  const dateOptions = useMemo(() => {
    return dates.map((d) => {
      const dt = new Date(d)
      const weekday = weekdayNames[dt.getDay()] ?? ""
      return { date: d, weekday, day: dt.getDate() }
    })
  }, [dates])

  const selectedDateLabel = useMemo(() => {
    if (!dateOptions.length) return ""
    const d = dateOptions[selectedDateIndex] ?? dateOptions[0]
    return d ? `週${d.weekday} ${d.day} · ${formatDateDisplay(d.date)}` : ""
  }, [dateOptions, selectedDateIndex])

  const currentAccommodation = useMemo(() => {
    if (!trip?.accommodations) return null
    return trip.accommodations[dayNum]?.name ?? null
  }, [trip, dayNum])

  const currentDayActivities = useMemo(() => {
    if (!trip) return [] as Array<{ item: ItineraryItem; fullIndex: number }>
    const all = (trip.itinerary ?? []) as ItineraryItem[]
    const list: Array<{ item: ItineraryItem; fullIndex: number }> = []
    for (let i = 0; i < all.length; i++) {
      const it = all[i]
      if (it?.day === dayNum) list.push({ item: it, fullIndex: i })
    }
    list.sort((a, b) => parseTimeToNumber(a.item.time) - parseTimeToNumber(b.item.time))
    return list
  }, [trip, dayNum])

  function cloneTrip(t: Trip): Trip {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc: any = (globalThis as any).structuredClone
    if (typeof sc === "function") return sc(t)
    return JSON.parse(JSON.stringify(t)) as Trip
  }

  function commitTrip(mutator: (next: Trip) => void) {
    if (!trip) return
    const next = cloneTrip(trip)
    mutator(next)
    upsertTrip(next)
  }

  // 令 selectedDateIndex 唔會 out of range
  useEffect(() => {
    if (!trip) return
    if (!dates.length) return
    setSelectedDateIndex((i) => (i >= dates.length ? 0 : i))
  }, [trip, dates.length])

  // ✅ 當日地點：用按鈕開彈窗
  const [showPlaceModal, setShowPlaceModal] = useState(false)
  const [placeDraft, setPlaceDraft] = useState("")
  const [placeSaving, setPlaceSaving] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)

  // 天氣狀態
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherDaily | null>(null)

  const savedDayPlace = trip?.dayPlaces?.[selectedIsoDate]
  const savedPlaceText = savedDayPlace?.location?.trim() || ""
  const savedResolvedName = savedDayPlace?.geo?.resolvedName?.trim() || ""

  // 切換日子時：同步 placeDraft + 如有 geo 直接抓天氣
  useEffect(() => {
    if (!trip || !selectedIsoDate) return

    setPlaceDraft(trip.dayPlaces?.[selectedIsoDate]?.location ?? "")
    setPlaceError(null)

    const geo = trip.dayPlaces?.[selectedIsoDate]?.geo
    if (geo) {
      setWeatherLoading(true)
      setWeatherError(null)
      fetchDailyWeather(geo, selectedIsoDate)
        .then((w) => setWeather(w))
        .catch((e: unknown) => {
          setWeather(null)
          setWeatherError(e instanceof Error ? e.message : "此日期距離今日超過 16 日，暫未能提供天氣預報。")
        })
        .finally(() => setWeatherLoading(false))
    } else {
      setWeather(null)
      setWeatherError(null)
    }
  }, [trip, selectedIsoDate])

  async function handleSaveDayPlace() {
    if (!trip || !selectedIsoDate) return
    const name = placeDraft.trim()
    if (!name) {
      setPlaceError("請輸入當日地點")
      return
    }

    setPlaceSaving(true)
    setPlaceError(null)
    setWeatherError(null)

    try {
      const geo = await geocodePlace(name)
      commitTrip((next) => {
  if (!next.dayPlaces) next.dayPlaces = {};
  next.dayPlaces[selectedIsoDate] = { location: name, geo };
});


      setWeatherLoading(true)
      const w = await fetchDailyWeather(geo, selectedIsoDate)
      setWeather(w)

      setShowPlaceModal(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "儲存失敗"
      setPlaceError(msg)
      setWeather(null)
      setWeatherError(msg)
    } finally {
      setWeatherLoading(false)
      setPlaceSaving(false)
    }
  }

  // 活動 CRUD
  function openAddActivity() {
    setEditingActivityFullIndex(null)
    setActivityForm(emptyActivityForm)
    setActiveActivityMenuFullIndex(null)
    setShowActivityModal(true)
  }

  function openEditActivity(fullIndex: number) {
    if (!trip?.itinerary?.[fullIndex]) return
    const a = trip.itinerary[fullIndex] as ItineraryItem
    setEditingActivityFullIndex(fullIndex)
    setActivityForm({
      time: a.time ?? "",
      name: a.name ?? "",
      location: a.location ?? "",
      type: (a.type as ActivityType) ?? "sightseeing",
      notes: a.notes ?? "",
    })
    setActiveActivityMenuFullIndex(null)
    setShowActivityModal(true)
  }

  function saveActivity() {
    if (!activityForm.time || !activityForm.name || !activityForm.location) {
      window.alert("請填寫：時間、名稱、地點")
      return
    }

    commitTrip((next) => {
      if (!next.itinerary) next.itinerary = []
      if (editingActivityFullIndex !== null) {
        next.itinerary[editingActivityFullIndex] = {
          ...(next.itinerary[editingActivityFullIndex] as ItineraryItem),
          day: dayNum,
          time: activityForm.time,
          name: activityForm.name,
          location: activityForm.location,
          type: activityForm.type,
          notes: activityForm.notes,
        }
      } else {
        next.itinerary.push({
          day: dayNum,
          time: activityForm.time,
          name: activityForm.name,
          location: activityForm.location,
          type: activityForm.type,
          notes: activityForm.notes,
        })
      }
    })

    setShowActivityModal(false)
    setActivityForm(emptyActivityForm)
    setEditingActivityFullIndex(null)
  }

  function requestDeleteActivity(fullIndex: number) {
    setPendingDeleteActivityFullIndex(fullIndex)
    setActiveActivityMenuFullIndex(null)
    setShowDeleteConfirm(true)
  }

  function confirmDeleteActivity() {
    if (pendingDeleteActivityFullIndex === null) return
    commitTrip((next) => {
      if (!next.itinerary) return
      if (pendingDeleteActivityFullIndex < 0 || pendingDeleteActivityFullIndex >= next.itinerary.length) return
      next.itinerary.splice(pendingDeleteActivityFullIndex, 1)
    })
    setShowDeleteConfirm(false)
    setPendingDeleteActivityFullIndex(null)
  }

  // 住宿
  function openAccommodationEditor() {
    setAccommodationName(currentAccommodation ?? "")
    setShowAccommodationModal(true)
  }

  function saveAccommodation() {
    if (!accommodationName.trim()) {
      window.alert("請輸入住宿名稱")
      return
    }
    commitTrip((next) => {
      if (!next.accommodations) next.accommodations = {}
      next.accommodations[dayNum] = { name: accommodationName.trim() }
    })
    setShowAccommodationModal(false)
  }

  if (!trip) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3">
          <button
  onClick={() => window.location.assign("/")}
  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm hover:bg-[color:var(--card)]/90"
  aria-label="返回首頁"
>
  <ArrowLeft className="h-5 w-5 text-zinc-700" />
</button>
          <div className="text-sm text-[color:var(--muted-foreground)]">找不到旅程／載入中…</div>
        </div>
      </div>
    )
  }

  const daysToStart = countdownDaysToStart(trip.startDate)
  const progress = countdownProgress(trip.startDate, trip.endDate)

  return (
    <div className="px-4 pt-4 pb-10 bg-gradient-to-b from-[color:var(--background)] to-[color:var(--card)]">
      {/* 頂部 */}
      <div className="mb-4 flex items-center gap-3">
        <button
  onClick={() => router.push("/")}
  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm hover:bg-[color:var(--card)]/90"
  aria-label="返回首頁"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-700" />
        </button>

        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-[color:var(--foreground)]">{trip.title}</div>
          <div className="flex items-center gap-1 text-sm text-[color:var(--muted-foreground)]">
            <MapPin className="h-4 w-4" />
            <span className="truncate">{trip.location}</span>
          </div>
        </div>
      </div>

      {/* 封面 */}
      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-card shadow-sm">
        {trip.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trip.coverImage} alt={trip.title} className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-48 items-center justify-center bg-gradient-to-br from-[color:var(--hero-from)] to-[color:var(--hero-to)]  text-4xl font-bold text-[var(--primary-foreground)]">
            旅
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
            <Calendar className="h-4 w-4" />
            <span>{formatDateRangeChinese(trip.dates?.length ? trip.dates : dates)}</span>
          </div>
        </div>
      </div>

      {/* 倒數 / 進度 */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
        <div className="text-sm text-[color:var(--muted-foreground)]">出發倒數</div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-4xl font-extrabold text-foreground">{countdownDaysText(daysToStart)}</div>
          {daysToStart > 0 ? <div className="text-sm text-[color:var(--muted-foreground)]">日</div> : null}
        </div>

        <div className="mt-3">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-[color:var(--primary)]/10">
  <div
    className="h-3 rounded-full bg-[color:var(--primary)]"
    style={{ width: `${progress}%` }}
  />
</div>
          <div className="mt-1 text-xs text-[color:var(--muted-foreground)]">{formatDateDisplay(trip.startDate)}</div>
        </div>
      </div>

      {/* 選擇日子 */}
      <div className="mt-4">
        <div className="mb-2 px-1 text-sm text-zinc-700">選擇日子</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dateOptions.map((d, idx) => {
            const active = idx === selectedDateIndex
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDateIndex(idx)}
                className={[
                  "min-w-[52px] flex-shrink-0 rounded-xl border px-3 py-2 text-center text-xs transition",
                  active
                    ? "border-rose-500 bg-[color:var(--primary)] font-semibold text-[var(--primary-foreground)]"
                    : "border-[color:var(--border)] bg-zinc-50 text-zinc-700 hover:bg-card",
                ].join(" ")}
              >
                <div>{`週${d.weekday}`}</div>
                <div className="mt-1 text-sm font-bold">{d.day}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 當日標題卡 */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
        <div className="text-xs text-[color:var(--muted-foreground)]">{selectedDateLabel}</div>
        <div className="mt-1 text-lg font-bold text-foreground">第 {dayNum} 日</div>

        {/* ✅ 隱藏輸入：只顯示地點 + 按鈕 */}
        <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-700">當日地點</div>
              <div className="mt-1 truncate text-sm font-semibold text-foreground">
                {savedPlaceText ? savedPlaceText : "未設定"}
              </div>
              {savedResolvedName ? (
                <a
                  className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--primary)] hover:underline"
                  href={mapsSearchUrl(savedResolvedName)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Google 地圖
                </a>
              ) : null}
            </div>

            <button
              onClick={() => {
                setPlaceDraft(savedPlaceText)
                setPlaceError(null)
                setShowPlaceModal(true)
              }}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border)] bg-card px-3 text-xs font-semibold text-[color:var(--primary-foreground)] hover:bg-zinc-50"
            >
              {savedPlaceText ? "修改地點" : "設定地點"}
            </button>
          </div>

          {weatherError ? <div className="mt-2 text-xs text-red-600">{weatherError}</div> : null}
        </div>
      </div>

      {/* 天氣卡 */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-rose-50 p-2 text-[color:var(--primary)]">
            <WeatherIcon kind={weather?.kind ?? "cloudSun"} />
          </div>

          <div className="min-w-0">
            <div className="text-sm text-[color:var(--muted-foreground)]">天氣（最高 / 最低）</div>

            {weatherLoading ? (
              <div className="mt-1 text-sm font-semibold text-foreground">載入中…</div>
            ) : weather ? (
              <div className="mt-1 text-lg font-extrabold text-foreground">
                {weather.tempMax}°C <span className="text-sm font-semibold text-[color:var(--muted-foreground)]">/ {weather.tempMin}°C</span>
              </div>
            ) : (
              <div className="mt-1 text-sm font-semibold text-foreground">未有天氣資料</div>
            )}
          </div>
        </div>

        <div className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          {weatherLoading
            ? "正在更新天氣…"
            : weather
              ? weather.description
              : savedPlaceText
                ? "請按「設定／修改地點」再儲存一次，以更新天氣。"
                : "先設定當日地點，先會顯示天氣。"}
        </div>

        {weather?.resolvedName ? <div className="mt-2 text-xs text-[color:var(--muted-foreground)]">地點：{weather.resolvedName}</div> : null}
      </div>

      {/* 住宿卡 */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-rose-50 p-2 text-[color:var(--primary)]">
              <BedDouble className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-[color:var(--muted-foreground)]">住宿</div>
              <div className="mt-1 truncate font-semibold text-foreground">{currentAccommodation ?? "-"}</div>
              {currentAccommodation ? (
                <a
                  href={mapsSearchUrl(currentAccommodation)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--primary)] hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Google 地圖
                </a>
              ) : null}
            </div>
          </div>

          <button
            onClick={openAccommodationEditor}
            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border)] bg-card p-2 text-[color:var(--muted-foreground)] hover:bg-zinc-50"
            aria-label="編輯住宿"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 活動時間線 */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">今日行程</div>
          <button
            onClick={openAddActivity}
            className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--menu-btn-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--menu-btn-fg)] hover:bg-rose-600"
          >
            <Plus className="h-4 w-4" />
            新增活動
          </button>
        </div>

        {currentDayActivities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center text-sm text-[color:var(--muted-foreground)]">
            今日未有活動，按「新增活動」開始規劃。
          </div>
        ) : (
          <div className="space-y-4">
            {currentDayActivities.map(({ item, fullIndex }, idx) => {
              const meta = activityTypeMeta(item.type)
              const isLast = idx === currentDayActivities.length - 1
              return (
                <div key={`${fullIndex}-${item.time}-${item.name}`} className="relative">
                  {!isLast ? (
                    <div className="absolute left-5 top-12 h-10 w-1 rounded-full bg-[color:var(--primary)]" />
                  ) : null}

                  <div className="flex gap-3">
                    <div className="relative mt-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--primary)] text-[11px] font-bold text-[var(--primary-foreground)]">
                        {item.time}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                            <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} />
                            <span className="shrink-0">{meta.label}</span>
                            <span className="text-zinc-400">•</span>
                            <span className="truncate">{item.location}</span>
                          </div>

                          <a
                            href={mapsSearchUrl(item.location)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--primary)] hover:underline"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            Google 地圖
                          </a>

                          {item.notes ? <div className="mt-2 text-sm text-[color:var(--muted-foreground)]">{item.notes}</div> : null}
                        </div>

                        <div className="relative">
                          <button
                            onClick={() => setActiveActivityMenuFullIndex((v) => (v === fullIndex ? null : fullIndex))}
                            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border)] bg-card p-2 text-[color:var(--muted-foreground)] hover:bg-zinc-50"
                            aria-label="活動選單"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {activeActivityMenuFullIndex === fullIndex ? (
                            <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-xl border border-[color:var(--border)] bg-card shadow-lg">
                              <button
                                onClick={() => openEditActivity(fullIndex)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[color:var(--primary-foreground)] hover:bg-gray-50"
                              >
                                <Pencil className="h-4 w-4" />
                                編輯
                              </button>
                              <button
                                onClick={() => requestDeleteActivity(fullIndex)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-zinc-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                刪除
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ✅ 已按你要求：刪除最底部「＋新增活動」大按鈕 */}
      </div>

      {/* 當日地點彈窗 */}
      {showPlaceModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--border)] bg-card shadow-2xl">
            <div className="p-6">
              <div className="text-center text-xl font-bold text-[color:var(--foreground)]">設定當日地點 · 第 {dayNum} 日</div>
              <div className="mt-2 text-center text-sm text-[color:var(--muted-foreground)]">{formatDateDisplay(selectedIsoDate)}</div>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">地點</label>
                  <input
                    value={placeDraft}
                    onChange={(e) => setPlaceDraft(e.target.value)}
                    placeholder="例如：蘇黎世 / Zurich / Shinjuku Tokyo"
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none focus:border-rose-500 focus:bg-card"
                  />
                  {placeError ? <div className="mt-2 text-xs text-red-600">{placeError}</div> : null}
                  <div className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    提示：地點越完整越易搵到（例如加「Tokyo」「Japan」）。
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleSaveDayPlace}
                    disabled={placeSaving}
                    className="flex-1 rounded-xl bg-[color:var(--primary)] px-4 py-3 text-sm font-bold text-[var(--primary-foreground)] hover:bg-rose-600 disabled:opacity-60"
                  >
                    {placeSaving ? "儲存中…" : "儲存並更新天氣"}
                  </button>
                  <button
                    onClick={() => {
                      setShowPlaceModal(false)
                      setPlaceError(null)
                      setPlaceDraft(savedPlaceText)
                    }}
                    className="flex-1 rounded-xl bg-zinc-200 px-4 py-3 text-sm font-bold text-zinc-800 hover:bg-zinc-300"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 活動彈窗 */}
      {showActivityModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--border)] bg-card shadow-2xl">
            <div className="p-6">
              <div className="text-center text-xl font-bold text-[color:var(--foreground)]">
                {editingActivityFullIndex !== null ? "編輯活動" : "新增活動"}
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">時間</label>
                  <input
                    type="time"
                    value={activityForm.time}
                    onChange={(e) => setActivityForm((s) => ({ ...s, time: e.target.value }))}
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none focus:border-rose-500 focus:bg-card"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">名稱</label>
                  <input
                    value={activityForm.name}
                    onChange={(e) => setActivityForm((s) => ({ ...s, name: e.target.value }))}
                    placeholder="例如：淺草寺"
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none focus:border-rose-500 focus:bg-card"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">地點</label>
                  <input
                    value={activityForm.location}
                    onChange={(e) => setActivityForm((s) => ({ ...s, location: e.target.value }))}
                    placeholder="例如：Tokyo / Shinjuku"
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none focus:border-rose-500 focus:bg-card"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">類型</label>
                  <select
                    value={activityForm.type}
                    onChange={(e) => setActivityForm((s) => ({ ...s, type: e.target.value as ActivityType }))}
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none focus:border-rose-500 focus:bg-card"
                  >
                    <option value="sightseeing">景點</option>
                    <option value="food">餐廳</option>
                    <option value="shopping">購物</option>
                    <option value="transport">交通</option>
                    <option value="accommodation">住宿</option>
                    <option value="relaxation">休息</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[color:var(--foreground)]">備註</label>
                  <textarea
                    value={activityForm.notes}
                    onChange={(e) => setActivityForm((s) => ({ ...s, notes: e.target.value }))}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none focus:border-rose-500 focus:bg-card"
                    placeholder="可選填，例如：記得預約／預算"
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={saveActivity}
                    className="flex-1 rounded-xl bg-[color:var(--primary)] px-4 py-3 text-sm font-bold text-[var(--primary-foreground)] hover:bg-rose-600"
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => {
                      setShowActivityModal(false)
                      setActivityForm(emptyActivityForm)
                      setEditingActivityFullIndex(null)
                    }}
                    className="flex-1 rounded-xl bg-zinc-200 px-4 py-3 text-sm font-bold text-zinc-800 hover:bg-zinc-300"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 住宿彈窗 */}
      {showAccommodationModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl">
            <div className="p-6">
              <div className="text-center text-xl font-bold text-[color:var(--foreground)]">編輯住宿 · 第 {dayNum} 日</div>

              <div className="mt-5">
                <label className="mb-1 block text-sm font-medium text-zinc-700">住宿名稱</label>
                <input
                  value={accommodationName}
                  onChange={(e) => setAccommodationName(e.target.value)}
                  placeholder="例如：Shinjuku Hotel"
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none focus:border-rose-500 focus:bg-card"
                />

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={saveAccommodation}
                    className="flex-1 rounded-xl bg-[color:var(--primary)] px-4 py-3 text-sm font-bold text-[var(--primary-foreground)] hover:bg-rose-600"
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => setShowAccommodationModal(false)}
                    className="flex-1 rounded-xl bg-zinc-200 px-4 py-3 text-sm font-bold text-zinc-800 hover:bg-zinc-300"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 刪除確認 */}
      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-[color:var(--border)] bg-card shadow-2xl">
            <div className="p-6 text-center">
              <div className="text-lg font-bold text-foreground">確認刪除活動？</div>
              <div className="mt-2 text-sm text-[color:var(--muted-foreground)]">此操作無法還原。</div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={confirmDeleteActivity}
                  className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-[var(--primary-foreground)] hover:bg-red-600"
                >
                  刪除
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setPendingDeleteActivityFullIndex(null)
                  }}
                  className="flex-1 rounded-xl bg-zinc-200 px-4 py-3 text-sm font-bold text-zinc-800 hover:bg-zinc-300"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
// @refresh reset
