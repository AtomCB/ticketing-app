import { useSignIn, type CurrentUser } from '../../lib/auth';
import { Button } from '../ui/Button';
import { FormAlert } from '../ui/FormAlert';
import { PasswordField } from '../ui/PasswordField';
import { TextField } from '../ui/TextField';
import { useCredentialsForm } from './useCredentialsForm';

type SignInFormProps = {
  /** Runs once the session cookie is set and `me` is cached, e.g. to redirect. */
  onSuccess: (user: CurrentUser) => void;
};

/**
 * Email and password, then signIn. A wrong email or password comes back as one message
 * for the whole form (FormAlert), never as "no account with that email", so the form
 * can't be used to find out who has an account.
 */
export function SignInForm({ onSuccess }: SignInFormProps) {
  const form = useCredentialsForm({
    mutation: useSignIn(),
    onSuccess,
    missing: { email: 'Enter your email address.', password: 'Enter your password.' },
  });

  return (
    // noValidate: our own errors replace the browser's bubbles, so every message looks
    // the same and is wired to its field.
    <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-4.5">
      <FormAlert message={form.formError} />
      {/* "username" (not "email") tells password managers this is the account name to
          pair with the saved password. */}
      <TextField {...form.field('email')} label="Email" type="email" autoComplete="username" />
      <PasswordField {...form.field('password')} label="Password" autoComplete="current-password" />
      <Button type="submit" className="mt-1.5 py-3">
        {form.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
