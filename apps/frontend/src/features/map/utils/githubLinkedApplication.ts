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

/** Every owner/repo mentioned in an application description, in order. */
export function gitHubFullNamesInText(text: string | null | undefined): string[] {
  const found: string[] = [];
  const pattern = /github\.com[/:]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/gi;
  for (const match of (text ?? '').matchAll(pattern)) {
    const repo = match[2].replace(/\.git$/i, '');
    found.push(`${match[1]}/${repo}`);
  }
  return [...new Set(found)];
}

export function applicationDescriptionForGitHubRepos(
  repos: ReadonlyArray<{ description?: string | null; htmlUrl: string }>,
): string {
  const blurbs = repos
    .map((repo) => (repo.description ?? '').trim())
    .filter((blurb) => blurb.length > 0);
  const links = repos.map((repo) => `GitHub: ${repo.htmlUrl.trim()}`);
  return [...blurbs, ...links].join('\n');
}

/** Keeps the current description and appends GitHub lines that are not already there. */
export function descriptionWithAdditionalGitHubRepos(
  existing: string | null | undefined,
  repos: ReadonlyArray<{ description?: string | null; htmlUrl: string }>,
): string {
  const current = (existing ?? '').trim();
  const currentLower = current.toLowerCase();
  const additions = repos.flatMap((repo) => {
    const lines: string[] = [];
    const blurb = (repo.description ?? '').trim();
    const link = `GitHub: ${repo.htmlUrl.trim()}`;
    if (blurb && !currentLower.includes(blurb.toLowerCase())) lines.push(blurb);
    if (!currentLower.includes(link.toLowerCase())) lines.push(link);
    return lines;
  });
  if (additions.length === 0) return current;
  if (!current) return additions.join('\n');
  return `${current}\n${additions.join('\n')}`;
}

export function applicationMatchesGitHubRepo(
  app: { name?: string | null; description?: string | null },
  repo: { name: string; fullName: string },
): boolean {
  const name = (app.name ?? '').trim().toLowerCase();
  const shortName = applicationNameForGitHubRepo(repo.name).trim().toLowerCase();
  const fullName = repo.fullName.trim().toLowerCase();
  if (name === shortName || name === fullName) return true;
  return gitHubFullNamesInText(app.description).some((linked) => linked.toLowerCase() === fullName);
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
