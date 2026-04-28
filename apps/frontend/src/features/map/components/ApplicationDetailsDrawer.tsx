import { useEffect, useMemo, useState } from 'react';
import type { ApplicationResponse } from '@/types/api';
import { fetchApplicationById } from '../api/applicationsApi';

type ApplicationDetails = {
  id: string;
  label: string;
};

type ApplicationDetailsDrawerProps = {
  isOpen: boolean;
  application: ApplicationDetails | null;
  onClose: () => void;
  onOpenModuleGraph: (applicationId: string) => void;
};

export function ApplicationDetailsDrawer({
  isOpen,
  application,
  onClose,
  onOpenModuleGraph,
}: ApplicationDetailsDrawerProps) {
  const [details, setDetails] = useState<ApplicationResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !application?.id) return;
    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    void fetchApplicationById(application.id)
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
        setStatus('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : "Impossible de charger les details");
      });

    return () => {
      cancelled = true;
    };
  }, [application?.id, isOpen]);

  const description =
    details?.description && details.description.trim().length > 0
      ? details.description
      : 'Description non renseignée.';

  const validFromText = useMemo(() => formatIsoDate(details?.validFrom), [details?.validFrom]);
  const validToText = useMemo(
    () => (details?.validTo ? formatIsoDate(details.validTo) : 'Toujours actif'),
    [details?.validTo]
  );

  return (
    <aside
      className={`graph-details-drawer${isOpen ? ' is-open' : ''}`}
      aria-label="Panneau de détails d'application"
    >
      <header className="graph-details-header">
        <p className="graph-drawer-eyebrow">Application</p>
        <div className="graph-drawer-title-row">
          <div>
            <h2 className="graph-drawer-title">{application?.label ?? 'Détails'}</h2>
            {application?.id && <p className="graph-details-id">{application.id}</p>}
          </div>
          <button
            type="button"
            className="graph-drawer-close"
            onClick={onClose}
            aria-label="Fermer les détails application"
          >
            x
          </button>
        </div>
      </header>

      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Description</h3>
        {status === 'loading' && <p className="graph-details-text">Chargement...</p>}
        {status === 'error' && (
          <p className="graph-details-text graph-details-text-error">
            {errorMessage ?? 'Impossible de charger les détails.'}
          </p>
        )}
        {status !== 'loading' && status !== 'error' && <p className="graph-details-text">{description}</p>}
      </section>

      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Validité</h3>
        {status === 'loading' && <p className="graph-details-text">Chargement...</p>}
        {status === 'error' && (
          <p className="graph-details-text graph-details-text-error">
            Impossible de charger la validité.
          </p>
        )}
        {status !== 'loading' && status !== 'error' && (
          <>
            <p className="graph-details-text">
              <strong>Valid from:</strong> {validFromText}
            </p>
            <p className="graph-details-text">
              <strong>Valid to:</strong> {validToText}
            </p>
          </>
        )}
      </section>

      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Contributors</h3>
        <p className="graph-details-text">Contributors: à venir</p>
      </section>

      {application?.id && (
        <button
          type="button"
          className="graph-drawer-action graph-drawer-action-primary"
          onClick={() => onOpenModuleGraph(application.id)}
        >
          <span className="graph-drawer-action-title">Open module graph</span>
        </button>
      )}
    </aside>
  );
}

function formatIsoDate(value?: string | null): string {
  if (!value) return 'Non renseigné';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
