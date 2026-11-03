import { useEffect, useState } from 'react';
import type { SourceMappingAlertDto } from '@/types/api';
import { listSourceAlerts } from '../api/sourcesApi';

type SourceMappingAlertProps = {
  /** Called with the source id when the user wants to open its mapping. */
  onOpenMapping: (sourceId: string) => void;
  refreshKey?: number;
};

export function SourceMappingAlert({ onOpenMapping, refreshKey = 0 }: SourceMappingAlertProps) {
  const [alerts, setAlerts] = useState<SourceMappingAlertDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    listSourceAlerts()
      .then((next) => {
        if (!cancelled) setAlerts(next);
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (alerts.length === 0) return null;
  return (
    <div className="source-mapping-alert" role="alert">
      {alerts.map((alert) => (
        <p key={alert.sourceId}>
          <strong>{alert.sourceName}</strong>: {alert.applications.length} application
          {alert.applications.length > 1 ? 's' : ''} to map (
          {alert.applications
            .slice(0, 3)
            .map((app) => app.name)
            .join(', ')}
          {alert.applications.length > 3 ? '…' : ''}).{' '}
          <button type="button" className="source-link-btn" onClick={() => onOpenMapping(alert.sourceId)}>
            Open mapping
          </button>
        </p>
      ))}
    </div>
  );
}
