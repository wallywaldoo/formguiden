export const INSERT_RECOMMENDATION = /* GraphQL */ `
  mutation InsertRecommendation(
    $generated_at: timestamptz!
    $rule_id: String!
    $action_key: String!
    $action_sv: String!
    $comparison_period_days: Int!
    $completeness: numeric
    $confidence: String!
    $disclaimer_key: String!
    $valid_until: timestamptz
  ) {
    insert_recommendations_one(
      object: {
        generated_at: $generated_at
        rule_id: $rule_id
        action_key: $action_key
        action_sv: $action_sv
        comparison_period_days: $comparison_period_days
        completeness: $completeness
        confidence: $confidence
        disclaimer_key: $disclaimer_key
        valid_until: $valid_until
      }
    ) {
      id
    }
  }
`;

export const INSERT_RECOMMENDATION_SIGNALS = /* GraphQL */ `
  mutation InsertRecommendationSignals(
    $objects: [recommendation_signals_insert_input!]!
  ) {
    insert_recommendation_signals(objects: $objects) {
      affected_rows
    }
  }
`;

export const DELETE_STALE_RECOMMENDATIONS = /* GraphQL */ `
  mutation DeleteStaleRecommendations($before: timestamptz!) {
    delete_recommendations(where: { generated_at: { _lt: $before } }) {
      affected_rows
    }
  }
`;

export const INSERT_EXPORT_JOB = /* GraphQL */ `
  mutation InsertExportJob {
    insert_data_export_jobs_one(object: { status: "queued" }) {
      id
    }
  }
`;

export const UPDATE_EXPORT_JOB = /* GraphQL */ `
  mutation UpdateExportJob(
    $id: uuid!
    $status: String!
    $storage_file_id: uuid
    $error_summary: String
    $completed_at: timestamptz
  ) {
    update_data_export_jobs_by_pk(
      pk_columns: { id: $id }
      _set: {
        status: $status
        storage_file_id: $storage_file_id
        error_summary: $error_summary
        completed_at: $completed_at
      }
    ) {
      id
      status
    }
  }
`;

export const INSERT_DELETION_REQUEST = /* GraphQL */ `
  mutation InsertDeletionRequest($purge_after: timestamptz!) {
    insert_account_deletion_requests_one(
      object: { status: "pending", purge_after: $purge_after }
    ) {
      id
      purge_after
    }
  }
`;

export const CANCEL_DELETION_REQUEST = /* GraphQL */ `
  mutation CancelDeletionRequest($id: uuid!, $cancelled_at: timestamptz!) {
    update_account_deletion_requests_by_pk(
      pk_columns: { id: $id }
      _set: { status: "cancelled", cancelled_at: $cancelled_at }
    ) {
      id
      status
    }
  }
`;
