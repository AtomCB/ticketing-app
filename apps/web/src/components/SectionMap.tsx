import type { Seat } from "../routes/EventPage";
import { useMemo, useState } from "react";

interface SectionMapProps {
  seats: Seat[];
}

export function SectionMap({ seats }: SectionMapProps) {

  if (!seats.length || !seats[0]) {
    return null;
  }

  const seatMap = useMemo(() => {
    const map = new Map<string, Seat[]>();

    seats.forEach((seat => {
      if (map.has(seat.row)) {
        map.get(seat.row)?.push(seat);
      } else {
        map.set(seat.row, [seat]);
      }
    }));

    return map;
  }, seats)

  return (
    <div>
      <div className="flex flex-col gap-2 items-center">
        <div className="flex gap-2 items-center">
          <span className="font-bold text-lg">{seats[0].section}</span>
          <span className="text-mute">{`$${seats[0].priceCents / 100}`}</span>
        </div>

        <div className="flex flex-col gap-2">
          {[...seatMap.values()].map(seats => (
            <SeatRow key={seats[0]!.row} seats={seats} />
          ))}
        </div>
      </div>
    </div>
  );
}


function SeatRow({ seats }: SectionMapProps) {
  return (
    <div className="flex justify-between gap-2">
      <span>{seats[0]!.row}</span>
      {seats.map((seat) => (
        <SeatButton key={seat.id} seat={seat} />
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

function SeatButton({ seat }: { seat: Seat }) {
  const [isSelected, setIsSelected] = useState(false);
  // HELD (in someone else's checkout) and SOLD look the same to the viewer: taken.
  // "Picked" is the viewer's own choice and lives on the client, not in seat.status.
  const taken = seat.status !== "AVAILABLE";
  const label =
    `${seat.section}, row ${seat.row}, seat ${seat.number}, $${seat.priceCents / 100}` +
    (taken ? ", taken" : "");

  return (
    <button
      type="button"
      aria-label={label}
      // TODO: true when this seat is in the picked-seats store.
      aria-pressed={isSelected}
      disabled={taken}
      className={seatClasses}
      onClick={() => setIsSelected((selected) => !selected)}
    />
  );
}
