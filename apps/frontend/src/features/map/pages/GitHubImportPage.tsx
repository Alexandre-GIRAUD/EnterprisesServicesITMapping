import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ApplicationResponse, BitbucketRepoDto, GitHubRepoDto } from '@/types/api';
import {
  createApplication,
  fetchApplications,
  suggestConnectionsFromGithub,
  suggestModulesFromGithub,
  updateApplicationById,
} from '../api/applicationsApi';
import { generateFunctionalDocumentation } from '../api/functionalDocumentationApi';
import { fetchBitbucketRepos } from '../api/integrationsBitbucketApi';
import { fetchGitHubRepos } from '../api/integrationsGithubApi';
import { ThirdPartySources } from '../components/ThirdPartySources';
import {
  applicationDescriptionForBitbucketRepo,
  applicationDescriptionForBitbucketRepos,
  applicationMatchesBitbucketRepo,
  applicationNameForBitbucketRepo,
  descriptionWithAdditionalBitbucketRepos,
  isBitbucketLinkedApplication,
} from '../utils/bitbucketLinkedApplication';
import {
  applicationDescriptionForGitHubRepo,
  applicationDescriptionForGitHubRepos,
  applicationMatchesGitHubRepo,
  applicationNameForGitHubRepo,
  descriptionWithAdditionalGitHubRepos,
  isGitHubLinkedApplication,
} from '../utils/githubLinkedApplication';

type SourceHost = 'github' | 'bitbucket';

type ListedRepo = {
  id: string;
  fullName: string;
  name: string;
  description?: string;
  htmlUrl: string;
  repoPrivate: boolean;
  host: SourceHost;
};

function listedFromGitHub(repo: GitHubRepoDto): ListedRepo {
  return {
    id: String(repo.id),
    fullName: repo.fullName,
    name: repo.name,
    description: repo.description,
    htmlUrl: repo.htmlUrl,
    repoPrivate: repo.repoPrivate,
    host: 'github',
  };
}

function listedFromBitbucket(repo: BitbucketRepoDto): ListedRepo {
  return {
    id: repo.id,
    fullName: repo.fullName,
    name: repo.name,
    description: repo.description,
    htmlUrl: repo.htmlUrl,
    repoPrivate: repo.repoPrivate,
    host: 'bitbucket',
  };
}

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

const BITBUCKET_MARK_PATH =
  'M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z';

function BitbucketMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={BITBUCKET_MARK_PATH} />
    </svg>
  );
}

