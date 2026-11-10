import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import { graphql } from "../gql";
import type { EventsQuery as EventsQueryResult } from "../gql/graphql";
import { execute } from "../lib/graphql";
import { FilterPill } from "../components/ui/FilterPill";
import { Button } from "../components/ui/Button";
import { EventTicket } from "../components/EventTicket";
import { EventListSkeleton } from "../components/EventTicketSkeleton";
import { LoadError } from "../components/LoadError";

const EventsQuery = graphql(`
  query Events($first: Int!, $after: String, $city: String) {
    events(first: $first, after: $after, city: $city) {
      edges {
        node {
          id
          name
          startsAt
          venue {
            name
            city
          }
          status
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

/** Events per "page". Six matches the mock, and with 8 seeded events it shows "Show more". */
const PAGE_SIZE = 6;

/**
 * One event as returned by EventsQuery. It's derived from the generated result type,
 * so it always matches the fields the query asks for: add a field to the query, run
 * `pnpm codegen`, and this type gains it. Exported for components like the ticket card.
 */
export type EventListItem = EventsQueryResult["events"]["edges"][number]["node"];

export function EventsPage() {
  // The selected city lives in the URL (/?city=Chicago), not in component state, so a
  // filtered list can be bookmarked, shared and reloaded, and Back undoes a filter.
  // No ?city (or an empty one) means all cities.
  const [searchParams, setSearchParams] = useSearchParams();
  const city = searchParams.get("city") || null;

  function selectCity(next: string | null) {
    // Functional update, so any other search params in the URL are kept.
    setSearchParams((params) => {
      const updated = new URLSearchParams(params);
      if (next) updated.set("city", next);
      else updated.delete("city");
      return updated;
    });
  }

  const {
    data,
    isPending,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery({
    // The city is part of the key, so each city's list is cached separately: switching
    // back to a city you've already seen shows its pages instantly.
    queryKey: ["events", city],
    // pageParam is the cursor: null for the first page, then each page's endCursor.
    queryFn: ({ pageParam }) => execute(EventsQuery, { first: PAGE_SIZE, after: pageParam, city }),
    initialPageParam: null as string | null,
    // Returning undefined tells TanStack Query there are no more pages (hasNextPage false).
    getNextPageParam: (last) =>
      last.events.pageInfo.hasNextPage ? last.events.pageInfo.endCursor : undefined,
  });

  // Its own query: built from the loaded events, the list would miss any city whose
  // events are all on pages not loaded yet.
  const { data: citiesData } = useQuery({
    queryKey: ["cities"],
    queryFn: () => execute(CitiesQuery),
  });

  // Every loaded page, in order, as one flat list.
  const events = data?.pages.flatMap((page) => page.events.edges.map((edge) => edge.node)) ?? [];

  function showMore() {
    // Ignore presses while a page is already loading, so a double click can't fetch twice.
    if (!isFetchingNextPage) void fetchNextPage();
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Stacks on phones; title and filters side by side from the sm breakpoint. */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-5xl font-extrabold sm:text-7xl">What's on</h1>

        {citiesData && (
          <div role="group" aria-label="Filter by city" className="flex flex-wrap gap-2">
            <FilterPill selected={city === null} onSelect={() => selectCity(null)}>
              All cities
            </FilterPill>
            {citiesData.cities.map((name) => (
              <FilterPill key={name} selected={city === name} onSelect={() => selectCity(name)}>
                {name}
              </FilterPill>
            ))}
          </div>
        )}
      </div>

      {/*
        Four cases:
        - Pending: no data for this city yet. Also covers "Try again": a query that failed
          with no data goes back to pending when it refetches, so the placeholders show
          while it retries. Switching to a city you haven't loaded also starts here.
        - Data, but no events: the empty state.
        - Data: show it, even if a later background refetch failed. Stale events beat an error.
        - Otherwise the load failed (after the one automatic retry set in main.tsx).
      */}
      {isPending ? (
        <EventListSkeleton />
      ) : data && events.length === 0 ? (
        <NoEvents city={city} onShowAll={() => selectCity(null)} />
      ) : data ? (
        <div className="flex flex-col gap-8">
          {/* A real list, so screen readers announce "list, 8 items". */}
          <ul className="flex flex-col gap-4">
            {events.map((event) => (
              <li key={event.id}>
                <EventTicket event={event} />
              </li>
            ))}
          </ul>

          {isFetchNextPageError && (
            <p role="alert" className="text-sm text-mute">
              Couldn't load more events. Try again.
            </p>
          )}

          {hasNextPage && (
            // aria-disabled rather than disabled while loading: a disabled button drops
            // keyboard focus onto <body>, so keyboard users would lose their place.
            <Button
              variant="outline"
              aria-disabled={isFetchingNextPage}
              onClick={showMore}
              className="self-start aria-disabled:cursor-wait aria-disabled:opacity-60"
            >
              {isFetchingNextPage ? "Loading…" : "Show more events"}
            </Button>
          )}
        </div>
      ) : (
        <LoadError
          title="Couldn't load events"
          message="The ticketing service didn't respond. Check your connection and try again."
          onRetry={() => void refetch()}
        />
      )}
    </div>
  );
}

/**
 * Nothing to show. With a city selected (including one typed into the URL that has no
 * venues), offer the way out; with no filter there's nothing to undo.
 */
function NoEvents({ city, onShowAll }: { city: string | null; onShowAll: () => void }) {
  return (
    <div role="status" className="rounded-xl bg-stock p-7">
      <p className="text-[17px] font-semibold">{city ? `No events in ${city} yet` : "No events yet"}</p>
      <p className="mt-1.5 text-sm text-mute">New shows are added every week.</p>
      {city && (
        <Button variant="text" onClick={onShowAll} className="mt-3.5 text-sm">
          Show events in all cities
        </Button>
      )}
    </div>
  );
}
