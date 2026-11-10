// Bar widths per placeholder, so the cards don't look stamped out. [venue line, title].
const widths = [
  ['w-[30%]', 'w-[65%]'],
  ['w-[24%]', 'w-[52%]'],
  ['w-[34%]', 'w-[58%]'],
] as const;

/**
 * Stand-ins for the event list while it loads. Same shape and height as EventTicket
 * (notches, tear line, stub), so nothing jumps when the real cards arrive.
 *
 * The cards are hidden from screen readers; a visually hidden status message says
 * "Loading events" instead of announcing a stack of empty boxes. The shimmer comes
 * from .skeleton-bar in index.css, and only runs for people who haven't asked their OS
 * to reduce motion.
 */
export function EventListSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading events
      </p>
      <ul aria-hidden="true" className="flex flex-col gap-4">
        {widths.map(([venue, title], i) => (
          <li key={i} className="ticket flex min-h-37 rounded-xl">
            <div className="flex flex-1 flex-col justify-between gap-5 p-5 sm:p-6">
              <div className="flex flex-col gap-2.5">
                <div className={`skeleton-bar h-3 rounded-md ${venue}`} />
                <div className={`skeleton-bar h-6 rounded-md ${title}`} />
              </div>
              <div className="skeleton-bar h-3 w-32 rounded-md" />
            </div>
            <div className="my-(--notch) flex w-(--stub) shrink-0 flex-col items-center justify-center gap-2 border-l-2 border-dashed border-rule">
              <div className="skeleton-bar h-3 w-8 rounded-md" />
              <div className="skeleton-bar h-10 w-12 rounded-md" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
