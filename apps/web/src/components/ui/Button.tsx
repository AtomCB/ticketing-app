import type { ComponentProps } from 'react';
import { controlBase } from './controlBase';

// Shared by every variant: the common control behaviour plus the button shape.
const base = `${controlBase} rounded-lg`;

// One entry per variant, named for its role in the design. Colours are theme tokens,
// so every variant works in light and dark mode. Horizontal padding lives here rather
// than in `base` so `text` can have none without two conflicting padding classes.
const variants = {
  primary: 'bg-cobalt px-4 text-white hover:bg-cobalt/90', // main call to action
  dark: 'bg-ink px-4 text-paper hover:bg-ink/90', // strong secondary action
  outline: 'border-2 border-ink px-4 text-ink hover:bg-ink hover:text-paper',
  text: 'text-cobalt-deep hover:underline', // looks like a link, acts like a button
} as const;

export type ButtonVariant = keyof typeof variants;

/**
 * Button styles as a class string. Use it to style a router <Link> like a button,
 * so navigation stays a real link: <Link className={buttonClasses('dark')}>.
 */
export function buttonClasses(variant: ButtonVariant = 'primary', className?: string) {
  return [base, variants[variant], className].filter(Boolean).join(' ');
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
};

/**
 * A native <button> for actions. Defaults to type="button" so it never submits a
 * form by accident; pass type="submit" when it should. `className` is added after
 * the variant classes.
 */
export function Button({ variant = 'primary', type = 'button', className, ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
