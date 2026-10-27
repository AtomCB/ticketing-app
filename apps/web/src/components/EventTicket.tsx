import { Link } from 'react-router';
import type { EventsQuery } from '../gql/graphql';
import { dateParts, formatPrice } from '../lib/format';

type EventNode = EventsQuery['events']['edges'][number]['node'];

export function EventTicket({ event }: { event: EventNode }) {
  const date = dateParts(event.startsAt);
  const { available, total, minPriceCents } = event.availability;

  const stubLine =
    event.status === 'SOLD_OUT' || available === 0
      ? 'Sold out'
      : event.status === 'SCHEDULED'
        ? 'On sale soon'
        : minPriceCents !== null && minPriceCents !== undefined
          ? `from ${formatPrice(minPriceCents)}`
          : null;

  return (
    <Link to={`/events/${event.id}`} className="ticket group flex min-h-36">
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
          <span>
            {date.weekday}, {date.time}
          </span>
          {event.status === 'ON_SALE' && total > 0 && <SeatsLeft available={available} total={total} />}
        </div>
      </div>

      <div className="ticket-stub flex shrink-0 flex-col items-center justify-center px-2 py-4 text-center">
        <span className="text-sm text-mute">{date.month}</span>
        <span className="font-display text-5xl leading-none font-extrabold">{date.day}</span>
        {stubLine && <span className="mt-3 text-sm font-semibold">{stubLine}</span>}
      </div>
    </Link>
  );
}

function SeatsLeft({ available, total }: { available: number; total: number }) {
  const soldShare = (total - available) / total;
  return (
    <span className="flex items-center gap-2 text-mute">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-paper" aria-hidden="true">
        <span className="block h-full rounded-full bg-cobalt" style={{ width: `${soldShare * 100}%` }} />
      </span>
      {available} of {total} seats left
    </span>
  );
}
