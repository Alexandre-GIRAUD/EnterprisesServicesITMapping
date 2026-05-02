import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GitHubRepoDto } from '@/types/api';
import { createApplication, fetchApplications } from '../api/applicationsApi';
import { fetchGitHubRepos } from '../api/integrationsGithubApi';

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

export function GitHubImportPage() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<GitHubRepoDto[]>([]);
  const [importedNames, setImportedNames] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setErrorMessage(null);
      try {
        const [githubList, apps] = await Promise.all([
          fetchGitHubRepos(),
          fetchApplications(),
        ]);
        if (cancelled) return;
        setRepos(githubList);
        setImportedNames(
          new Set(apps.map((a) => normalizeName(a.name ?? '')).filter(Boolean))
        );
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : 'Chargement impossible.');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRepos = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repos, filter]);

  function isImported(repo: GitHubRepoDto): boolean {
    return importedNames.has(normalizeName(repo.fullName));
  }

  function toggleSelect(id: number, repo: GitHubRepoDto) {
    if (isImported(repo)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImportSelection() {
    setSuccessMessage(null);
    setImportErrors([]);
    const toCreate = repos.filter((r) => selected.has(r.id) && !isImported(r));
    if (toCreate.length === 0) {
      setImportErrors(["Aucun dépôt sélectionné (ou tous sont déjà importés)."]);
      return;
    }

    const errors: string[] = [];
    const createdNames: string[] = [];

    try {
      setIsImporting(true);
      for (const repo of toCreate) {
        try {
          await createApplication({
            name: repo.fullName,
            description: repo.description?.trim() || `GitHub: ${repo.htmlUrl}`,
            validFrom: new Date().toISOString(),
            validTo: null,
          });
          createdNames.push(normalizeName(repo.fullName));
        } catch (e) {
          errors.push(
            `${repo.fullName}: ${e instanceof Error ? e.message : 'échec'}`
          );
        }
      }

      if (createdNames.length > 0) {
        setImportedNames((prev) => new Set([...prev, ...createdNames]));
        setSelected(new Set());
        setSuccessMessage(
          `${createdNames.length} application(s) créée(s). Ouvrez la carte pour voir le graphe mis à jour.`
        );
      }
      setImportErrors(errors);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="github-import-page">
      <header className="github-import-header">
        <div>
          <p className="github-import-eyebrow">Integrations</p>
          <h1 className="github-import-title">Import GitHub</h1>
          <p className="github-import-subtitle">
            Les dépôts sont listés via le backend (token{' '}
            <code className="github-import-code">GITHUB_TOKEN</code>). Cochez les
            projets à importer comme applications dans Neo4j.
          </p>
        </div>
        <Link className="github-import-back" to="/map">
          Retour carte
        </Link>
      </header>

      <div className="github-import-toolbar">
        <label className="github-import-search-label">
          <span className="github-import-search-span">Filtrer</span>
          <input
            className="github-import-search-input"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="owner/repo, nom, description…"
            autoComplete="off"
            disabled={status !== 'ready'}
          />
        </label>
        <button
          type="button"
          className="github-import-primary"
          disabled={isImporting || status !== 'ready' || selected.size === 0}
          onClick={() => void handleImportSelection()}
        >
          {isImporting ? 'Import…' : 'Importer la sélection'}
        </button>
      </div>

      {status === 'loading' && (
        <p className="github-import-state" role="status">
          Chargement des dépôts GitHub…
        </p>
      )}
      {status === 'error' && errorMessage && (
        <p className="github-import-state github-import-state-error" role="alert">
          {errorMessage}
        </p>
      )}

      {importErrors.length > 0 && (
        <div className="github-import-feedback github-import-feedback-error" role="alert">
          <p className="github-import-feedback-title">Erreurs partielles</p>
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
            Ouvrir la carte
          </button>
        </div>
      )}

      {status === 'ready' && filteredRepos.length === 0 && (
        <p className="github-import-state">Aucun dépôt ne correspond au filtre.</p>
      )}

      <ul className="github-import-list" aria-label="Dépôts GitHub">
        {filteredRepos.map((repo) => {
          const imported = isImported(repo);
          const checked = imported || selected.has(repo.id);
          return (
            <li key={repo.id} className="github-import-card">
              <label className="github-import-row">
                <input
                  type="checkbox"
                  className="github-import-checkbox"
                  checked={checked}
                  disabled={imported || isImporting}
                  onChange={() => toggleSelect(repo.id, repo)}
                  aria-describedby={`repo-desc-${repo.id}`}
                />
                <span className="github-import-card-body">
                  <span className="github-import-card-title">
                    {repo.fullName}
                    {repo.repoPrivate && (
                      <span className="github-import-badge github-import-badge-private">
                        Private
                      </span>
                    )}
                    {imported && (
                      <span className="github-import-badge github-import-badge-imported">
                        Déjà importé
                      </span>
                    )}
                  </span>
                  <span id={`repo-desc-${repo.id}`} className="github-import-card-desc">
                    {repo.description?.trim() || 'Pas de description sur GitHub.'}
                  </span>
                  <a
                    className="github-import-link"
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ouvrir sur GitHub
                  </a>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="github-import-footnote" role="note">
        Pagination GitHub : la première page seulement est chargée (max 100 dépôts les plus
        récemment mis à jour). Les applications existantes sont détectées par nom exact (
        <code className="github-import-code">full_name</code> GitHub).
      </p>
    </div>
  );
}
