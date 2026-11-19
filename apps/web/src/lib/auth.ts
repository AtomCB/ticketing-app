import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../gql';
import type { MeQuery, SignInMutationVariables, SignUpMutationVariables } from '../gql/graphql';
import { execute, GraphQLRequestError } from './graphql';

// Everything the web app does with accounts: who's signed in, signing in, up and out,
// and turning the API's errors into messages a form can show.

const MeDocument = graphql(`
  query Me {
    me {
      id
      email
    }
  }
`);

const SignInDocument = graphql(`
  mutation SignIn($email: String!, $password: String!) {
    signIn(email: $email, password: $password) {
      id
      email
    }
  }
`);

const SignUpDocument = graphql(`
  mutation SignUp($email: String!, $password: String!) {
    signUp(email: $email, password: $password) {
      id
      email
    }
  }
`);

const SignOutDocument = graphql(`
  mutation SignOut {
    signOut
  }
`);

/** The signed-in person, as every part of the app sees them. */
export type CurrentUser = NonNullable<MeQuery['me']>;

/** The cache entry for "who's signed in". The mutations below write to it directly. */
export const meQueryKey = ['me'] as const;

/**
 * Who's signed in: a CurrentUser, or null when nobody is. The session cookie is httpOnly,
 * so JavaScript can't read it; asking the API is the only way to know.
 */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => (await execute(MeDocument)).me,
  });
}

/**
 * Signs in. On success the API sets the session cookie, and the returned user goes
 * straight into the `me` cache, so the header updates without another request.
 */
export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: SignInMutationVariables) => (await execute(SignInDocument, variables)).signIn,
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

/** Creates an account and signs it in, like useSignIn. */
export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: SignUpMutationVariables) => (await execute(SignUpDocument, variables)).signUp,
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

/**
 * Signs out: the API deletes the session and clears the cookie. Once queries hold
 * per-person data (holds, orders, My tickets), remove them here as well.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await execute(SignOutDocument)).signOut,
    onSuccess: () => queryClient.setQueryData(meQueryKey, null),
  });
}

/** Errors to show on a form: one per field that has one, plus one for the form itself. */
export type FormErrors<Field extends string> = {
  fields: Partial<Record<Field, string>>;
  form: string | null;
};

export const NO_ERRORS = { fields: {}, form: null } as const satisfies FormErrors<never>;

const NETWORK_ERROR = "We couldn't reach Usher. Check your connection and try again.";
const SERVER_ERROR = 'Something went wrong on our side. Try again in a moment.';

/**
 * Sorts a failed mutation's error for a form. A BAD_USER_INPUT error that names one of
 * `fields` in `argumentName` goes on that field; any other BAD_USER_INPUT is about the
 * form as a whole (like signIn's "Incorrect email or password."). Anything else is a
 * failure the person can't fix by editing, so it gets a general message rather than
 * whatever the server or browser said.
 */
export function formErrors<Field extends string>(error: unknown, fields: readonly Field[]): FormErrors<Field> {
  // fetch() rejects with a TypeError when the request never reached the server.
  if (error instanceof TypeError) return { fields: {}, form: NETWORK_ERROR };
  if (!(error instanceof GraphQLRequestError)) return { fields: {}, form: SERVER_ERROR };

  const isField = (name: unknown): name is Field => typeof name === 'string' && (fields as readonly string[]).includes(name);
  const result: FormErrors<Field> = { fields: {}, form: null };

  for (const { message, extensions } of error.errors) {
    if (extensions?.code !== 'BAD_USER_INPUT') continue;
    if (isField(extensions.argumentName)) result.fields[extensions.argumentName] ??= message;
    else result.form ??= message;
  }

  const anyUserError = result.form !== null || Object.keys(result.fields).length > 0;
  return anyUserError ? result : { fields: {}, form: SERVER_ERROR };
}
