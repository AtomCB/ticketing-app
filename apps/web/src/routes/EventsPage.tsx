import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { graphql } from "../gql";
import type { EventsQuery as EventsQueryResult } from "../gql/graphql";
import { execute } from "../lib/graphql";
import { FilterPill } from "../components/ui/FilterPill";
import { EventTicket } from "../components/EventTicket";

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
  const { data, error, isPending } = useQuery({
    queryKey: ["events"],
    queryFn: () => execute(EventsQuery),
  });

  const events = data?.events ?? [];

  // Each city once, in the order its first event appears. Depends on `data` (stable
  // between renders) rather than `events`, which is a new empty array on every render
  // while loading.
  const cities = useMemo(
    () => ["All cities", ...new Set((data?.events ?? []).map((event) => event.venue.city))],
    [data],
  );

  return (
    <div className="flex flex-col gap-10">
      {/* Stacks on phones; title and filters side by side from the sm breakpoint. */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-5xl font-extrabold sm:text-7xl">What's on</h1>

        <div role="group" aria-label="Filter by city" className="flex flex-wrap gap-2">
          {cities.map((city) => (
            // TODO: track the selected city (milestone 5 moves it into the URL)
            <FilterPill key={city} selected={false} onSelect={() => {}}>
              {city}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* A real list, so screen readers announce "list, 8 items". */}
      <ul className="flex flex-col gap-4">
        {events.map((event) => (
          <li key={event.id}>
            <EventTicket event={event} />
          </li>
        ))}
      </ul>
    </div>
  );
}
