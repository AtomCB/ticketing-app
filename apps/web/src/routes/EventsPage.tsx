import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { graphql } from "../gql";
import type { EventsQuery as EventsQueryResult } from "../gql/graphql";
import { execute } from "../lib/graphql";
import { FilterPill } from "../components/ui/FilterPill";
import { EventTicket } from "../components/EventTicket";
import { EventListSkeleton } from "../components/EventTicketSkeleton";
import { LoadError } from "../components/LoadError";

const EventsQuery = graphql(`
  query Events {
    events {
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
`);

/**
 * One event as returned by EventsQuery. It's derived from the generated result type,
 * so it always matches the fields the query asks for: add a field to the query, run
 * `pnpm codegen`, and this type gains it. Exported for components like the ticket card.
 */
export type EventListItem = EventsQueryResult["events"][number];

export function EventsPage() {
  // const { data, isPending, refetch } = useQuery({
  //   queryKey: ["events"],
  //   queryFn: () => execute(EventsQuery),
  // });

  // // Each city once, in the order its first event appears. Depends on `data`, which
  // // keeps the same identity between renders until new data arrives.
  // const cities = useMemo(
  //   () => ["All cities", ...new Set((data?.events ?? []).map((event) => event.venue.city))],
  //   [data],
  // );

  const isPending = true;
  const data = null

  return (
    <div className="flex flex-col gap-10">
      {/* Stacks on phones; title and filters side by side from the sm breakpoint. */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-5xl font-extrabold sm:text-7xl">What's on</h1>

        {/* Only once there's data: until then the only option would be "All cities". */}
        {data && (
          <div role="group" aria-label="Filter by city" className="flex flex-wrap gap-2">
            {cities.map((city) => (
              // TODO: track the selected city (milestone 5 moves it into the URL)
              <FilterPill key={city} selected={false} onSelect={() => {}}>
                {city}
              </FilterPill>
            ))}
          </div>
        )}
      </div>

      {/*
        Three cases:
        - Pending: no data yet. Also covers "Try again": a query that failed with no data
          goes back to pending when it refetches, so the placeholders show while it retries.
        - Data: show it, even if a later background refetch failed. Stale events beat an error.
        - Otherwise the load failed (after the one automatic retry set in main.tsx).
      */}
      {isPending ? (
        <EventListSkeleton />
      ) : data ? (
        // A real list, so screen readers announce "list, 8 items".
        <ul className="flex flex-col gap-4">
          {data.events.map((event) => (
            <li key={event.id}>
              <EventTicket event={event} />
            </li>
          ))}
        </ul>
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
