import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { graphql } from "../gql";
import { execute } from "../lib/graphql";
import NotFound from "./NotFound";
import { eventDateParts } from "../lib/format";
import type { EventQuery as EventQueryResult } from "../gql/graphql";
import { SectionMap } from "../components/SectionMap";
import { BackLink } from "../components/BackLink";
import { EventPageSkeleton } from "../components/EventPageSkeleton";
import { LoadError } from "../components/LoadError";

export type Seat = NonNullable<EventQueryResult["event"]>["seats"][number];

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

export default function EventPage() {
  const { eventId } = useParams();

  // Hooks run before any early return, so React sees the same hooks on every render.
  // `enabled` keeps the query from running without an id (the route always has one,
  // but TypeScript can't know that, hence the `!`).
  const { data, isPending, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => execute(EventQuery, { id: eventId! }),
    enabled: !!eventId,
    refetchInterval: 15000,
  });

  if (!eventId) return <NotFound />;

  // Only on a first load: polling refetches keep the current data on screen.
  if (isPending) {
    return (
      <div>
        <BackLink to="/">All events</BackLink>
        <EventPageSkeleton />
      </div>
    );
  }

  // No data at all means the load failed. If a later poll fails, `data` is still the
  // last good copy, so the page stays up rather than turning into an error.
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to="/">All events</BackLink>
        <LoadError
          title="Couldn't load this event"
          message="The ticketing service didn't respond. Check your connection and try again."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  // The request worked, but there's no event with this id.
  if (!data.event) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to="/">All events</BackLink>
        <div role="status" className="rounded-xl bg-stock p-7">
          <p className="text-[17px] font-semibold">We couldn't find that event</p>
          <p className="mt-1.5 text-sm text-mute">
            It may have been removed, or the link might be wrong.
          </p>
        </div>
      </div>
    );
  }

  const date = eventDateParts(data.event.startsAt);

  const sections: Record<string, Seat[]> = {};

  data.event.seats.forEach(seat => {
    if (sections[seat.section]) {
      sections[seat.section]!.push(seat);
      return;
    }
    sections[seat.section] = [seat];
  });

  console.log(sections)

  return (
    <div>
      <BackLink to="/">All events</BackLink>

      <div className="mt-6">
        <p className="text-sm text-mute">
          {data.event.venue.name}, {data.event.venue.city}
        </p>
        <h1 className="mt-1 font-display text-6xl leading-tight font-extrabold text-balance">
          {data.event.name}
        </h1>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-lg">
          <time dateTime={data.event.startsAt}>{`${date.weekday}, ${date.monthLong} ${date.day} at ${date.time}`}</time>
        </div>

        <p className="mt-4 text-mute">
          {data.event.description}
        </p>
      </div>

      <div className="flex gap-6 mt-10">
        <div className="grow rounded-lg bg-stock px-12 py-6 flex flex-col gap-10 items-center">
          <div className="bg-ink text-stock mx-12 rounded-b-full text-center p-3 font-semibold self-stretch">Stage</div>

          {Object.values(sections).map((section) => (
            <SectionMap key={section[0]!.id} eventId={eventId} seats={section} />
          ))}
        </div>

        <div className="rounded-lg bg-stock p-8">
          TODO
        </div>
      </div>
    </div>
  );
}
