import { create } from 'zustand';

export const MAX_SEATS_PER_ORDER = 8;

/*
 * Client-only UI state: which seats the user has clicked but not yet held.
 * Server state (events, seat availability) lives in TanStack Query, not here.
 * In phase 2, "Hold seats" will send these ids to a mutation that reserves them in Redis.
 */
type SeatSelectionState = {
  eventId: string | null;
  seatIds: string[];
  toggleSeat: (eventId: string, seatId: string) => void;
  clear: () => void;
};

export const useSeatSelection = create<SeatSelectionState>()((set) => ({
  eventId: null,
  seatIds: [],
  toggleSeat: (eventId, seatId) =>
    set((state) => {
      // Selecting a seat for a different event starts a fresh selection.
      const current = state.eventId === eventId ? state.seatIds : [];
      if (current.includes(seatId)) {
        return { eventId, seatIds: current.filter((id) => id !== seatId) };
      }
      if (current.length >= MAX_SEATS_PER_ORDER) return { eventId, seatIds: current };
      return { eventId, seatIds: [...current, seatId] };
    }),
  clear: () => set({ eventId: null, seatIds: [] }),
}));

/** Selected seat ids for one event (empty if the selection belongs to another event). */
export const useSelectedSeatIds = (eventId: string) =>
  useSeatSelection((state) => (state.eventId === eventId ? state.seatIds : EMPTY));

const EMPTY: string[] = [];
