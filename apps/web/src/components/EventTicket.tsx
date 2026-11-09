import { Link } from "react-router";
import type { EventListItem } from "../routes/EventsPage";
import { eventDateParts } from "../lib/format";

interface EventTicketProps {
  event: EventListItem;
}

// What the stub shows under the date for each status. ON_SALE shows the lowest price
// once the API has the availability field (milestone 8), so it's empty for now.
// Typed by the status union, so adding a status to the schema makes this a type error
// until it's handled here.
const stubLabel: Record<EventListItem["status"], string | null> = {
  SCHEDULED: "On sale soon",
  ON_SALE: null,
  SOLD_OUT: "Sold out",
  CANCELLED: "Cancelled",
};

/**
 * One event on the list, drawn as a printed ticket: details on the left, a tear line,
 * and a stub with the date. The whole card links to the event page.
 */
export function EventTicket({ event }: EventTicketProps) {
  const date = eventDateParts(event.startsAt);
  const label = stubLabel[event.status];

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
          {/* Seats-left bar goes here once the API has the availability field (milestone 8). */}
        </div>
      </div>

      {/* The stub. Its width comes from --stub on .ticket (index.css), so the notches
          line up with this dashed border at every screen size. The vertical margin of
          one notch radius stops the dashed line where the notches begin, instead of
          drawing it through them. */}
      <div className="my-(--notch) flex w-(--stub) shrink-0 flex-col items-center justify-center border-l-2 border-dashed border-rule px-2 py-4 text-center">
        <span className="text-sm text-mute">{date.month}</span>
        <span className="font-display text-5xl leading-none font-extrabold">{date.day}</span>
        {label && <span className="mt-3 text-sm font-semibold">{label}</span>}
      </div>
    </Link>
  );
}
