import { useId, type ComponentProps, type ReactNode } from 'react';
import { focusRing } from './controlBase';

// A tall, roomy input. The border turns the alert colour when the field is invalid,
// keyed off aria-invalid, so what's drawn and what screen readers announce agree.
const inputClasses =
  `${focusRing} min-h-12 w-full rounded-lg border-2 border-rule bg-stock px-3.5 text-ink ` +
  'placeholder:text-mute aria-invalid:border-alert ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

type TextFieldProps = Omit<ComponentProps<'input'>, 'className' | 'aria-describedby' | 'aria-invalid'> & {
  /** The visible label. Required: a placeholder is not a label. */
  label: string;
  /** Help shown under the input, such as a password rule. Hidden while there's an error. */
  hint?: ReactNode;
  /** What's wrong with the value, in words. Marks the field invalid while set. */
  error?: string | null;
  /** A link or button at the end of the label row, like "Forgot password?". */
  labelAction?: ReactNode;
};

/**
 * A labelled text input with an optional hint and error, wired up for screen readers:
 * the label names the input, and aria-describedby reads the error (or else the hint)
 * after it. Takes every <input> prop, including `ref`, `type` and `autoComplete`.
 *
 * The id is generated unless you pass one, e.g. for a button that controls the input.
 * Styling is fixed, like FilterPill, so every form in the app looks the same.
 */
export function TextField({ label, hint, error, labelAction, id, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;

  // The error replaces the hint rather than stacking under it: one message at a time,
  // in the same spot, so the layout doesn't jump twice.
  const message = error || hint;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={inputId} className="text-sm font-semibold">
          {label}
        </label>
        {labelAction}
      </div>

      <input
        {...inputProps}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={inputClasses}
      />

      {message && (
        <p id={messageId} className={`text-sm ${error ? 'text-alert' : 'text-mute'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
