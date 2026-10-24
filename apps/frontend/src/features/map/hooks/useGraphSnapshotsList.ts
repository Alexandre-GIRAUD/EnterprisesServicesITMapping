import { useCallback, useEffect, useState } from 'react';
import {
  createGraphViewFolder,
  deleteGraphViewFolder,
  listGraphViewFolders,
  moveGraphViewFolder,
  renameGraphViewFolder,
  shareGraphViewFolder,
} from '../api/graphViewFoldersApi';
import {
  deleteGraphSnapshot,
  listGraphSnapshots,
  moveGraphSnapshot,
  renameGraphSnapshot,
  shareGraphSnapshot,
} from '../api/graphSnapshotsApi';
import { useGraphSnapshotsRefresh } from '../context/GraphSnapshotsContext';
import type { GraphSnapshotDto, GraphViewFolderDto } from '@/types/api';

export type GraphSnapshotsListStatus = 'loading' | 'ready' | 'error';

/**
 * Loads the current user's saved views and view folders.
 */
export function useGraphSnapshotsList() {
  const { version } = useGraphSnapshotsRefresh();
  const [snapshots, setSnapshots] = useState<GraphSnapshotDto[]>([]);
  const [folders, setFolders] = useState<GraphViewFolderDto[]>([]);
  const [status, setStatus] = useState<GraphSnapshotsListStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [views, folderList] = await Promise.all([listGraphSnapshots(), listGraphViewFolders()]);
    setSnapshots(views);
    setFolders(folderList);
  }, []);

  const loadSnapshots = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      await reload();
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Unable to load views.');
    }
  }, [reload]);

  useEffect(() => {
    void loadSnapshots();
  }, [version, loadSnapshots]);

  const refreshQuietly = useCallback(async () => {
    try {
      await reload();
      setErrorMessage(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to update views.';
      setErrorMessage(message);
      throw e;
    }
  }, [reload]);

  const renameSnapshot = useCallback(async (id: string, name: string) => {
    try {
      const updated = await renameGraphSnapshot(id, name);
      setSnapshots((prev) => prev.map((snapshot) => (snapshot.id === id ? updated : snapshot)));
      setErrorMessage(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to rename.';
      setErrorMessage(message);
      throw e;
    }
  }, []);

  const deleteSnapshot = useCallback(async (id: string) => {
    await deleteGraphSnapshot(id);
    setSnapshots((prev) => prev.filter((snapshot) => snapshot.id !== id));
  }, []);

  const moveSnapshot = useCallback(
    async (id: string, folderId: string | null) => {
      await moveGraphSnapshot(id, folderId);
      await refreshQuietly();
    },
    [refreshQuietly],
  );

  const createFolder = useCallback(
    async (name: string, parentId: string | null) => {
      await createGraphViewFolder(name, parentId);
      await refreshQuietly();
    },
    [refreshQuietly],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      await renameGraphViewFolder(id, name);
      await refreshQuietly();
    },
    [refreshQuietly],
  );

  const moveFolder = useCallback(
    async (id: string, parentId: string | null) => {
      await moveGraphViewFolder(id, parentId);
      await refreshQuietly();
    },
    [refreshQuietly],
  );

  const shareSnapshot = useCallback(async (id: string, username: string) => {
    try {
      await shareGraphSnapshot(id, username);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to share.';
      setErrorMessage(message);
      throw error;
    }
  }, []);

  const shareFolder = useCallback(async (id: string, username: string) => {
    try {
      await shareGraphViewFolder(id, username);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to share.';
      setErrorMessage(message);
      throw error;
    }
  }, []);

  const deleteFolder = useCallback(
    async (id: string) => {
      await deleteGraphViewFolder(id);
      await refreshQuietly();
    },
    [refreshQuietly],
  );

  return {
    snapshots,
    folders,
    status,
    errorMessage,
    setErrorMessage,
    loadSnapshots,
    renameSnapshot,
    deleteSnapshot,
    moveSnapshot,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    shareSnapshot,
    shareFolder,
  };
}
