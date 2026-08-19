// TODO [migration]: Replace all graphqlRequest() calls with direct SQL queries
// using lib/db.ts. This stub exists so the build passes during the transition.

export class GraphQLRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphQLRequestError";
  }
}

export async function graphqlRequest<TData>(
  _query: string,
  _variables?: Record<string, unknown>,
): Promise<TData> {
  throw new GraphQLRequestError(
    "GraphQL is disabled. Migrate this call to use lib/db.ts direct SQL queries.",
  );
}
