import { createNhostClient } from "@/lib/nhost/server";

export class GraphQLRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphQLRequestError";
  }
}

export async function graphqlRequest<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const nhost = await createNhostClient();
  const response = await nhost.graphql.request<TData>({
    query,
    variables,
  });

  if (response.body.errors?.length) {
    throw new GraphQLRequestError(
      response.body.errors[0]?.message ?? "GraphQL-förfrågan misslyckades.",
    );
  }

  if (response.body.data === undefined) {
    throw new GraphQLRequestError("Tomt GraphQL-svar.");
  }

  return response.body.data;
}
