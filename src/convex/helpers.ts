/**
 * Access gate for app functions.
 *
 * This app is intentionally open: there is no sign-in flow and no per-user
 * data scoping, so every function is callable without a session. This helper
 * is kept as the single place callers `await` before touching data, so that if
 * the product ever needs authorization again, the check goes back in here
 * (at which point it would again take the query context).
 */
export async function requirePrincipal() {
  return;
}
