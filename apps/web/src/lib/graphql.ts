import type { TypedDocumentString } from '../gql/graphql';

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    readonly errors: { message: string; extensions?: Record<string, unknown> }[] = [],
  ) {
    super(message);
    this.name = 'GraphQLRequestError';
  }
}

/**
 * Minimal typed GraphQL client. TanStack Query handles caching, retries and loading
 * state, so all this needs to do is send the query and unwrap the response.
 * The result and variable types come from the generated document.
 */
export async function execute<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
): Promise<TResult> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/graphql-response+json, application/json',
    },
    body: JSON.stringify({ query: query.toString(), variables }),
  });

  const body = (await response.json().catch(() => null)) as {
    data?: TResult;
    errors?: { message: string; extensions?: Record<string, unknown> }[];
  } | null;

  if (body?.errors?.length) {
    throw new GraphQLRequestError(body.errors[0]!.message, body.errors);
  }
  if (!response.ok || !body?.data) {
    throw new GraphQLRequestError(`The API responded with ${response.status}. Is it running on port 4000?`);
  }
  return body.data;
}
