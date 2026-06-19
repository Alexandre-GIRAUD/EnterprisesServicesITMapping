import { useCallback, useEffect, useState } from 'react';
import { deleteGraphSnapshot, listGraphSnapshots } from '../api/graphSnapshotsApi';
import { useGraphSnapshotsRefresh } from '../context/GraphSnapshotsContext';
import type { GraphSnapshotDto } from '@/types/api';

export type GraphSnapshotsListStatus = 'loading' | 'ready' | 'error';

/**
 * Loads the current user's saved graph views and keeps them in sync with the
 * shared refresh signal. Reloads whenever a snapshot is created elsewhere.
 */
export function useGraphSnapshotsList() {
  const { version } = useGraphSnapshotsRefresh();
  const [snapshots, setSnapshots] = useState<GraphSnapshotDto[]>([]);
  const [status, setStatus] = useState<GraphSnapshotsListStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await listGraphSnapshots();
      setSnapshots(data);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Unable to load views.');
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [version, loadSnapshots]);

  const deleteSnapshot = useCallback(async (id: string, name: string) => {
    if (!window.confirm(`Delete view "${name}"?`)) return;
    try {
      await deleteGraphSnapshot(id);
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Unable to delete.');
    }
  }, []);

  return { snapshots, status, errorMessage, loadSnapshots, deleteSnapshot };
}
