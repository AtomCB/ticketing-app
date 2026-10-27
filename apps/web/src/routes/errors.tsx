import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export function NotFound() {
  return (
    <div className="max-w-prose">
      <h1 className="font-display text-4xl font-bold">There's nothing on at this address</h1>
      <p className="mt-3 text-mute">The page may have moved, or the link is missing part of its address.</p>
      <Link to="/" className="mt-6 inline-block font-semibold text-cobalt hover:text-cobalt-deep">
        See all events
      </Link>
    </div>
  );
}

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <div className="mx-auto max-w-prose px-4 py-16">
      <h1 className="font-display text-4xl font-bold">This page failed to load</h1>
      <p className="mt-3 text-mute">{message}</p>
      <a href="/" className="mt-6 inline-block font-semibold text-cobalt hover:text-cobalt-deep">
        Reload the event list
      </a>
    </div>
  );
}

export function QueryError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-rule bg-stock p-6">
      <p className="font-semibold">Couldn't load events</p>
      <p className="mt-1 text-sm text-mute">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-cobalt-deep"
      >
        Try again
      </button>
    </div>
  );
}
