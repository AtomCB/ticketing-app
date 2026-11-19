type FormAlertProps = {
  /** What went wrong, in words the person can act on. Nothing renders while it's empty. */
  message: string | null | undefined;
};

/**
 * An error about the whole form rather than one field, such as "We couldn't reach the
 * server. Check your connection and try again." Errors about a single field belong on
 * that field (TextField's `error`), where they're read out with it.
 *
 * The role="alert" wrapper is always rendered, even when empty, because screen readers
 * announce changes to a live region that already exists far more reliably than a live
 * region that appears with its text. A message only counts as a change if the text
 * differs, so clear it when a new submit starts: a repeat of the same error is then
 * announced again.
 */
export function FormAlert({ message }: FormAlertProps) {
  return (
    // empty:sr-only takes the empty wrapper out of the layout, so it adds no gap in a
    // flex or grid form, while keeping it in the accessibility tree as a live region.
    <div role="alert" className="empty:sr-only">
      {message && (
        <div className="flex gap-3 rounded-lg border-2 border-alert px-4 py-3 text-sm">
          <svg viewBox="0 0 20 20" className="mt-px size-5 shrink-0 text-alert" aria-hidden="true">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.75" />
            <path d="M10 5.75v5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            <circle cx="10" cy="14" r="1.1" fill="currentColor" />
          </svg>
          <p>{message}</p>
        </div>
      )}
    </div>
  );
}
