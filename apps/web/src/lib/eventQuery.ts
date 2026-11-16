import { graphql } from "../gql";
import type { EventQuery as EventQueryResult } from "../gql/graphql";

/**
 * The event page's query. It lives here rather than in routes/EventPage.tsx because its
 * types are shared: the seat map, the picked-seats panel and the picked-seats store all
 * work with `Seat`, and they shouldn't have to import from a page to get it.
 */
export const EventQuery = graphql(`
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

/** One event as the event page receives it (the query's `event`, minus the null case). */
export type EventDetail = NonNullable<EventQueryResult["event"]>;

/** One seat of that event, with its section, row, number, price and status. */
export type Seat = EventDetail["seats"][number];
