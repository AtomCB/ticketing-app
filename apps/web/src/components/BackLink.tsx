import type { ComponentProps } from 'react';
import { Link } from 'react-router';
import { focusRing } from './ui/controlBase';

const backLinkClasses = `rounded-sm font-semibold text-cobalt-deep transition-colors hover:text-cobalt ${focusRing}`;

type BackLinkProps = Omit<ComponentProps<typeof Link>, 'className'>;

/**
 * A text link back up a level, e.g. <BackLink to="/">All events</BackLink> on an event
 * page. A real router <Link> (not history.back()), so it goes to the same place however
 * the visitor arrived, including from a shared link. Styling is fixed, like FilterPill,
 * so every back link in the app looks the same.
 */
export function BackLink(props: BackLinkProps) {
  return <Link {...props} className={backLinkClasses} />;
}
