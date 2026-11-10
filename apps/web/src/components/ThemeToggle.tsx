import type { Theme } from '../stores/theme';
import { controlBase } from './ui/controlBase';

interface ThemeToggleProps {
  /** The theme currently on screen (after resolving "system"), not the saved preference. */
  theme: Theme;
  onToggle: () => void;
}

// Round, icon-only, 44px square. Uses the card colour (stock) so it reads as a control
// on the page background in both themes.
const toggleClasses = `${controlBase} size-11 shrink-0 rounded-full bg-stock text-ink hover:bg-rule`;

/**
 * Switches between the light and dark themes. The label names the action ("Switch to
 * dark theme") rather than the state, so it changes with the theme. That's why there's
 * no aria-pressed here: a changing label and a pressed state would say the same thing twice.
 * The icon shows where the click takes you: a moon in light mode, a sun in dark mode.
 */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button type="button" aria-label={label} title={label} onClick={onToggle} className={toggleClasses}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <path
        d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <circle cx="10" cy="10" r="3.5" />
        <path d="M10 1.75v1.5M10 16.75v1.5M1.75 10h1.5M16.75 10h1.5M4.17 4.17l1.06 1.06M14.77 14.77l1.06 1.06M4.17 15.83l1.06-1.06M14.77 5.23l1.06-1.06" />
      </g>
    </svg>
  );
}
