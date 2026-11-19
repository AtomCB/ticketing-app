import { useSignUp, type CurrentUser } from '../../lib/auth';
import { Button } from '../ui/Button';
import { FormAlert } from '../ui/FormAlert';
import { PasswordField } from '../ui/PasswordField';
import { TextField } from '../ui/TextField';
import { useCredentialsForm } from './useCredentialsForm';

type CreateAccountFormProps = {
  /** Runs once the account exists, its session cookie is set and `me` is cached. */
  onSuccess: (user: CurrentUser) => void;
};

/**
 * Email and a new password, then signUp, which also signs the new account in. The API
 * owns the password rules; its errors come back naming the field they belong to, and show
 * under that field.
 */
export function CreateAccountForm({ onSuccess }: CreateAccountFormProps) {
  const form = useCredentialsForm({
    mutation: useSignUp(),
    onSuccess,
    missing: { email: 'Enter your email address.', password: 'Choose a password.' },
  });

  return (
    <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-4.5">
      <FormAlert message={form.formError} />
      {/* "username", as on sign-in, so password managers save the new password against
          this email. */}
      <TextField {...form.field('email')} label="Email" type="email" autoComplete="username" />
      <PasswordField
        {...form.field('password')}
        label="Password"
        autoComplete="new-password"
        // Matches PASSWORD_MIN_LENGTH in apps/api/src/auth/passwords.ts.
        hint="At least 6 characters."
      />
      <Button type="submit" className="mt-1.5 py-3">
        {form.isPending ? 'Creating your account…' : 'Create account'}
      </Button>
    </form>
  );
}
