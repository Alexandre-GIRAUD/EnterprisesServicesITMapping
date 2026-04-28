import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApplicationResponse } from '@/types/api';
import { fetchApplications } from '../api/applicationsApi';

const DEBOUNCE_MS = 250;

/** Search applications and navigate to module graph on selection. */
export function ApplicationSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [allApps, setAllApps] = useState<ApplicationResponse[] | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadOnce() {
      if (!debouncedQuery) {
        setStatus('idle');
        setErrorMessage(null);
        setIsOpen(false);
        return;
      }

      setIsOpen(true);

      if (allApps) {
        setStatus('ready');
        setErrorMessage(null);
        return;
      }

      setStatus('loading');
      setErrorMessage(null);
      try {
        const apps = await fetchApplications();
        if (cancelled) return;
        setAllApps(apps);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : 'Impossible de charger les applications');
      }
    }

    void loadOnce();
    return () => {
      cancelled = true;
    };
  }, [allApps, debouncedQuery]);

  const filteredApps = useMemo(() => {
    if (!debouncedQuery || !allApps) return [];
    const q = debouncedQuery.toLowerCase();
    return allApps.filter((app) => {
      const name = app.name.toLowerCase();
      const description = (app.description ?? '').toLowerCase();
      return name.includes(q) || description.includes(q) || app.id.toLowerCase().includes(q);
    });
  }, [allApps, debouncedQuery]);

  function openApplication(appId: string) {
    setIsOpen(false);
    setQuery('');
    setDebouncedQuery('');
    navigate(`/map/apps/${encodeURIComponent(appId)}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (event.key === 'Enter' && filteredApps.length > 0) {
      event.preventDefault();
      openApplication(filteredApps[0].id);
    }
  }

  return (
    <div ref={wrapperRef} className="application-search">
      <label htmlFor="application-search-input" className="application-search-label">
        Rechercher une application
      </label>
      <input
        id="application-search-input"
        className="application-search-input"
        type="search"
        value={query}
        placeholder="Ex: portail, gateway, paiement..."
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (query.trim()) setIsOpen(true);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />

      {isOpen && debouncedQuery && (
        <div className="application-search-dropdown" role="listbox" aria-label="Resultats applications">
          {status === 'loading' && <p className="application-search-state">Chargement...</p>}
          {status === 'error' && errorMessage && (
            <p className="application-search-error" role="alert">
              {errorMessage}
            </p>
          )}
          {status === 'ready' && filteredApps.length === 0 && (
            <p className="application-search-state">Aucune application trouvee</p>
          )}
          {status === 'ready' &&
            filteredApps.slice(0, 8).map((app) => (
              <button
                key={app.id}
                type="button"
                className="application-search-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openApplication(app.id)}
              >
                <span className="application-search-item-name">{app.name}</span>
                <span className="application-search-item-id">{app.id.slice(0, 12)}...</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
