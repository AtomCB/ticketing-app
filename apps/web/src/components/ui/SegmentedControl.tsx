import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { controlBase } from './controlBase';

// A tray in the page colour; a highlight in the card colour sits behind the selected segment.
// The radius is the tray's 4px padding plus the segments' 8px, so the corners nest.
// A grid of equal columns (auto-cols-fr) keeps every segment the same width, even when
// the tray is only as wide as its content: then each column takes the widest label's
// width. Flex can't do that, because flex-1 still lets a longer label push its own
// segment wider.
const listClasses = 'relative grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-paper p-1';

// The raised highlight behind the selected segment. It's one element that slides between
// segments rather than a background on each one, so the change reads as movement.
// motion-safe: with reduced motion on, it jumps instead of sliding.
const indicatorClasses =
  'absolute inset-y-1 left-1 rounded-lg bg-stock motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out';

// The selected text colour keys off aria-selected, the attribute screen readers announce,
// so the two can't disagree. `relative` paints the segments above the highlight.
const tabClasses =
  `${controlBase} relative rounded-lg px-3 whitespace-nowrap ` +
  'text-mute hover:text-ink aria-selected:text-ink';

// The tray's padding (p-1) and the gap between segments (gap-1), for the highlight's maths.
const TRAY_PADDING = '0.25rem';
const GAP = '0.25rem';

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

type SegmentedControlProps<T extends string> = {
  /** Prefix for the segment and panel ids. Must be unique on the page. */
  id: string;
  /** Names the control for screen readers, e.g. "Account". */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * The ids that tie a segment to the panel it shows. Give the panel these so screen
 * readers announce it by the segment's name:
 *
 *   const ids = segmentIds('account', mode);
 *   <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab}>…</div>
 */
export function segmentIds(id: string, value: string) {
  return { tab: `${id}-${value}-tab`, panel: `${id}-${value}-panel` };
}

/**
 * Two or more segments that switch what's shown below them, like "Sign in | Create
 * account". It follows the WAI-ARIA tabs pattern: Tab moves into and out of the control
 * as one stop, the arrow keys (wrapping) and Home/End move between segments, and moving
 * selects. Only render the selected segment's panel, using `segmentIds` for its ids.
 *
 * Controlled: the parent owns `value`. Styling is fixed, like FilterPill.
 */
export function SegmentedControl<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const segments = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = options.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: selectedIndex === last ? 0 : selectedIndex + 1,
      ArrowLeft: selectedIndex <= 0 ? last : selectedIndex - 1,
      Home: 0,
      End: last,
    };
    const next = targets[event.key];
    const option = next === undefined ? undefined : options[next];
    if (next === undefined || !option) return;

    event.preventDefault(); // stop Home/End and the arrows scrolling the page
    onChange(option.value);
    segments.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={listClasses}>
      {selectedIndex >= 0 && (
        <div
          aria-hidden="true"
          className={indicatorClasses}
          style={{
            // One column's width: the tray minus its padding and the gaps, shared equally.
            width: `calc((100% - 2 * ${TRAY_PADDING} - ${options.length - 1} * ${GAP}) / ${options.length})`,
            // A percentage in translate is of the highlight's own width, so this moves it
            // along one column plus one gap per step.
            transform: `translateX(calc(${selectedIndex} * (100% + ${GAP})))`,
          }}
        />
      )}
      {options.map((option, index) => {
        const selected = option.value === value;
        const ids = segmentIds(id, option.value);
        return (
          <button
            key={option.value}
            ref={(element) => {
              segments.current[index] = element;
            }}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={selected}
            // Only the selected panel exists, so only its segment points at one.
            aria-controls={selected ? ids.panel : undefined}
            // One Tab stop for the whole control: the selected segment.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={tabClasses}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
