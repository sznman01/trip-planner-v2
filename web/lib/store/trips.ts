import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

/** ---------- Types ---------- */

export type Geo = {
  latitude: number;
  longitude: number;
  resolvedName?: string;
  country?: string;
  timezone?: string;
};

export type ReservationFlight = {
  flightNumber: string
  departureLocation: string
  arrivalLocation: string
  departureTime: string // datetime-local
  arrivalTime: string // datetime-local
  certificate?: string // base64/dataURL
  notes?: string
}

export type ReservationHotel = {
  name: string
  address: string
  checkInDate: string // yyyy-mm-dd
  checkOutDate: string // yyyy-mm-dd
  checkOutTime?: string // hh:mm
  certificate?: string
  notes?: string
}

export type ReservationTicket = {
  name: string
  date: string // yyyy-mm-dd
  time: string // hh:mm
  certificate?: string
  notes?: string
}

export type Reservations = {
  flights: ReservationFlight[]
  hotels: ReservationHotel[]
  tickets: ReservationTicket[]
}

export type ActivityType =
  | "sightseeing"
  | "food"
  | "shopping"
  | "transport"
  | "accommodation"
  | "relaxation"

export type Activity = {
  id: string;  // ✅ 必須有
  day: number;
  time: string;
  name: string;
  type: string;
  location: string;
  notes?: string;
  cost?: number;
};

export type TripExpense = {
  title: string
  category: "food" | "attraction" | "shopping" | "transport" | "other"
  originalAmount?: number
  amountHKD?: number
  originalCurrency?: string
  date?: string // yyyy-mm-dd
  notes?: string
}

export type ShoppingItem = {
  name: string
  shop?: string
  category?: string
  normal?: boolean
  important?: boolean
  snack?: boolean
  image?: string
  purchased?: boolean
}

export type ChecklistItem = {
  name: string
  subtitle?: string
  date?: string
  group: string
  tag?: "general" | "important"
  completed?: boolean
}

export type MemberPayment = {
  id?: string
  amount: number
  description: string
  date: string
}

export type Member = {
  id?: string
  name: string
  role?: string
  gender?: "male" | "female"
  payments?: MemberPayment[]
}

export type Trip = {
  id: string;
  title: string;
  location: string;
  currencyCode: string;
  startDate: string;
  endDate: string;
  dates: string[];
  description?: string;
  coverImage?: string;
  
  // ✅ 修正：精準的 dayPlaces 型別
  dayPlaces?: Record<string, { 
    location: string; 
    geo?: Geo; 
  }>;
  
  itinerary: Activity[];
  accommodations: Record<number, { name: string }>;
  reservations: Reservations;
  totalBudget: number;
  expenses: TripExpense[];
  shoppingList: ShoppingItem[];
  checklist: ChecklistItem[];
  members: Member[];
};


export type AddTripInput = Pick<
  Trip,
  "title" | "location" | "currencyCode" | "startDate" | "endDate"
> &
  Partial<
    Pick<
      Trip,
      | "dates"
      | "description"
      | "coverImage"
      | "dayPlaces" 
      | "itinerary"
      | "accommodations"
      | "reservations"
      | "totalBudget"
      | "expenses"
      | "shoppingList"
      | "checklist"
      | "members"
      | "dayPlaces"
    >
  >

export type TripsState = {
  trips: Trip[]
  addTrip: (trip: AddTripInput) => string
  upsertTrip: (trip: Trip) => void
  deleteTrip: (id: string) => void
  resetAll: () => void

  /** ✅ 路線B：Activity actions（唯一入口） */
  addActivity: (tripId: string, data: Omit<Activity, "id">) => string
  updateActivity: (
    tripId: string,
    activityId: string,
    patch: Partial<Omit<Activity, "id">>
  ) => void
  deleteActivity: (tripId: string, activityId: string) => void
  reorderActivities: (tripId: string, day: number, orderedIds: string[]) => void
}

/** ---------- Helpers ---------- */

function safeUUID(prefix = "id") {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    // ignore
  }
  return `${prefix}_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`
}

function computeDates(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  const out: string[] = []
  const d = new Date(start)
  while (d <= end) {
    out.push(d.toISOString().split("T")[0]!)
    d.setDate(d.getDate() + 1)
  }
  return out
}

function createEmptyTrip(input: AddTripInput): Omit<Trip, "id"> {
  const dates = input.dates?.length ? input.dates : computeDates(input.startDate, input.endDate)
  return {
    title: input.title,
    location: input.location,
    currencyCode: input.currencyCode,
    startDate: input.startDate,
    endDate: input.endDate,
    dates,
    description: input.description,
    coverImage: input.coverImage,
     dayPlaces: input.dayPlaces ?? {},  

    itinerary: Array.isArray(input.itinerary) ? input.itinerary : [],
    accommodations: input.accommodations ?? {},
    reservations: input.reservations ?? { flights: [], hotels: [], tickets: [] },

    totalBudget: Number.isFinite(input.totalBudget) ? Number(input.totalBudget) : 0,
    expenses: Array.isArray(input.expenses) ? input.expenses : [],
    shoppingList: Array.isArray(input.shoppingList) ? input.shoppingList : [],
    checklist: Array.isArray(input.checklist) ? input.checklist : [],
    members: Array.isArray(input.members) ? input.members : [],
  }
}

