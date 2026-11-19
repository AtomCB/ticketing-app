import { useRef, useState, type FormEvent } from 'react';
import { formErrors, NO_ERRORS, type CurrentUser, type FormErrors } from '../../lib/auth';

export type CredentialsField = 'email' | 'password';
const FIELDS = ['email', 'password'] as const satisfies readonly CredentialsField[];

type Credentials = Record<CredentialsField, string>;

/** The parts of a TanStack mutation (useSignIn or useSignUp) the form needs. */
type CredentialsMutation = {
  mutate: (
    variables: Credentials,
    options: { onSuccess: (user: CurrentUser) => void; onError: (error: Error) => void },
  ) => void;
  isPending: boolean;
};

type Options = {
  mutation: CredentialsMutation;
  onSuccess: (user: CurrentUser) => void;
  /** What to say when a field is left empty. */
  missing: Record<CredentialsField, string>;
};

/**
 * Everything the sign-in and create-account forms share: the two values, their errors,
 * submitting, and moving focus to the first field with an error. The forms only differ
 * in their mutation, their wording and their password field, so those stay in each form.
 */
export function useCredentialsForm({ mutation, onSuccess, missing }: Options) {
  const [values, setValues] = useState<Credentials>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors<CredentialsField>>(NO_ERRORS);
  const inputs = {
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  function update(field: CredentialsField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Editing a field answers its error, so clear it.
    setErrors((current) =>
      current.fields[field] ? { ...current, fields: { ...current.fields, [field]: undefined } } : current,
    );
  }

  // Show errors and move focus to the first field that has one, so keyboard and screen
  // reader users land on it (and hear its error read out with it).
  function showErrors(next: FormErrors<CredentialsField>) {
    setErrors(next);
    const first = FIELDS.find((field) => next.fields[field]);
    if (first) inputs[first].current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return; // a second Enter while the first request is running

    // Only check what the server can't do better: that something was typed.
    const empty: FormErrors<CredentialsField>['fields'] = {};
    if (!values.email.trim()) empty.email = missing.email;
    if (!values.password) empty.password = missing.password;
    if (empty.email || empty.password) {
      showErrors({ fields: empty, form: null });
      return;
    }

    // Clear old errors first: FormAlert only announces text that changed, so a second
    // identical failure would otherwise go unannounced.
    setErrors(NO_ERRORS);
    mutation.mutate(values, {
      onSuccess,
      onError: (error) => showErrors(formErrors(error, FIELDS)),
    });
  }

  /** Props for one field: its ref, value, change handler and error. */
  function field(name: CredentialsField) {
    return {
      ref: inputs[name],
      name,
      value: values[name],
      onChange: (event: { target: { value: string } }) => update(name, event.target.value),
      error: errors.fields[name],
    };
  }

  return { field, formError: errors.form, handleSubmit, isPending: mutation.isPending };
}
