import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { SeatMap } from '../components/SeatMap';
import { SelectionPanel } from '../components/SelectionPanel';
import { graphql } from '../gql';
import { dateParts } from '../lib/format';
import { execute } from '../lib/graphql';
import { NotFound, QueryError } from './errors';

const EventQuery = graphql(`
  query Event($id: ID!) {
    event(id: $id) {
      id
      name
      description
      startsAt
      status
      venue {
        name
        city
      }
      seats {
        id
        section
        row
        number
        priceCents
        status
      }
    }
  }
`);

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const query = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => execute(EventQuery, { id: eventId! }),
    enabled: Boolean(eventId),
    // Poll so seats sold elsewhere turn grey. Phase 2 replaces this with a subscription.
    refetchInterval: 15_000,
  });

  if (query.status === 'pending') {
    return <div className="h-96 animate-pulse rounded-xl bg-stock motion-reduce:animate-none" aria-label="Loading event" />;
  }
  if (query.status === 'error') {
    return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  }

  const event = query.data.event;
  if (!event) return <NotFound />;

  const date = dateParts(event.startsAt);
  const canSelect = event.status === 'ON_SALE';

  return (
    <>
      <Link to="/" className="text-sm font-semibold text-cobalt hover:text-cobalt-deep">
        All events
      </Link>

      <header className="mt-4 max-w-3xl">
        <p className="text-mute">
          {event.venue.name}, {event.venue.city}
        </p>
        <h1 className="mt-1 font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance font-stretch-[85%] sm:text-6xl">
          {event.name}
        </h1>
        <p className="mt-3 text-lg">
          {date.full} at {date.time}
        </p>
        {event.description && <p className="mt-4 max-w-prose leading-relaxed text-mute">{event.description}</p>}
      </header>

      {!canSelect && (
        <p className="mt-8 rounded-lg bg-ink px-4 py-3 font-semibold text-paper">
          {event.status === 'SCHEDULED'
            ? 'Tickets for this event go on sale soon.'
            : event.status === 'SOLD_OUT'
              ? 'This event is sold out.'
              : 'This event has been cancelled.'}
        </p>
      )}

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <SeatMap eventId={event.id} seats={event.seats} selectable={canSelect} />
        <SelectionPanel eventId={event.id} seats={event.seats} />
      </div>
    </>
  );
}
