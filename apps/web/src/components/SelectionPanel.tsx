import { formatPrice } from '../lib/format';
import { MAX_SEATS_PER_ORDER, useSeatSelection, useSelectedSeatIds } from '../stores/seatSelection';
import type { Seat } from './SeatMap';

export function SelectionPanel({ eventId, seats }: { eventId: string; seats: Seat[] }) {
  const selectedIds = useSelectedSeatIds(eventId);
  const toggleSeat = useSeatSelection((state) => state.toggleSeat);
  const clear = useSeatSelection((state) => state.clear);

  // Drop any picked seat that has since been taken by someone else.
  const selected = seats.filter((seat) => selectedIds.includes(seat.id) && seat.status === 'AVAILABLE');
  const totalCents = selected.reduce((sum, seat) => sum + seat.priceCents, 0);

  return (
    <aside className="rounded-xl bg-stock p-5 lg:sticky lg:top-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">Your seats</h2>
        {selected.length > 0 && (
          <button type="button" onClick={clear} className="text-sm font-semibold text-cobalt hover:text-cobalt-deep">
            Clear
          </button>
        )}
      </div>

      {selected.length === 0 ? (
        <p className="mt-3 text-sm text-mute">Pick up to {MAX_SEATS_PER_ORDER} seats on the map.</p>
      ) : (
        <ul className="mt-4 divide-y divide-rule">
          {selected.map((seat) => (
            <li key={seat.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>
                {seat.section}, row {seat.row}, seat {seat.number}
              </span>
              <span className="flex items-center gap-3">
                {formatPrice(seat.priceCents)}
                <button
                  type="button"
                  onClick={() => toggleSeat(eventId, seat.id)}
                  aria-label={`Remove ${seat.section} row ${seat.row} seat ${seat.number}`}
                  className="grid size-6 place-items-center rounded-full text-mute hover:bg-paper hover:text-ink"
                >
                  <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-baseline justify-between border-t-2 border-ink pt-3">
        <span className="font-semibold">Total</span>
        <span className="font-display text-2xl font-bold">{formatPrice(totalCents)}</span>
      </div>

      <button
        type="button"
        disabled
        className="mt-5 w-full rounded-lg bg-cobalt px-4 py-3 font-semibold text-white hover:bg-cobalt-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        Hold seats
      </button>
      <p className="mt-2 text-xs leading-relaxed text-mute">
        Holding seats arrives in phase 2: a 10-minute reservation stored in Redis.
      </p>
    </aside>
  );
}
