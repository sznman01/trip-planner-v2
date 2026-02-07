import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ReservationFlight = {
  flightNumber: string;
  departureLocation: string;
  arrivalLocation: string;
  departureTime: string; // datetime-local
  arrivalTime: string; // datetime-local
  certificate?: string; // base64/url
  notes?: string;
};

export type ReservationHotel = {
  name: string;
  address: string;
  checkInDate: string; // yyyy-mm-dd
  checkOutDate: string; // yyyy-mm-dd
  checkOutTime?: string; // hh:mm
  certificate?: string;
  notes?: string;
};

export type ReservationTicket = {
  name: string;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  certificate?: string;
  notes?: string;
};

export type Reservations = {
  flights: ReservationFlight[];
  hotels: ReservationHotel[];
  tickets: ReservationTicket[];
};

export type ActivityType = 'sightseeing' | 'food' | 'transport' | 'accommodation' | 'shopping' | 'relaxation';

export type Activity = {
  day: number;
  time: string; // hh:mm
  name: string;
  type: string; // sightseeing/food/shopping/transport/accommodation/...
  location: string;
  notes?: string;
  cost?: number;
};

export type TripExpense = {
  title: string;
  category: "food" | "attraction" | "shopping" | "transport" | "other";
  originalAmount: number;
  amountHKD: number;
  originalCurrency: string;
  date: string; // yyyy-mm-dd
  notes?: string;
};

export type ShoppingItem = {
  name: string;
  shop?: string;
  category?: "normal" | "important" | "snack";
  image?: string;
  purchased?: boolean;
};

export type ChecklistItem = {
  name: string;
  subtitle?: string;
  date?: string; // yyyy-mm-dd
  group: string;
  tag?: "general" | "important";
  completed?: boolean;
};

export type MemberPayment = {
  id?: string;
  amount: number; // HKD
  description: string;
  date: string; // yyyy-mm-dd
};

export type Member = {
  id?: string;
  name: string;
  role?: string;
  gender?: "male" | "female";
  payments?: MemberPayment[];
};

export type Trip = {
  id: string;
  title: string;
  location: string; // display / region
  currencyCode: string;

  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  dates: string[];

  description?: string;
  coverImage?: string;

  itinerary: Activity[];
  accommodations: Record<number, { name: string }>;
  reservations: Reservations;

  totalBudget: number;
  expenses: TripExpense[];

  shoppingList: ShoppingItem[];
  checklist: ChecklistItem[];

  members: Member[];
};

// 建 trip 時，唔需要你一次過提供晒全部 array/object
type AddTripInput =
  & Pick<Trip, "title" | "location" | "currencyCode" | "startDate" | "endDate">
  & Partial<
    Pick<
      Trip,
      | "dates"
      | "description"
      | "coverImage"
      | "itinerary"
      | "accommodations"
      | "reservations"
      | "totalBudget"
      | "expenses"
      | "shoppingList"
      | "checklist"
      | "members"
    >
  >;

type TripsState = {
  trips: Trip[];
  addTrip: (trip: AddTripInput) => string;
  upsertTrip: (trip: Trip) => void;
  deleteTrip: (id: string) => void;
  resetAll: () => void;
};

function computeDates(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const out: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    out.push(d.toISOString().split("T")[0]!);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function safeUUID() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {}
  return `trip_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function createEmptyTrip(input: AddTripInput): Omit<Trip, "id"> {
  const dates = input.dates?.length ? input.dates : computeDates(input.startDate, input.endDate);

  return {
    title: input.title,
    location: input.location,
    currencyCode: input.currencyCode,

    startDate: input.startDate,
    endDate: input.endDate,
    dates,

    description: input.description,
    coverImage: input.coverImage,

    itinerary: Array.isArray(input.itinerary) ? input.itinerary : [],
    accommodations: input.accommodations ?? {},
    reservations: input.reservations ?? { flights: [], hotels: [], tickets: [] },

    totalBudget: Number.isFinite(input.totalBudget) ? Number(input.totalBudget) : 0,
    expenses: Array.isArray(input.expenses) ? input.expenses : [],

    shoppingList: Array.isArray(input.shoppingList) ? input.shoppingList : [],
    checklist: Array.isArray(input.checklist) ? input.checklist : [],

    members: Array.isArray(input.members) ? input.members : [],
  };
}

export const useTripsStore = create<TripsState>()(
  persist(
    (set) => ({
      trips: [],

      addTrip: (tripInput) => {
        const id = safeUUID();
        const trip = createEmptyTrip(tripInput);

        set((s) => ({
          trips: [...s.trips, { ...trip, id }],
        }));

        return id;
      },

      upsertTrip: (trip) => {
        set((s) => {
          const i = s.trips.findIndex((t) => t.id === trip.id);
          if (i === -1) return { trips: [...s.trips, trip] };

          const next = s.trips.slice();
          next[i] = trip;
          return { trips: next };
        });
      },

      deleteTrip: (id) => {
        set((s) => ({ trips: s.trips.filter((t) => t.id !== id) }));
      },

      resetAll: () => set({ trips: [] }),
    }),
    {
      name: "travelTrips_v2",
      version: 1,
      storage: createJSONStorage(() => localStorage), // 官方建議寫法 [web:27]
      partialize: (state) => ({ trips: state.trips }),
    }
  )
);
