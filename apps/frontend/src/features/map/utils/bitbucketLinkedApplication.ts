/**
 * Bitbucket imports store the repo slug as the application name and
 * {@code Bitbucket: https://bitbucket.org/workspace/repo} in the description.
 * A slash in the name is not a Bitbucket link (that shape is a GitHub import).
 */
const BITBUCKET_REPO_URL = /bitbucket\.org[/:][a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/i;

export function applicationNameForBitbucketRepo(repoName: string): string {
  const trimmed = repoName.trim();
  const slash = trimmed.lastIndexOf('/');
  if (slash <= 0 || slash === trimmed.length - 1) return trimmed;
  return trimmed.slice(slash + 1);
}

export function applicationDescriptionForBitbucketRepo(
  description: string | null | undefined,
  htmlUrl: string,
): string {
  const blurb = (description ?? '').trim();
  const link = `Bitbucket: ${htmlUrl.trim()}`;
  if (!blurb) return link;
  if (blurb.toLowerCase().includes(htmlUrl.trim().toLowerCase())) return blurb;
  return `${blurb}\n${link}`;
}

export function bitbucketFullNamesInText(text: string | null | undefined): string[] {
  const found: string[] = [];
  const pattern = /bitbucket\.org[/:]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/gi;
  for (const match of (text ?? '').matchAll(pattern)) {
    const repo = match[2].replace(/\.git$/i, '');
    found.push(`${match[1]}/${repo}`);
  }
  return [...new Set(found)];
}

export function applicationDescriptionForBitbucketRepos(
  repos: ReadonlyArray<{ description?: string | null; htmlUrl: string }>,
): string {
  const blurbs = repos
    .map((repo) => (repo.description ?? '').trim())
    .filter((blurb) => blurb.length > 0);
  const links = repos.map((repo) => `Bitbucket: ${repo.htmlUrl.trim()}`);
  return [...blurbs, ...links].join('\n');
}

export function descriptionWithAdditionalBitbucketRepos(
  existing: string | null | undefined,
  repos: ReadonlyArray<{ description?: string | null; htmlUrl: string }>,
): string {
  const current = (existing ?? '').trim();
  const currentLower = current.toLowerCase();
  const additions = repos.flatMap((repo) => {
    const lines: string[] = [];
    const blurb = (repo.description ?? '').trim();
    const link = `Bitbucket: ${repo.htmlUrl.trim()}`;
    if (blurb && !currentLower.includes(blurb.toLowerCase())) lines.push(blurb);
    if (!currentLower.includes(link.toLowerCase())) lines.push(link);
    return lines;
  });
  if (additions.length === 0) return current;
  if (!current) return additions.join('\n');
  return `${current}\n${additions.join('\n')}`;
}

/** Match by the Bitbucket URL only, so a same-named GitHub app is not the same import. */
export function applicationMatchesBitbucketRepo(
  app: { name?: string | null; description?: string | null },
  repo: { name: string; fullName: string },
): boolean {
  const fullName = repo.fullName.trim().toLowerCase();
  return bitbucketFullNamesInText(app.description).some((linked) => linked.toLowerCase() === fullName);
}

export function isBitbucketLinkedApplication(app: {
  name?: string | null;
  description?: string | null;
}): boolean {
  return BITBUCKET_REPO_URL.test((app.description ?? '').trim());
}
