import { Link } from "react-router";
import type { EventListItem } from "../routes/EventsPage";
import { eventDateParts, formatPrice } from "../lib/format";

interface EventTicketProps {
  event: EventListItem;
}

// What the stub shows under the date for each status. ON_SALE has no fixed label: it shows
// the cheapest available price instead (see stubText). Typed by the status union, so adding
// a status to the schema makes this a type error until it's handled here.
const stubLabel: Record<EventListItem["status"], string | null> = {
  SCHEDULED: "On sale soon",
  ON_SALE: null,
  SOLD_OUT: "Sold out",
  CANCELLED: "Cancelled",
};

/**
 * The stub's line under the date. On sale: "from $47", or "Sold out" when nothing is left
 * to buy (every seat sold or held), even if the event's status hasn't caught up yet.
 */
function stubText({ status, availability }: EventListItem): string | null {
  if (status !== "ON_SALE") return stubLabel[status];
  return availability.minPriceCents === null
    ? "Sold out"
    : `from ${formatPrice(availability.minPriceCents)}`;
}

/**
 * One event on the list, drawn as a printed ticket: details on the left, a tear line,
 * and a stub with the date. The whole card links to the event page.
 */
export function EventTicket({ event }: EventTicketProps) {
  const date = eventDateParts(event.startsAt);
  const label = stubText(event);
  const { available, total } = event.availability;
  // The meter is for events you can buy seats for now; the stub covers every other case.
  const showSeatsLeft = event.status === "ON_SALE" && available > 0;

  return (
    <Link
      to={`/events/${event.id}`}
      className="ticket group flex min-h-37 rounded-xl text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 p-5 sm:p-6">
        <div>
          <p className="text-sm text-mute">
            {event.venue.name}, {event.venue.city}
          </p>
          <h2 className="mt-1 font-display text-2xl leading-tight font-bold text-balance group-hover:text-cobalt-deep sm:text-3xl">
            {event.name}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <time dateTime={event.startsAt}>{date.weekdayAndTime}</time>
          {showSeatsLeft && <SeatsLeft available={available} total={total} />}
        </div>
      </div>

      {/* The stub. Its width comes from --stub on .ticket (index.css), so the notches
          line up with this dashed border at every screen size. The vertical margin of
          one notch radius stops the dashed line where the notches begin, instead of
          drawing it through them. */}
      <div className="my-(--notch) flex w-(--stub) shrink-0 flex-col items-center justify-center border-l-2 border-dashed border-rule px-2 py-4 text-center">
        <span className="text-sm text-mute">{date.monthShort}</span>
        <span className="font-display text-5xl leading-none font-extrabold">{date.day}</span>
        {label && <span className="mt-3 text-sm font-semibold">{label}</span>}
      </div>
    </Link>
  );
}

/**
 * "98 of 220 seats left", with a small bar that fills as seats go. The counts come from the
 * cached availability, so they can be a few seconds behind; fine for a list, never for
 * deciding whether a seat can be held. The bar is hidden from screen readers because the
 * text already says the same thing.
 */
function SeatsLeft({ available, total }: { available: number; total: number }) {
  const gonePercent = Math.round((1 - available / total) * 100);
  return (
    // On narrow cards the phrase drops below the bar as a whole instead of breaking mid-way;
    // the bar is shorter on phones so it usually fits on one line.
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-mute">
      <span aria-hidden="true" className="block h-1.5 w-14 overflow-hidden rounded-full bg-paper sm:w-20">
        {/* A width that changes per event can't be a Tailwind class, so it's an inline style. */}
        <span className="block h-full rounded-full bg-cobalt" style={{ width: `${gonePercent}%` }} />
      </span>
      <span className="whitespace-nowrap">
        {available} of {total} {available === 1 ? "seat" : "seats"} left
      </span>
    </span>
  );
}
