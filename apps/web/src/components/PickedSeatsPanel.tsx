import { useId, useRef } from "react";
import { Link } from "react-router";
import { useMe } from "../lib/auth";
import { signInPath } from "../lib/redirect";
import type { Seat } from "../lib/eventQuery";
import { MAX_PICKS, usePickedSeatsStore } from "../stores/pickedSeats";
import { formatPrice, seatName } from "../lib/format";
import { Button, buttonClasses } from "./ui/Button";
import { controlBase, focusRing } from "./ui/controlBase";

// Module level, so the selector below returns the same empty array every time. An inline
// `[]` would be a new array on every call; Zustand would see a change on every render
// and loop until React stops it ("Maximum update depth exceeded").
const NO_SEATS: Seat[] = [];

const removeClasses = `${controlBase} -mr-3 size-11 shrink-0 rounded-full text-mute hover:bg-paper hover:text-ink`;

/**
 * "Your seats": the seats picked on this event's map, with a total. Reads the picked-seats
 * store, ignoring picks that belong to another event (the store only resets them on the
 * next pick).
 */
export function PickedSeatsPanel({ eventId }: { eventId: string }) {
  const seats = usePickedSeatsStore((s) => (s.eventId === eventId ? s.seats : NO_SEATS));
  const remove = usePickedSeatsStore((s) => s.remove);
  const clear = usePickedSeatsStore((s) => s.clear);
  const { data: me, isPending: meIsPending } = useMe();

  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Sum in cents and format once, so the total never picks up floating-point errors.
  const total = seats.reduce((sum, seat) => sum + seat.priceCents, 0);
  const atLimit = seats.length >= MAX_PICKS;
  const holdLabel =
    seats.length === 0 ? "Hold seats" : `Hold ${seats.length} ${seats.length === 1 ? "seat" : "seats"}`;

  // Removing a seat (or clearing) deletes the button that had keyboard focus, which would
  // drop focus onto <body>. Moving it to the panel heading keeps keyboard and screen
  // reader users in the panel.
  function handleFocusHeading(action: () => void) {
    action();
    headingRef.current?.focus();
  }

  return (
    <aside aria-labelledby={headingId} className="grow basis-70 rounded-lg bg-stock p-5">
      <div className="flex items-baseline justify-between">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className={`rounded-sm font-display text-xl font-bold ${focusRing}`}
        >
          Your seats
        </h2>
        {seats.length > 0 && (
          <Button variant="text" onClick={() => handleFocusHeading(clear)} className="text-sm">
            Clear
          </Button>
        )}
      </div>

      {seats.length === 0 ? (
        <p className="mt-1 py-3 text-sm text-mute">
          No seats picked yet. Choose seats on the map.
        </p>
      ) : (
        // divide-y draws a line between seats only: none above the first or below the last.
        <ul className="mt-1 divide-y divide-rule">
          {seats.map((seat) => (
            <li
              key={seat.id}
              className="flex items-center justify-between gap-3 py-0.5 text-sm"
            >
              <span>{seatName(seat)}</span>
              <span className="flex items-center gap-1">
                {formatPrice(seat.priceCents)}
                <button
                  type="button"
                  aria-label={`Remove ${seatName(seat)}`}
                  onClick={() => handleFocusHeading(() => remove(seat.id))}
                  className={removeClasses}
                >
                  <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                    <path
                      d="M2 2l8 8M10 2l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-baseline justify-between border-t-2 border-ink pt-3">
        <span className="font-semibold">Total</span>
        <span className="font-display text-[26px] font-bold">{formatPrice(total)}</span>
      </div>

      {/* Holding needs an account. Signed out, the button becomes a link to sign in that
          comes back here; the picks stay in the store meanwhile.
          py-3 makes it 48px tall like the mock; min-h-12 would clash with controlBase's
          min-h-11 and win only by stylesheet order. */}
      {!me && !meIsPending ? (
        <Link to={signInPath(`/events/${eventId}`)} className={buttonClasses("primary", "mt-5 w-full py-3")}>
          Sign in to hold seats
        </Link>
      ) : (
        // TODO (milestone 10): place the hold. Until then the button can't do anything.
        <Button disabled className="mt-5 w-full py-3">
          {holdLabel}
        </Button>
      )}
      {/* A live region: at the limit, extra seats on the map silently do nothing, so this
          says why, and screen readers announce the change. */}
      <p role="status" className="mt-2.5 text-[13px] leading-normal text-mute">
        {atLimit
          ? `That's the most you can pick at once (${MAX_PICKS}). Remove a seat to pick another.`
          : `We'll hold these seats for 10 minutes while you check out. You can pick up to ${MAX_PICKS}.`}
      </p>
    </aside>
  );
}
