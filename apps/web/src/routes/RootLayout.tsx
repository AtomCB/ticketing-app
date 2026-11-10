import { Link, NavLink, Outlet } from "react-router";
import { ThemeToggle } from "../components/ThemeToggle";
import { buttonClasses } from "../components/ui/Button";
import { useResolvedTheme, useThemeStore } from "../stores/theme";

// Header, main and footer share one centred column, so their edges always line up.
const container = "mx-auto w-full max-w-[1040px] px-6";

export function RootLayout() {
  const theme = useResolvedTheme();
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    // text-ink sets the default text colour, so text follows the theme in dark mode.
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className={`${container} flex flex-wrap items-center justify-between gap-x-5 gap-y-2 pt-6 pb-2`}>
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <TicketMark />
          Usher
        </Link>

        {/* Phones: the nav drops to its own full-width row under the logo and theme toggle.
            From sm up: ml-auto pushes the nav and toggle to the right, in one row. */}
        <nav
          aria-label="Main"
          className="order-last flex w-full flex-wrap items-center gap-x-6 gap-y-2 sm:order-0 sm:ml-auto sm:w-auto"
        >
          <NavItem to="/" end>
            What's on
          </NavItem>
          {/* /my-tickets is still a TODO; until then it shows the not-found page. */}
          <NavItem to="/my-tickets">My tickets</NavItem>
          {/* Navigation, so a Link styled as a button. /sign-in is still TODO. */}
          <Link to="/sign-in" className={buttonClasses("dark")}>
            Sign in
          </Link>
        </nav>

        {/* A setting, not navigation, so it sits outside <nav>. */}
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <main className={`${container} flex-1 pt-8 pb-16`}>
        <Outlet />
      </main>

      <footer className={`${container} pb-10 text-sm text-mute`}>
        A portfolio project built with React, Tailwind, GraphQL, Postgres and Redis.
      </footer>
    </div>
  );
}

// NavLink sets aria-current="page" on the active link; the underline styles that same
// attribute, so what sighted users see matches what screen readers announce.
function NavItem({ to, end, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="font-semibold decoration-2 underline-offset-[6px] aria-[current=page]:underline"
    >
      {children}
    </NavLink>
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
