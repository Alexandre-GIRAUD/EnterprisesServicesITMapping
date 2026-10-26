import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { ApplicationResponse, GitHubRepoDto } from '@/types/api';
import {
  createApplication,
  fetchApplications,
  suggestConnectionsFromGithub,
  suggestModulesFromGithub,
  updateApplicationById,
} from '../api/applicationsApi';
import { generateFunctionalDocumentation } from '../api/functionalDocumentationApi';
import { fetchGitHubRepos } from '../api/integrationsGithubApi';
import { ThirdPartySources } from '../components/ThirdPartySources';
import { navigateToModuleGraph } from '../utils/mapNavigation';
import {
  applicationDescriptionForGitHubRepo,
  applicationDescriptionForGitHubRepos,
  applicationMatchesGitHubRepo,
  applicationNameForGitHubRepo,
  descriptionWithAdditionalGitHubRepos,
  isGitHubLinkedApplication,
} from '../utils/githubLinkedApplication';

const GITHUB_MARK_PATH =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={GITHUB_MARK_PATH} />
    </svg>
  );
}

export function GitHubImportPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [repos, setRepos] = useState<GitHubRepoDto[]>([]);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [aiBanner, setAiBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [lastSuggestApplicationId, setLastSuggestApplicationId] = useState<string | null>(null);
  const [aiBusyRepoId, setAiBusyRepoId] = useState<number | null>(null);
  const [connBusyRepoId, setConnBusyRepoId] = useState<number | null>(null);
  const [sourceMode, setSourceMode] = useState<'repository' | 'third-party'>('repository');
  const [targetApplicationId, setTargetApplicationId] = useState('');
  const [groupName, setGroupName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  function isImported(repo: GitHubRepoDto): boolean {
    return applicationForRepo(repo) != null;
  }

  useEffect(() => {
    const flag = searchParams.get('github');
    if (!flag) return;
    if (flag === 'connected') setSuccessMessage('GitHub account connected.');
    else setErrorMessage('GitHub connection was not completed.');
    const next = new URLSearchParams(searchParams);
    next.delete('github');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const oauthFlag = new URLSearchParams(window.location.search).get('github');
    let cancelled = false;

    async function load() {
      setStatus('loading');
      let applicationError: string | null = null;
      try {
        const apps = await fetchApplications();
        if (!cancelled) setApplications(apps);
      } catch (e) {
        applicationError = e instanceof Error ? e.message : 'Unable to load applications.';
      }
      try {
        const githubList = await fetchGitHubRepos();
        if (cancelled) return;
        setRepos(githubList);
        setStatus('ready');
        if (applicationError) setErrorMessage(applicationError);
        else if (oauthFlag !== 'denied' && oauthFlag !== 'failed') setErrorMessage(null);
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(
          applicationError ?? (e instanceof Error ? e.message : 'Unable to load repositories.')
        );
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRepos = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matched = q
      ? repos.filter(
          (r) =>
            r.fullName.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            (r.description && r.description.toLowerCase().includes(q))
        )
      : repos;
    return matched;
  }, [repos, filter]);

  const importedApplications = useMemo(
    () => [...applications].sort((left, right) => (left.name ?? '').localeCompare(right.name ?? '')),
    [applications],
  );

  function toggleSelect(id: number, repo: GitHubRepoDto) {
    if (isImported(repo)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (groupName === null) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setGroupName(null);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [groupName]);

  async function handleImportSelection(confirmedName?: string) {
    setSuccessMessage(null);
    setAiBanner(null);
    setImportErrors([]);
    const toCreate = repos.filter((r) => selected.has(r.id) && !isImported(r));
    if (toCreate.length === 0) {
      setImportErrors(['No repository selected (or all are already imported).']);
      return;
    }

    const errors: string[] = [];
    const createdNames: string[] = [];
    const target = importedApplications.find((application) => application.id === targetApplicationId);

    if (!target && toCreate.length > 1 && confirmedName === undefined) {
      setNameError(null);
      setGroupName('');
      return;
    }

    try {
      setIsImporting(true);
      if (target) {
        try {
          const updated = await updateApplicationById(target.id, {
            name: target.name,
            description: descriptionWithAdditionalGitHubRepos(target.description, toCreate),
          });
          setApplications((prev) => prev.map((application) => (application.id === updated.id ? updated : application)));
          createdNames.push(normalizeName(target.name));
          await rescanApplication(updated.id, errors);
          setSuccessMessage(
            errors.length === 0
              ? `Added ${toCreate.length} repository(ies) to ${target.name}. The scan is running again on every linked repository.`
              : `Added ${toCreate.length} repository(ies) to ${target.name}.`
          );
        } catch (e) {
          errors.push(`${target.name}: ${e instanceof Error ? e.message : 'failed'}`);
        }
      } else if (toCreate.length > 1) {
        const name = confirmedName?.trim() ?? '';
        try {
          const created = await createApplication({
            name,
            description: applicationDescriptionForGitHubRepos(toCreate),
          });
          setApplications((prev) => [...prev, created]);
          createdNames.push(normalizeName(name));
          void generateFunctionalDocumentation(created.id).catch(() => {
            /* import succeeds even if doc generation fails to start */
          });
        } catch (e) {
          errors.push(`${name}: ${e instanceof Error ? e.message : 'failed'}`);
        }
      } else {
        for (const repo of toCreate) {
          try {
            const created = await createApplication({
              name: applicationNameForGitHubRepo(repo.name),
              description: applicationDescriptionForGitHubRepo(repo.description, repo.htmlUrl),
            });
            setApplications((prev) => [...prev, created]);
            createdNames.push(normalizeName(applicationNameForGitHubRepo(repo.name)));
            void generateFunctionalDocumentation(created.id).catch(() => {
              /* import succeeds even if doc generation fails to start */
            });
          } catch (e) {
            errors.push(`${repo.fullName}: ${e instanceof Error ? e.message : 'failed'}`);
          }
        }
      }

      if (createdNames.length > 0) {
        setSelected(new Set());
        setGroupName(null);
        if (!target) {
          setSuccessMessage(
            `${createdNames.length} application(s) created. Open the map to see the updated graph.`
          );
        }
      }
      setImportErrors(errors);
    } finally {
      setIsImporting(false);
    }
  }

  async function rescanApplication(applicationId: string, errors: string[]) {
    try {
      await generateFunctionalDocumentation(applicationId);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Functional documentation failed to start.');
    }
    try {
      await suggestModulesFromGithub(applicationId, { replaceExisting: true });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Module scan failed.');
    }
    try {
      await suggestConnectionsFromGithub(applicationId);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Scan connections and attributes failed.');
    }
  }

  function applicationForRepo(repo: GitHubRepoDto): ApplicationResponse | undefined {
    return applications.find((application) => applicationMatchesGitHubRepo(application, repo));
  }

  function resolveApplicationId(repo: GitHubRepoDto): string | undefined {
    return applicationForRepo(repo)?.id;
  }

  async function handleSuggestModules(repo: GitHubRepoDto) {
    const appId = resolveApplicationId(repo);
    setAiBanner(null);
    setLastSuggestApplicationId(null);
    const linkedApplication = applicationForRepo(repo);
    if (!appId || !linkedApplication || !isGitHubLinkedApplication(linkedApplication)) {
      setAiBanner({
        tone: 'err',
        text: `Neo4j application not found for ${repo.fullName} or repository not detected as GitHub.`,
      });
      return;
    }
    try {
      setAiBusyRepoId(repo.id);
      const res = await suggestModulesFromGithub(appId);
      setLastSuggestApplicationId(appId);
      setApplications(await fetchApplications());
      setAiBanner({
        tone: 'ok',
        text: `${res.created.length} module(s) created. ${res.skipped.length} entry(ies) skipped.`,
      });
    } catch (e) {
      setAiBanner({
        tone: 'err',
        text: e instanceof Error ? e.message : 'AI suggestion failed.',
      });
    } finally {
      setAiBusyRepoId(null);
    }
  }

  async function handleSuggestConnections(repo: GitHubRepoDto) {
    const appId = resolveApplicationId(repo);
    setAiBanner(null);
    setLastSuggestApplicationId(null);
    const linkedApplication = applicationForRepo(repo);
    if (!appId || !linkedApplication || !isGitHubLinkedApplication(linkedApplication)) {
      setAiBanner({
        tone: 'err',
        text: `Neo4j application not found for ${repo.fullName} or repository not detected as GitHub.`,
      });
      return;
    }
    try {
      setConnBusyRepoId(repo.id);
      const res = await suggestConnectionsFromGithub(appId);
      const outbound = res.created.filter((c) => c.direction === 'outbound').length;
      const inbound = res.created.length - outbound;
      setApplications(await fetchApplications());
      setAiBanner({
        tone: 'ok',
        text: `${res.created.length} connection(s) created (${outbound} outbound, ${inbound} inbound). ${res.skipped.length} skipped.`,
      });
    } catch (e) {
      setAiBanner({
        tone: 'err',
        text: e instanceof Error ? e.message : 'Scan connections and attributes failed.',
      });
    } finally {
      setConnBusyRepoId(null);
    }
  }

  return (
    <div className="github-import-page">
      <header className="github-import-header">
        <div>
          <h1 className="github-import-title">Import sources</h1>
          <p className="github-import-subtitle">
            Import repositories from the GitHub account connected in Settings.
          </p>
        </div>
        <Link className="github-import-back" to="/map">
          Back to map
        </Link>
      </header>

      <div className="github-import-tabs" role="tablist" aria-label="Source kind">
        <button
          type="button"
          className={`github-import-tab${sourceMode === 'repository' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={sourceMode === 'repository'}
          onClick={() => setSourceMode('repository')}
        >
          <GitHubMark />
          Repository
        </button>
        <button
          type="button"
          className={`github-import-tab${sourceMode === 'third-party' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={sourceMode === 'third-party'}
          onClick={() => setSourceMode('third-party')}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              d="M6.5 9.5l3-3M7 4.5H4.8A2.3 2.3 0 002.5 6.8v0A2.3 2.3 0 004.8 9.1H7M9 11.5h2.2A2.3 2.3 0 0013.5 9.2v0A2.3 2.3 0 0011.2 6.9H9"
            />
          </svg>
          Third party
        </button>
      </div>

      {errorMessage && (
        <p className="github-import-state github-import-state-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="github-import-panel">
      {sourceMode === 'third-party' ? (
        <ThirdPartySources onChanged={async () => setApplications(await fetchApplications())} />
      ) : (
        <>

      <div className="github-import-ai-live" aria-live="polite" aria-relevant="additions text">
        {aiBanner && (
          <p
            className={
              aiBanner.tone === 'err'
                ? 'github-import-feedback github-import-feedback-error'
                : 'github-import-feedback github-import-feedback-success'
            }
            role={aiBanner.tone === 'err' ? 'alert' : 'status'}
          >
            {aiBanner.text}{' '}
            {aiBanner.tone === 'ok' && lastSuggestApplicationId ? (
              <button
                type="button"
                className="github-import-inline-link"
                onClick={() => {
                  const app = applications.find((a) => a.id === lastSuggestApplicationId);
                  navigateToModuleGraph(navigate, lastSuggestApplicationId, app?.name);
                }}
              >
                View module graph
              </button>
            ) : null}
          </p>
        )}
      </div>

      <div className="github-import-tools">
        <label className="github-import-search">
          <svg className="github-import-search-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.2 10.2L13.5 13.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className="github-import-search-input"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search a repository, an owner, a description…"
            autoComplete="off"
            disabled={status !== 'ready'}
            aria-label="Search repositories"
          />
        </label>
        <select
          className="github-import-filters"
          value={targetApplicationId}
          aria-label="Application"
          disabled={isImporting || status !== 'ready'}
          onChange={(event) => {
            setTargetApplicationId(event.target.value);
            setGroupName(null);
          }}
        >
          <option value="">Create New</option>
          {importedApplications.map((application) => (
            <option key={application.id} value={application.id}>
              {application.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="github-import-primary"
          disabled={isImporting || status !== 'ready' || selected.size === 0}
          onClick={() => void handleImportSelection()}
        >
          {isImporting ? 'Importing…' : 'Import selection'}
        </button>
      </div>

      <p className="github-import-counts">
        <span>{filteredRepos.length} repositories</span>
        <span>{selected.size} selected</span>
      </p>
      {groupName !== null && targetApplicationId === '' ? (
        <div
          className="save-snapshot-dialog-backdrop"
          role="presentation"
          onClick={() => setGroupName(null)}
        >
          <form
            className="save-snapshot-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="github-import-name-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              const name = groupName.trim();
              if (!name) {
                setNameError('Name the application that owns these repositories.');
                return;
              }
              setGroupName(null);
              setNameError(null);
              void handleImportSelection(name);
            }}
          >
            <h2 id="github-import-name-title" className="save-snapshot-dialog-title">
              Application name
            </h2>
            <p className="save-snapshot-dialog-hint">
              Name the application that owns these repositories.
            </p>
            <label className="save-snapshot-dialog-label" htmlFor="github-import-name">
              Name
            </label>
            <input
              id="github-import-name"
              className="save-snapshot-dialog-input"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Application name"
              aria-label="Application name"
              disabled={isImporting}
              autoFocus
            />
            {nameError ? <p className="save-snapshot-dialog-error">{nameError}</p> : null}
            <div className="save-snapshot-dialog-actions">
              <button
                type="button"
                className="save-snapshot-dialog-btn save-snapshot-dialog-btn--secondary"
                onClick={() => setGroupName(null)}
              >
                Cancel
              </button>
              <button type="submit" className="save-snapshot-dialog-btn save-snapshot-dialog-btn--primary">
                Import
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {status === 'loading' && (
        <p className="github-import-state" role="status">
          Loading GitHub repositories…
        </p>
      )}

      {importErrors.length > 0 && (
        <div className="github-import-feedback github-import-feedback-error" role="alert">
          <p className="github-import-feedback-title">Partial errors</p>
          <ul className="github-import-feedback-list">
            {importErrors.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {successMessage && (
        <div
          className="github-import-feedback github-import-feedback-success"
          role="status"
          aria-live="polite"
        >
          {successMessage}{' '}
          <button
            type="button"
            className="github-import-inline-link"
            onClick={() => navigate('/map')}
          >
            Open map
          </button>
        </div>
      )}

      {status === 'ready' && filteredRepos.length === 0 && (
        <p className="github-import-state">No repositories match the filter.</p>
      )}

      <ul className="github-import-list" aria-label="GitHub repositories">
        {filteredRepos.map((repo) => {
          const imported = isImported(repo);
          const appRow = applicationForRepo(repo);
          const modulesLocked = Boolean(appRow?.hasModuleSubtree);
          const checked = imported || selected.has(repo.id);
          return (
            <li key={repo.id} className={`github-import-card${checked ? ' is-selected' : ''}`}>
              <div className="github-import-row">
                <div className="github-import-card-main">
                  <input
                    type="checkbox"
                    className="github-import-checkbox"
                    checked={checked}
                    disabled={imported || isImporting}
                    onChange={() => toggleSelect(repo.id, repo)}
                    aria-label={repo.fullName}
                    aria-describedby={`repo-desc-${repo.id}`}
                  />
                  <span className="github-import-mark">
                    <GitHubMark />
                  </span>
                  <span className="github-import-card-body">
                    <span className="github-import-card-title">
                      <span className="github-import-card-name" title={repo.fullName}>
                        {repo.fullName}
                      </span>
                      {repo.repoPrivate && (
                        <span className="github-import-badge github-import-badge-private">
                          Private
                        </span>
                      )}
                      {imported && (
                        <span className="github-import-badge github-import-badge-imported">
                          Already imported
                        </span>
                      )}
                    </span>
                    <span className="github-import-card-owner">{repo.fullName}</span>
                    <span id={`repo-desc-${repo.id}`} className="github-import-card-desc">
                      {repo.description?.trim() || 'No description on GitHub.'}
                    </span>
                    <a
                      className="github-import-link"
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open on GitHub
                    </a>
                  </span>
                </div>
                {imported &&
                  isGitHubLinkedApplication({
                    name: applicationNameForGitHubRepo(repo.name),
                    description: applicationDescriptionForGitHubRepo(repo.description, repo.htmlUrl),
                  }) && (
                    <div className="github-import-card-ai">
                      <button
                        type="button"
                        className="github-import-ai-btn"
                        disabled={
                          status !== 'ready' ||
                          aiBusyRepoId !== null ||
                          connBusyRepoId !== null ||
                          isImporting ||
                          !resolveApplicationId(repo)
                        }
                        aria-busy={connBusyRepoId === repo.id}
                        onClick={() => void handleSuggestConnections(repo)}
                      >
                        {connBusyRepoId === repo.id
                          ? 'Scanning connections and attributes…'
                          : 'Scan connections and attributes'}
                      </button>
                      <button
                        type="button"
                        className="github-import-ai-btn"
                        disabled={
                          status !== 'ready' ||
                          aiBusyRepoId !== null ||
                          connBusyRepoId !== null ||
                          isImporting ||
                          !resolveApplicationId(repo) ||
                          modulesLocked
                        }
                        title={
                          modulesLocked
                            ? 'Modules are already linked to this application. AI suggestion cannot be run again.'
                            : undefined
                        }
                        aria-busy={aiBusyRepoId === repo.id}
                        onClick={() => void handleSuggestModules(repo)}
                      >
                        {aiBusyRepoId === repo.id
                          ? 'Suggesting modules…'
                          : modulesLocked
                            ? 'Modules already in place'
                            : 'Suggest modules (AI)'}
                      </button>
                    </div>
                  )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="github-import-footnote" role="note">
        GitHub pagination: only the first page is loaded (max 100 most recently updated
        repositories). Existing applications are detected by the repository name, not{' '}
        <code className="github-import-code">owner/repo</code>. The &quot;Suggest modules (AI)&quot;
        button appears for already-imported rows when the description still contains the GitHub URL.
        Once modules are linked to the application, the button changes to &quot;Modules already in
        place&quot; (no new AI suggestion).
      </p>
        </>
      )}
      </div>
    </div>
  );
}
