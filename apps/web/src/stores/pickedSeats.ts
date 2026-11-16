import { create } from "zustand";
import type { Seat } from "../routes/EventPage";

/** Most seats one person can pick (and later hold) at once. */
export const MAX_PICKS = 8;

/**
 * Seats the viewer has picked on an event page but not held yet. Client-only state:
 * nothing is reserved on the server until a hold (milestone 10), so this deliberately
 * isn't persisted, and a reload starts fresh.
 */
interface PickedSeatsState {
  /** The event the picks belong to. Picking on a different event starts a new list. */
  eventId: string | null;
  /** Whole seats (not just ids), so the side panel can show labels, prices and a total. */
  seats: Seat[];
  /** Picks the seat, or un-picks it if it's already picked. */
  toggle: (eventId: string, seat: Seat) => void;
  remove: (seatId: string) => void;
  clear: () => void;
}

export const usePickedSeatsStore = create<PickedSeatsState>()((set, get) => ({
  eventId: null,
  seats: [],

  toggle: (eventId, seat) => {
    // Picks from another event don't carry over.
    const seats = get().eventId === eventId ? get().seats : [];

    if (seats.some((s) => s.id === seat.id)) {
      set({ eventId, seats: seats.filter((s) => s.id !== seat.id) });
    } else if (seats.length < MAX_PICKS) {
      // The limit only stops adding; un-picking always works.
      set({ eventId, seats: [...seats, seat] });
    }
  },

  remove: (seatId) => set({ seats: get().seats.filter((s) => s.id !== seatId) }),

  clear: () => set({ eventId: null, seats: [] }),
}));
