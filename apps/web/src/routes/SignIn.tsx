import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { CreateAccountForm } from '../components/auth/CreateAccountForm';
import { SignInForm } from '../components/auth/SignInForm';
import { SegmentedControl, segmentIds } from '../components/ui/SegmentedControl';
import { focusRing } from '../components/ui/controlBase';
import { useMe } from '../lib/auth';
import { safeNext, signInPath } from '../lib/redirect';
import { usePickedSeatsStore } from '../stores/pickedSeats';

type Mode = 'sign-in' | 'create-account';
const MODES = [
  { value: 'sign-in', label: 'Sign in' },
  { value: 'create-account', label: 'Create account' },
] as const;

const COPY = {
  'sign-in': { title: 'Sign in to hold seats', switchPrompt: 'New here?', switchLink: 'Create an account' },
  'create-account': { title: 'Create an account', switchPrompt: 'Already have an account?', switchLink: 'Sign in' },
} as const;

const linkClasses = `rounded-sm font-semibold text-cobalt-deep hover:underline ${focusRing}`;

/**
 * Sign in and create account, on one page with a toggle. Both live in the URL:
 * ?mode=create-account picks the form (so links and the back button work) and ?next is
 * where to go afterwards, checked by safeNext.
 */
export default function SignIn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: me } = useMe();

  const mode: Mode = searchParams.get('mode') === 'create-account' ? 'create-account' : 'sign-in';
  const next = safeNext(searchParams.get('next'));
  const otherMode: Mode = mode === 'sign-in' ? 'create-account' : 'sign-in';
  const ids = segmentIds('account', mode);
  const copy = COPY[mode];

  function setMode(value: Mode) {
    // replace: flipping the toggle shouldn't add a history entry per click.
    setSearchParams(
      (params) => {
        if (value === 'create-account') params.set('mode', value);
        else params.delete('mode');
        return params;
      },
      { replace: true },
    );
  }

  // Back to where they came from. replace, so Back doesn't return to this form.
  const goNext = () => navigate(next, { replace: true });

  // Already signed in (an old tab, or a bookmarked link): nothing to do here.
  if (me) return <Navigate to={next} replace />;

  return (
    <div className="mx-auto max-w-110 pt-6 sm:pt-12">
      <div className="rounded-xl bg-stock p-6 sm:p-8">
        <SegmentedControl id="account" label="Account" options={MODES} value={mode} onChange={setMode} />

        <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab}>
          <h1 className="mt-7 font-display text-[32px] leading-tight font-extrabold tracking-tight text-balance">
            {copy.title}
          </h1>
          <Intro mode={mode} next={next} />
          <div className="mt-6">
            {/* key: each form keeps its own values, and switching starts the other fresh. */}
            {mode === 'sign-in' ? (
              <SignInForm key="sign-in" onSuccess={goNext} />
            ) : (
              <CreateAccountForm key="create-account" onSuccess={goNext} />
            )}
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-mute">
        {copy.switchPrompt}{' '}
        <Link
          to={otherMode === 'create-account' ? signInPath(next, 'create-account') : signInPath(next)}
          replace
          className={linkClasses}
        >
          {copy.switchLink}
        </Link>
      </p>
    </div>
  );
}

/**
 * The line under the heading. When they came here from an event with seats picked, it
 * says those seats are waiting; otherwise it says why an account is needed.
 */
function Intro({ mode, next }: { mode: Mode; next: string }) {
  const pickedCount = usePickedSeatsStore((s) => (s.eventId && next === `/events/${s.eventId}` ? s.seats.length : 0));

  const text =
    pickedCount > 0
      ? `Your ${pickedCount} picked ${pickedCount === 1 ? 'seat is' : 'seats are'} still waiting. You'll go straight back to ${pickedCount === 1 ? 'it' : 'them'}.`
      : mode === 'sign-in'
        ? 'You need an account to hold seats and buy tickets.'
        : 'It takes under a minute, and lets you hold seats and buy tickets.';

  return <p className="mt-2 text-[15px] leading-normal text-mute">{text}</p>;
}