/** ✅ Migration：補 Activity.id（舊資料冇 id 時自動生成） */
function migrateTripEnsureActivityIds(t: Trip): Trip {
  const raw = Array.isArray(t.itinerary) ? t.itinerary : []
  const nextItinerary: Activity[] = raw
    .filter(Boolean)
    .map((a: any) => {
      const id = typeof a?.id === "string" && a.id.trim() ? a.id : safeUUID("act")
      return {
        id,
        day: Number(a?.day ?? 1),
        time: String(a?.time ?? ""),
        name: String(a?.name ?? ""),
        type: (String(a?.type ?? "sightseeing") as ActivityType) || "sightseeing",
        location: String(a?.location ?? ""),
        notes: typeof a?.notes === "string" ? a.notes : "",
        cost: Number.isFinite(Number(a?.cost)) ? Number(a.cost) : undefined,
      }
    })

  return { ...t, itinerary: nextItinerary }
}

function migrateAllTripsEnsureActivityIds(trips: Trip[]): Trip[] {
  if (!Array.isArray(trips)) return []
  return trips.map((t) => migrateTripEnsureActivityIds(t))
}

/** ---------- Store ---------- */

const STORAGE_KEY = "travelTrips_v2"
const STORAGE_VERSION = 2 // ✅ bump version so migration runs

export const useTripsStore = create<TripsState>()(
  persist(
    (set, get) => ({
      trips: [],

      addTrip: (tripInput) => {
        const id = safeUUID("trip")
        const trip: Trip = { id, ...createEmptyTrip(tripInput) }
        // ensure ids right away
        const migrated = migrateTripEnsureActivityIds(trip)
        set((s) => ({ trips: [...s.trips, migrated] }))
        return id
      },

      upsertTrip: (trip) => {
        // always ensure activity ids
        const migrated = migrateTripEnsureActivityIds(trip)
        set((s) => {
          const i = s.trips.findIndex((t) => t.id === migrated.id)
          if (i === -1) return { trips: [...s.trips, migrated] }
          const next = s.trips.slice()
          next[i] = migrated
          return { trips: next }
        })
      },

      deleteTrip: (id) => set((s) => ({ trips: s.trips.filter((t) => t.id !== id) })),

      resetAll: () => set({ trips: [] }),

      /** ---------- Activity actions ---------- */

      addActivity: (tripId, data) => {
        const activityId = safeUUID("act")
        const cur = get().trips.find((t) => t.id === tripId)
        if (!cur) return activityId

        const nextTrip = migrateTripEnsureActivityIds(cur)
        nextTrip.itinerary = [...(nextTrip.itinerary ?? []), { id: activityId, ...data }]
        get().upsertTrip(nextTrip)
        return activityId
      },

      updateActivity: (tripId, activityId, patch) => {
        const cur = get().trips.find((t) => t.id === tripId)
        if (!cur) return

        const nextTrip = migrateTripEnsureActivityIds(cur)
        const idx = (nextTrip.itinerary ?? []).findIndex((a) => a.id === activityId)
        if (idx === -1) return

        const curA = nextTrip.itinerary[idx]
        nextTrip.itinerary[idx] = {
          ...curA,
          ...patch,
          id: curA.id,
        }
        get().upsertTrip(nextTrip)
      },

      deleteActivity: (tripId, activityId) => {
        const cur = get().trips.find((t) => t.id === tripId)
        if (!cur) return

        const nextTrip = migrateTripEnsureActivityIds(cur)
        nextTrip.itinerary = (nextTrip.itinerary ?? []).filter((a) => a.id !== activityId)
        get().upsertTrip(nextTrip)
      },

      reorderActivities: (tripId, day, orderedIds) => {
        const cur = get().trips.find((t) => t.id === tripId)
        if (!cur) return

        const nextTrip = migrateTripEnsureActivityIds(cur)
        const all = nextTrip.itinerary ?? []
        const daySet = new Set(orderedIds)

        const dayItems = all.filter((a) => a.day === day)
        const otherItems = all.filter((a) => a.day !== day)

        const byId = new Map(dayItems.map((a) => [a.id, a] as const))
        const ordered: Activity[] = []
        for (const id of orderedIds) {
          const hit = byId.get(id)
          if (hit) ordered.push(hit)
        }
        // keep any leftover day items (e.g. if orderedIds missing some)
        for (const a of dayItems) {
          if (!daySet.has(a.id)) ordered.push(a)
        }

        nextTrip.itinerary = [...otherItems, ...ordered]
        get().upsertTrip(nextTrip)
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ trips: state.trips }),
      migrate: (persisted: any, version) => {
        // version undefined / 1 -> 2: ensure Activity.id
        const trips = Array.isArray(persisted?.trips) ? (persisted.trips as Trip[]) : []
        const migratedTrips = migrateAllTripsEnsureActivityIds(trips)
        return { ...persisted, trips: migratedTrips }
      },
    }
  )
)
