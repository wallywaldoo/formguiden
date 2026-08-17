export const UPDATE_ACTIVITY_NOTES = /* GraphQL */ `
  mutation UpdateActivityNotes($id: uuid!, $notes: String) {
    update_activities_by_pk(pk_columns: { id: $id }, _set: { notes: $notes }) {
      id
      notes
    }
  }
`;
