import { Link, useLocation } from 'react-router';
import { useMe, useSignOut } from '../lib/auth';
import { signInPath } from '../lib/redirect';
import { Button, buttonClasses } from './ui/Button';

/**
 * The account end of the header: a "Sign in" link that brings you back to this page, or,
 * once signed in, your initial and a way to sign out.
 */
export function AccountNav() {
  const { data: me, isPending } = useMe();
  const signOut = useSignOut();
  const location = useLocation();

  // Reserve the space while we ask the API, so the header doesn't shift when it answers.
  if (isPending) return <span aria-hidden="true" className="h-11 w-20" />;

  if (!me) {
    // The sign-in page has its own form; a link to itself would just be noise.
    if (location.pathname === '/sign-in') return null;
    return (
      <Link to={signInPath(location.pathname + location.search)} className={buttonClasses('dark')}>
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        role="img"
        aria-label={`Signed in as ${me.email}`}
        title={me.email}
        className="flex size-9 items-center justify-center rounded-full bg-cobalt text-sm font-semibold text-white uppercase"
      >
        {me.email.charAt(0)}
      </span>
      <Button
        variant="text"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
        className="px-2 text-sm"
      >
        Sign out
      </Button>
    </div>
  );
}
