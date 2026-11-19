import { useEffect, useId, useRef, useState, type ComponentProps } from 'react';
import { TextField } from './TextField';

// The clickable area is the text plus 2px on every side: 24px tall, the minimum target
// size WCAG 2.2 asks for (2.5.8), without reaching past the words. -m-0.5 cancels the
// padding, so the label row keeps its height and the text stays lined up with the input.
// The focus ring is drawn on that box's edge (no offset, unlike the shared focusRing):
// with the usual 2px offset it would touch the input below.
const toggleClasses =
  '-m-0.5 cursor-pointer rounded-sm p-0.5 text-sm font-semibold text-cobalt-deep hover:underline ' +
  'focus-visible:outline-2 focus-visible:outline-cobalt';

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'labelAction' | 'autoComplete'> & {
  /**
   * Required, so password managers know what to do: fill a saved password on sign-in
   * ("current-password") or offer to generate one on sign-up ("new-password").
   */
  autoComplete: 'current-password' | 'new-password';
};

/**
 * A TextField for passwords, with a "Show password" button in the label row, so people
 * can check what they typed before submitting. Takes every TextField prop except `type`
 * and `labelAction`.
 */
export function PasswordField({ id, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  // What the screen reader hears after a toggle. Empty at first, so nothing is announced
  // on page load.
  const [announcement, setAnnouncement] = useState('');
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Hide the password again when its form is submitted, so it isn't left on screen and
  // browsers don't treat a visible password as ordinary text. A button inside a form
  // knows its form, so this needs no extra props.
  useEffect(() => {
    const form = toggleRef.current?.form;
    if (!form) return;
    const hide = () => {
      setVisible(false);
      setAnnouncement(''); // a stale "visible" would be wrong now; submitting says enough
    };
    form.addEventListener('submit', hide);
    return () => form.removeEventListener('submit', hide);
  }, []);

  function toggle() {
    const next = !visible;
    setVisible(next);
    setAnnouncement(next ? 'Your password is visible' : 'Your password is hidden');
  }

  return (
    <>
      <TextField
        {...props}
        id={inputId}
        type={visible ? 'text' : 'password'}
        // While it's shown as text, don't spellcheck, autocorrect or capitalise it:
        // spellcheckers can send what's typed to a server.
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        labelAction={
          <button
            ref={toggleRef}
            type="button"
            aria-controls={inputId}
            onClick={toggle}
            className={toggleClasses}
          >
            {visible ? 'Hide password' : 'Show password'}
          </button>
        }
      />
      {/* sr-only is absolutely positioned, so this adds no gap in a flex or grid form. */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
