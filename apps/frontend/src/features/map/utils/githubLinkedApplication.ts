/**
 * When to show "Suggest modules (AI)" for an application.
 * Aligns with {@code GithubRepoIdentityResolver} on the backend:
 * - Older imports used {@code name === owner/repo}.
 * - Current imports store the repo name and keep {@code GitHub: https://github.com/owner/repo} in the description.
 */
const GITHUB_REPO_URL = /github\.com[/:][a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/i;

export function applicationNameForGitHubRepo(repoName: string): string {
  const trimmed = repoName.trim();
  const slash = trimmed.lastIndexOf('/');
  if (slash <= 0 || slash === trimmed.length - 1) return trimmed;
  return trimmed.slice(slash + 1);
}

export function applicationDescriptionForGitHubRepo(
  description: string | null | undefined,
  htmlUrl: string,
): string {
  const blurb = (description ?? '').trim();
  const url = htmlUrl.trim();
  const link = `GitHub: ${url}`;
  if (!blurb) return link;
  if (blurb.toLowerCase().includes(url.toLowerCase())) return blurb;
  return `${blurb}\n${link}`;
}

export function isGitHubLinkedApplication(app: {
  name?: string | null;
  description?: string | null;
}): boolean {
  const name = (app.name ?? '').trim();
  if (name.includes('/')) {
    return true;
  }
  const description = (app.description ?? '').trim();
  return /^GitHub:\s*/i.test(description) || GITHUB_REPO_URL.test(description);
}
