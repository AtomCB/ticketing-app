import type { ComponentProps } from 'react';
import { controlBase } from './controlBase';

// Unselected: a light pill. Selected: inverted. The selected look keys off
// aria-pressed, the same attribute screen readers announce, so the two can't disagree.
// Hover only applies to unselected pills, so it never competes with the selected colours.
const pillClasses =
  `${controlBase} rounded-full px-4 text-sm ` +
  'bg-stock text-ink aria-[pressed=false]:hover:bg-rule ' +
  'aria-pressed:bg-ink aria-pressed:text-paper';

type FilterPillProps = Omit<ComponentProps<'button'>, 'type' | 'onClick' | 'aria-pressed' | 'className'> & {
  /** Whether this option is the active filter. Rendered as aria-pressed. */
  selected: boolean;
  onSelect: () => void;
};

/**
 * A toggle button for choosing a filter, such as a city. Put a set of them inside an
 * element with role="group" and an aria-label that names the filter.
 *
 * `selected` is required, so a pill can't be rendered without its pressed state.
 * Styling is fixed (no className), so every filter in the app looks the same.
 */
export function FilterPill({ selected, onSelect, ...props }: FilterPillProps) {
  return (
    <button {...props} type="button" aria-pressed={selected} onClick={onSelect} className={pillClasses} />
  );
}
