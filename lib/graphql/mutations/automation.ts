export const LIST_AUTOMATION_TOKENS = /* GraphQL */ `
  query ListAutomationTokens {
    automation_tokens(order_by: { created_at: desc }, limit: 20) {
      id
      nhost_pat_id
      label
      expires_at
      revoked_at
      created_at
    }
  }
`;

export const INSERT_AUTOMATION_TOKEN = /* GraphQL */ `
  mutation InsertAutomationToken(
    $nhost_pat_id: uuid!
    $label: String!
    $expires_at: timestamptz!
  ) {
    insert_automation_tokens_one(
      object: {
        nhost_pat_id: $nhost_pat_id
        label: $label
        expires_at: $expires_at
      }
    ) {
      id
    }
  }
`;

export const REVOKE_AUTOMATION_TOKEN = /* GraphQL */ `
  mutation RevokeAutomationToken($id: uuid!, $revoked_at: timestamptz!) {
    update_automation_tokens(
      where: { id: { _eq: $id }, revoked_at: { _is_null: true } }
      _set: { revoked_at: $revoked_at }
    ) {
      affected_rows
    }
  }
`;

export const GET_LAST_AUTOMATED_IMPORT = /* GraphQL */ `
  query GetLastAutomatedImport {
    data_imports(
      where: { provider: { _in: ["garmin-connect", "garmin-file"] } }
      order_by: { created_at: desc }
      limit: 5
    ) {
      id
      provider
      status
      created_at
      committed_at
      committed_count
      duplicate_count
    }
  }
`;
