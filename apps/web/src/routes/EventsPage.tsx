import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { EventTicket } from '../components/EventTicket';
import { graphql } from '../gql';
import { execute } from '../lib/graphql';
import { QueryError } from './errors';

// codegen reads these tagged strings and generates their result + variable types.
const EventsQuery = graphql(`
  query Events($first: Int, $after: String, $city: String) {
    events(first: $first, after: $after, city: $city) {
      edges {
        cursor
        node {
          id
          name
          startsAt
          status
          venue {
            id
            name
            city
          }
          availability {
            total
            available
            minPriceCents
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

const CitiesQuery = graphql(`
  query Cities {
    cities
  }
`);

const PAGE_SIZE = 6;

export function EventsPage() {
  // The city filter lives in the URL (?city=Austin) so it survives reloads and can be shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const city = searchParams.get('city');

  const cities = useQuery({
    queryKey: ['cities'],
    queryFn: () => execute(CitiesQuery),
    staleTime: 5 * 60_000,
  });

  const events = useInfiniteQuery({
    queryKey: ['events', { city }],
    queryFn: ({ pageParam }) => execute(EventsQuery, { first: PAGE_SIZE, after: pageParam, city }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.events.pageInfo.hasNextPage ? lastPage.events.pageInfo.endCursor : undefined,
  });

  const allEvents = events.data?.pages.flatMap((page) => page.events.edges.map((edge) => edge.node)) ?? [];

  const selectCity = (next: string | null) => setSearchParams(next ? { city: next } : {});

  return (
    <>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-5xl font-extrabold tracking-tight font-stretch-[80%] sm:text-7xl">
          What's on
        </h1>

        <div role="group" aria-label="Filter by city" className="flex flex-wrap gap-2">
          {[null, ...(cities.data?.cities ?? [])].map((option) => {
            const active = option === city;
            return (
              <button
                key={option ?? 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => selectCity(option)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-ink text-paper' : 'bg-stock text-ink hover:bg-rule'
                }`}
              >
                {option ?? 'All cities'}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-10">
        {events.status === 'pending' && <TicketSkeletons />}

        {events.status === 'error' && <QueryError error={events.error} onRetry={() => void events.refetch()} />}

        {events.status === 'success' && allEvents.length === 0 && (
          <div className="rounded-xl bg-stock p-8">
            <p className="font-semibold">No events in {city} yet</p>
            <button
              type="button"
              onClick={() => selectCity(null)}
              className="mt-3 text-sm font-semibold text-cobalt hover:text-cobalt-deep"
            >
              Show events in all cities
            </button>
          </div>
        )}

        {allEvents.length > 0 && (
          <ul className="grid gap-4">
            {allEvents.map((event) => (
              <li key={event.id}>
                <EventTicket event={event} />
              </li>
            ))}
          </ul>
        )}

        {events.hasNextPage && (
          <button
            type="button"
            onClick={() => void events.fetchNextPage()}
            disabled={events.isFetchingNextPage}
            className="mt-8 rounded-lg border-2 border-ink px-5 py-2.5 font-semibold hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {events.isFetchingNextPage ? 'Loading more events…' : 'Show more events'}
          </button>
        )}
      </div>
    </>
  );
}

function TicketSkeletons() {
  return (
    <div className="grid gap-4" aria-label="Loading events">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="ticket h-36 animate-pulse motion-reduce:animate-none" />
      ))}
    </div>
  );
}
