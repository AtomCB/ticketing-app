/**
 * Behaviour shared by every clickable control (Button, FilterPill): layout, a 44px
 * minimum touch target, weight, and the focus, disabled and cursor states.
 * Tailwind v4 gives buttons `cursor: default`, so the pointer is set here.
 *
 * Shape, padding, size and colour are left to each component, so nothing in here can
 * conflict with them. Anything a component might change does not belong in this string.
 */
export const controlBase =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 font-semibold transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt ' +
  'disabled:cursor-not-allowed disabled:opacity-50';
