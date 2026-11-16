/**
 * Stand-in for the event page while it loads: the same layout as the real page (header,
 * seat map card, side panel), so nothing jumps when the event arrives.
 *
 * Bars on the page background use bg-rule (the default skeleton colour is the page
 * colour, which would be invisible there); bars inside the cards keep the default.
 * Hidden from screen readers, which hear "Loading event" instead.
 */
export function EventPageSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading event
      </p>

      <div aria-hidden="true">
        <div className="mt-6 flex flex-col gap-3">
          <div className="skeleton-bar h-3.5 w-48 rounded-md bg-rule" />
          <div className="skeleton-bar h-14 w-3/4 rounded-lg bg-rule" />
          <div className="skeleton-bar h-5 w-64 rounded-md bg-rule" />
          <div className="mt-2 flex flex-col gap-2">
            <div className="skeleton-bar h-4 w-full max-w-xl rounded-md bg-rule" />
            <div className="skeleton-bar h-4 w-2/3 max-w-md rounded-md bg-rule" />
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 grow-999 basis-140 flex-col items-center gap-10 rounded-lg bg-stock px-4 py-6 sm:px-12">
            <div className="skeleton-bar mx-12 h-11 self-stretch rounded-b-full" />
            {[4, 3, 3].map((rows, section) => (
              <div key={section} className="flex flex-col items-center gap-2">
                <div className="skeleton-bar mb-1 h-5 w-32 rounded-md" />
                {Array.from({ length: rows }, (_, row) => (
                  <div key={row} className="skeleton-bar h-6 w-88 max-w-full rounded-md" />
                ))}
              </div>
            ))}
          </div>

          <div className="flex grow basis-70 flex-col gap-4 rounded-lg bg-stock p-5">
            <div className="skeleton-bar h-6 w-32 rounded-md" />
            <div className="skeleton-bar h-4 w-full rounded-md" />
            <div className="skeleton-bar h-4 w-5/6 rounded-md" />
            <div className="skeleton-bar mt-4 h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
