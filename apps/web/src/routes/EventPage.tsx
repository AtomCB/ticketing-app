import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { execute } from "../lib/graphql";
import NotFound from "./NotFound";
import { eventDateParts } from "../lib/format";
import { EventQuery, type Seat } from "../lib/eventQuery";
import { SectionMap } from "../components/SectionMap";
import { BackLink } from "../components/BackLink";
import { EventPageSkeleton } from "../components/EventPageSkeleton";
import { LoadError } from "../components/LoadError";
import { PickedSeatsPanel } from "../components/PickedSeatsPanel";
import { SeatLegend } from "../components/SeatLegend";

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

      {/* Side by side when both fit; the panel wraps below the map on narrow screens.
          The map's huge grow factor gives it nearly all the spare width. */}
      <div className="mt-10 flex flex-wrap items-start gap-6">
        {/* A landmark, so screen reader users can jump straight to the map. The visually
            hidden h2 names it and keeps the heading order h1 > h2 > h3 (section names). */}
        <section
          aria-labelledby="seat-map-title"
          className="min-w-0 grow-999 basis-140 rounded-lg bg-stock px-4 py-6 sm:px-12 flex flex-col gap-8 items-center"
        >
          <h2 id="seat-map-title" className="sr-only">
            Seat map
          </h2>
          {/* Dark mode uses the rule colour, as in the dark mock; bg-ink would be near-white. */}
          <div className="flex h-10 w-3/4 max-w-110 items-center justify-center rounded-b-[32px] bg-ink text-sm font-semibold text-stock dark:bg-rule dark:text-ink">
            Stage
          </div>

          {/* A row can be wider than a phone screen. The map scrolls sideways inside the
              card instead of the whole page; w-max + mx-auto keeps it centred when it fits. */}
          <div className="max-w-full overflow-x-auto pb-2">
            <div className="mx-auto flex w-max flex-col items-center gap-8">
              {Object.values(sections).map((section) => (
                <SectionMap key={section[0]!.id} eventId={eventId} seats={section} />
              ))}
            </div>
          </div>

          <SeatLegend />
        </section>

        <PickedSeatsPanel eventId={eventId} />
      </div>
    </div>
  );
}
