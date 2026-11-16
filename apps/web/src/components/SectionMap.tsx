import type { Seat } from "../routes/EventPage";
import { useMemo } from "react";
import { usePickedSeatsStore } from "../stores/pickedSeats";
import { formatPrice } from "../lib/format";

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
    <div>
      <div className="flex flex-col gap-2 items-center">
        <div className="flex gap-2 items-center">
          <span className="font-bold text-lg">{seats[0].section}</span>
          <span className="text-mute">{formatPrice(seats[0].priceCents)}</span>
        </div>

        <div className="flex flex-col gap-2">
          {[...seatMap.values()].map(seats => (
            <SeatRow key={seats[0]!.row} eventId={eventId} seats={seats} />
          ))}
        </div>
      </div>
    </div>
  );
}


function SeatRow({ eventId, seats }: SectionMapProps) {
  return (
    <div className="flex justify-between gap-2">
      <span>{seats[0]!.row}</span>
      {seats.map((seat) => (
        <SeatButton key={seat.id} eventId={eventId} seat={seat} />
      ))}
      <span>{seats[0]!.row}</span>
    </div>
  );
}

// One button for every state; attributes pick the look, like FilterPill:
// - available: an empty chair, outlined in the seat colour
// - picked (aria-pressed): a filled marigold chair
// - taken (disabled): a filled grey chair with no outline
// Chair shape: corners rounded more at the top (the backrest) than the bottom.
const seatClasses =
  "block size-6 cursor-pointer rounded-t-[9px] rounded-b-[3px] border-2 border-seat bg-stock " +
  "transition-colors hover:bg-seat/15 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt " +
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
    `${seat.section}, row ${seat.row}, seat ${seat.number}, ${formatPrice(seat.priceCents)}` +
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
