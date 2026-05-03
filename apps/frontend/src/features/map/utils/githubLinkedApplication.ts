/**
 * When to show "Suggest modules (AI)" for an application.
 * Aligns with {@code GithubRepoIdentityResolver} on the backend:
 * - Imported apps use {@code name === owner/repo} (contains a slash).
 * - Or {@code description} was set as {@code GitHub: https://github.com/owner/repo} during import.
 */
export function isGitHubLinkedApplication(app: {
  name?: string | null;
  description?: string | null;
}): boolean {
  const name = (app.name ?? '').trim();
  if (name.includes('/')) {
    return true;
  }
  const d = (app.description ?? '').trim();
  return /^GitHub:\s*/i.test(d);
}
