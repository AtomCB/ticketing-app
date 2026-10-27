import { useMemo } from 'react';
import type { EventQuery } from '../gql/graphql';
import { formatPrice } from '../lib/format';
import { MAX_SEATS_PER_ORDER, useSeatSelection, useSelectedSeatIds } from '../stores/seatSelection';

export type Seat = NonNullable<EventQuery['event']>['seats'][number];

type Section = { name: string; priceCents: number; rows: { label: string; seats: Seat[] }[] };

// The API returns seats ordered by section, row and number, so grouping keeps that order.
function groupSeats(seats: Seat[]): Section[] {
  const sections = new Map<string, Section>();
  for (const seat of seats) {
    let section = sections.get(seat.section);
    if (!section) {
      section = { name: seat.section, priceCents: seat.priceCents, rows: [] };
      sections.set(seat.section, section);
    }
    let row = section.rows.at(-1);
    if (row?.label !== seat.row) {
      row = { label: seat.row, seats: [] };
      section.rows.push(row);
    }
    row.seats.push(seat);
  }
  return [...sections.values()];
}

export function SeatMap({ eventId, seats, selectable }: { eventId: string; seats: Seat[]; selectable: boolean }) {
  const sections = useMemo(() => groupSeats(seats), [seats]);
  const selectedIds = useSelectedSeatIds(eventId);
  const toggleSeat = useSeatSelection((state) => state.toggleSeat);
  const atLimit = selectedIds.length >= MAX_SEATS_PER_ORDER;

  return (
    <section aria-label="Seat map" className="rounded-xl bg-stock p-4 sm:p-6">
      <div className="mx-auto mb-10 grid h-10 w-3/4 max-w-md place-items-center rounded-b-[2rem] bg-ink text-sm font-semibold text-paper">
        Stage
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="mx-auto flex w-max flex-col items-center gap-8">
          {sections.map((section) => (
            <div key={section.name} className="flex flex-col items-center">
              <h3 className="mb-3 flex items-baseline gap-2">
                <span className="font-display text-lg font-bold">{section.name}</span>
                <span className="text-sm text-mute">{formatPrice(section.priceCents)}</span>
              </h3>

              <div className="flex flex-col gap-1.5">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex items-center gap-1.5">
                    <span className="w-4 text-center text-xs text-mute" aria-hidden="true">
                      {row.label}
                    </span>
                    {row.seats.map((seat) => {
                      const selected = selectedIds.includes(seat.id);
                      const available = seat.status === 'AVAILABLE';
                      const disabled = !selectable || !available || (atLimit && !selected);
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          disabled={disabled}
                          aria-pressed={selected}
                          aria-label={`${section.name}, row ${row.label}, seat ${seat.number}, ${formatPrice(seat.priceCents)}${available ? '' : ', unavailable'}`}
                          title={`Row ${row.label}, seat ${seat.number}`}
                          onClick={() => toggleSeat(eventId, seat.id)}
                          className={seatClass(selected, available, selectable)}
                        />
                      );
                    })}
                    <span className="w-4 text-center text-xs text-mute" aria-hidden="true">
                      {row.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-mute">
        <LegendItem className={seatClass(false, true, true)} label="Available" />
        <LegendItem className={seatClass(true, true, true)} label="Your pick" />
        <LegendItem className={seatClass(false, false, true)} label="Taken" />
      </ul>
    </section>
  );
}

// Seats are drawn as little chairs: a rounded back and a squarer front edge.
function seatClass(selected: boolean, available: boolean, selectable: boolean) {
  const base = 'size-6 shrink-0 rounded-t-[0.55rem] rounded-b-[0.2rem] border-2 transition-colors';
  if (selected) return `${base} border-[#d99a1e] bg-marigold`;
  if (!available) return `${base} border-transparent bg-sold`;
  if (!selectable) return `${base} border-rule bg-stock`;
  return `${base} border-cobalt/70 bg-stock hover:bg-cobalt/15 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-stock`;
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={className.replace('size-6', 'size-4')} aria-hidden="true" />
      {label}
    </li>
  );
}
