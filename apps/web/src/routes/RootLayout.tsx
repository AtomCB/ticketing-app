import { Link, Outlet } from 'react-router';

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 pt-6 pb-2 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-md">
          <TicketMark />
          <span className="font-display text-xl font-bold tracking-tight">Houselights</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-16 sm:px-6">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-sm text-mute sm:px-6">
        A portfolio project built with React, GraphQL, Postgres and Redis.
      </footer>
    </div>
  );
}

function TicketMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
      <rect x="3" y="8" width="26" height="16" rx="3" className="fill-cobalt" />
      <circle cx="21" cy="8" r="3" className="fill-paper" />
      <circle cx="21" cy="24" r="3" className="fill-paper" />
      <path d="M21 12.5v7" className="stroke-paper" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
    </svg>
  );
}