export function GitHubImportPage() {
  const navigate = useNavigate();
  const [githubRepos, setGithubRepos] = useState<ListedRepo[]>([]);
  const [bitbucketRepos, setBitbucketRepos] = useState<ListedRepo[]>([]);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [bitbucketError, setBitbucketError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<'github' | 'bitbucket' | 'third-party'>('github');
  const [targetApplicationId, setTargetApplicationId] = useState('');
  const [groupName, setGroupName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const repos = sourceMode === 'bitbucket' ? bitbucketRepos : githubRepos;
  const hostError = sourceMode === 'bitbucket' ? bitbucketError : githubError;

  function isImported(repo: ListedRepo): boolean {
    return applicationForRepo(repo) != null;
  }

  function selectHost(next: 'github' | 'bitbucket' | 'third-party') {
    setSourceMode(next);
    setSelected(new Set());
    setTargetApplicationId('');
  }

  useEffect(() => {
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
      const [githubResult, bitbucketResult] = await Promise.allSettled([
        fetchGitHubRepos(),
        fetchBitbucketRepos(),
      ]);
      if (cancelled) return;
      if (githubResult.status === 'fulfilled') {
        setGithubRepos(githubResult.value.map(listedFromGitHub));
        setGithubError(null);
      } else {
        setGithubRepos([]);
        setGithubError(
          githubResult.reason instanceof Error
            ? githubResult.reason.message
            : 'Unable to load GitHub repositories.',
        );
      }
      if (bitbucketResult.status === 'fulfilled') {
        setBitbucketRepos(bitbucketResult.value.map(listedFromBitbucket));
        setBitbucketError(null);
      } else {
        setBitbucketRepos([]);
        setBitbucketError(
          bitbucketResult.reason instanceof Error
            ? bitbucketResult.reason.message
            : 'Unable to load Bitbucket repositories.',
        );
      }
      const bothFailed = githubResult.status === 'rejected' && bitbucketResult.status === 'rejected';
      setStatus(bothFailed ? 'error' : 'ready');
      setErrorMessage(applicationError);
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

  const targetApplications = useMemo(
    () =>
      importedApplications.filter((application) =>
        sourceMode === 'bitbucket'
          ? !isGitHubLinkedApplication(application)
          : !isBitbucketLinkedApplication(application),
      ),
    [importedApplications, sourceMode],
  );

  function toggleSelect(id: string, repo: ListedRepo) {
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
          const description =
            toCreate[0]?.host === 'bitbucket'
              ? descriptionWithAdditionalBitbucketRepos(target.description, toCreate)
              : descriptionWithAdditionalGitHubRepos(target.description, toCreate);
          const updated = await updateApplicationById(target.id, {
            name: target.name,
            description,
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
            description:
              toCreate[0]?.host === 'bitbucket'
                ? applicationDescriptionForBitbucketRepos(toCreate)
                : applicationDescriptionForGitHubRepos(toCreate),
          });
          setApplications((prev) => [...prev, created]);
          createdNames.push(normalizeName(name));
          await rescanApplication(created.id, errors);
        } catch (e) {
          errors.push(`${name}: ${e instanceof Error ? e.message : 'failed'}`);
        }
      } else {
        for (const repo of toCreate) {
          try {
            const created = await createApplication(
              repo.host === 'bitbucket'
                ? {
                    name: applicationNameForBitbucketRepo(repo.name),
                    description: applicationDescriptionForBitbucketRepo(repo.description, repo.htmlUrl),
                  }
                : {
                    name: applicationNameForGitHubRepo(repo.name),
                    description: applicationDescriptionForGitHubRepo(repo.description, repo.htmlUrl),
                  },
            );
            setApplications((prev) => [...prev, created]);
            createdNames.push(
              normalizeName(
                repo.host === 'bitbucket'
                  ? applicationNameForBitbucketRepo(repo.name)
                  : applicationNameForGitHubRepo(repo.name),
              ),
            );
            await rescanApplication(created.id, errors);
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
            errors.length === 0
              ? `${createdNames.length} application(s) created. Modules, connections, and attributes were scanned.`
              : `${createdNames.length} application(s) created.`
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

  function applicationForRepo(repo: ListedRepo): ApplicationResponse | undefined {
    return applications.find((application) =>
      repo.host === 'bitbucket'
        ? applicationMatchesBitbucketRepo(application, repo)
        : applicationMatchesGitHubRepo(application, repo),
    );
  }

  return (
    <div className="github-import-page">
      <header className="github-import-header">
        <div>
          <h1 className="github-import-title">Import sources</h1>
          <p className="github-import-subtitle">
            Import repositories from the GitHub or Bitbucket account connected in Settings.
          </p>
        </div>
        <Link className="github-import-back" to="/map">
          Back to map
        </Link>
      </header>

      <div className="github-import-tabs" role="tablist" aria-label="Source kind">
        <button
          type="button"
          className={`github-import-tab${sourceMode === 'github' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={sourceMode === 'github'}
          onClick={() => selectHost('github')}
        >
          <GitHubMark />
          GitHub
        </button>
        <button
          type="button"
          className={`github-import-tab${sourceMode === 'bitbucket' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={sourceMode === 'bitbucket'}
          onClick={() => selectHost('bitbucket')}
        >
          <BitbucketMark />
          Bitbucket
        </button>
        <button
          type="button"
          className={`github-import-tab${sourceMode === 'third-party' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={sourceMode === 'third-party'}
          onClick={() => selectHost('third-party')}
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

      {(errorMessage || (sourceMode !== 'third-party' && hostError)) && (
        <p className="github-import-state github-import-state-error" role="alert">
          {sourceMode !== 'third-party' && hostError ? hostError : errorMessage}
        </p>
      )}

      <div className="github-import-panel">
      {sourceMode === 'third-party' ? (
        <ThirdPartySources onChanged={async () => setApplications(await fetchApplications())} />
      ) : (
        <>

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
          {targetApplications.map((application) => (
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
          {sourceMode === 'bitbucket' ? 'Loading Bitbucket repositories…' : 'Loading GitHub repositories…'}
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

      {status === 'ready' && !hostError && filteredRepos.length === 0 && (
        <p className="github-import-state">No repositories match the filter.</p>
      )}

      <ul className="github-import-list" aria-label={sourceMode === 'bitbucket' ? 'Bitbucket repositories' : 'GitHub repositories'}>
        {filteredRepos.map((repo) => {
          const imported = isImported(repo);
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
                    {repo.host === 'bitbucket' ? <BitbucketMark /> : <GitHubMark />}
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
                      {repo.description?.trim() ||
                        (repo.host === 'bitbucket' ? 'No description on Bitbucket.' : 'No description on GitHub.')}
                    </span>
                    <a
                      className="github-import-link"
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {repo.host === 'bitbucket' ? 'Open on Bitbucket' : 'Open on GitHub'}
                    </a>
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="github-import-footnote" role="note">
        {sourceMode === 'bitbucket'
          ? 'Bitbucket pagination: only the first page is loaded (max 100 most recently updated repositories). An application is already imported when its description contains the Bitbucket URL. A GitHub application with the same name is not treated as this repository. Import scans modules, connections, and attributes.'
          : 'GitHub pagination: only the first page is loaded (max 100 most recently updated repositories). Existing applications are detected by the repository name, not owner/repo. Import scans modules, connections, and attributes.'}
      </p>
        </>
      )}
      </div>
    </div>
  );
}
