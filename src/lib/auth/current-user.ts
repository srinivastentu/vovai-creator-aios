// V1 auth: one hardcoded local user. Every data-layer action scopes its
// queries to this id so the Clerk swap in V2 is a one-line change.
// TODO(V2): wire Clerk — replace this constant with the session lookup.

export const CURRENT_USER_ID = "local-user"

export function getCurrentUserId(): string {
  return CURRENT_USER_ID
}
