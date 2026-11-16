import type { Seat } from "../lib/eventQuery";
import { useMemo } from "react";
import { usePickedSeatsStore } from "../stores/pickedSeats";
import { formatPrice, seatName } from "../lib/format";
import { focusRing } from "./ui/controlBase";

interface SectionMapProps {
  eventId: string;
  seats: Seat[];
}

export function SectionMap({ eventId, seats }: SectionMapProps) {
  // Seats grouped by row. A Map keeps rows in the order they first appear, and the API
  // already sorts seats by row and number, so no sorting is needed here.
  // Hooks go before any early return, so they run in the same order on every render.
  const seatMap = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const seat of seats) {
      const row = map.get(seat.row);
      if (row) row.push(seat);
      else map.set(seat.row, [seat]);
    }
    return map;
  }, [seats]);

  if (!seats.length || !seats[0]) {
    return null;
  }

  return (
    <div className="flex flex-col items-center">
      {/* A heading, so screen reader users can jump from section to section. */}
      <h3 className="mb-3 flex items-baseline gap-2">
        <span className="font-display text-lg font-bold">{seats[0].section}</span>
        <span className="text-sm font-normal text-mute">{formatPrice(seats[0].priceCents)}</span>
      </h3>

      <div className="flex flex-col gap-1.5">
        {[...seatMap.values()].map((rowSeats) => (
          <SeatRow key={rowSeats[0]!.row} eventId={eventId} seats={rowSeats} />
        ))}
      </div>
    </div>
  );
}

function SeatRow({ eventId, seats }: SectionMapProps) {
  const row = seats[0]!.row;
  return (
    <div className="flex items-center gap-1.5">
      <RowLabel>{row}</RowLabel>
      {seats.map((seat) => (
        <SeatButton key={seat.id} eventId={eventId} seat={seat} />
      ))}
      <RowLabel>{row}</RowLabel>
    </div>
  );
}

// Visual only: every seat's label already says its row, so screen readers would
// otherwise hear the row letter again before and after each row.
function RowLabel({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="w-4 text-center text-xs text-mute">
      {children}
    </span>
  );
}

// One button for every state; attributes pick the look, like FilterPill:
// - available: an empty chair, outlined in the seat colour
// - picked (aria-pressed): a filled marigold chair
// - taken (disabled): a filled grey chair with no outline
// Chair shape: corners rounded more at the top (the backrest) than the bottom.
const seatClasses =
  "block size-6 cursor-pointer rounded-t-[9px] rounded-b-[3px] border-2 border-seat bg-stock " +
  `transition-colors hover:bg-seat/15 ${focusRing} ` +
  "aria-pressed:border-seat-picked aria-pressed:bg-marigold " +
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sold";

function SeatButton({ seat, eventId }: { seat: Seat; eventId: string; }) {
  const picked = usePickedSeatsStore(
    (s) => s.eventId === eventId && s.seats.some((p) => p.id === seat.id),
  );
  const toggle = usePickedSeatsStore((s) => s.toggle);
  // HELD (in someone else's checkout) and SOLD look the same to the viewer: taken.
  // "Picked" is the viewer's own choice and lives on the client, not in seat.status.
  const taken = seat.status !== "AVAILABLE";
  const label =
    `${seatName(seat)}, ${formatPrice(seat.priceCents)}` +
    (taken ? ", taken" : "");

  return (
    <button
      type="button"
      aria-label={label}
      // Taken wins over picked: a picked seat that someone else then took (spotted by
      // polling) is disabled, so showing it as "your pick" would be a pick that can't
      // be un-picked here. It stays in the side panel, where it can be removed.
      aria-pressed={picked && !taken}
      disabled={taken}
      className={seatClasses}
      onClick={() => toggle(eventId, seat)}
    />
  );
}
