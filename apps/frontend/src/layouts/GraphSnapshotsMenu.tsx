import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteGraphSnapshot, listGraphSnapshots } from '@/features/map/api/graphSnapshotsApi';
import { useGraphSnapshotsRefresh } from '@/features/map/context/GraphSnapshotsContext';
import { navigateToMapWithSnapshot } from '@/features/map/utils/mapNavigation';
import type { GraphSnapshotDto } from '@/types/api';

export function GraphSnapshotsMenu() {
  const navigate = useNavigate();
  const { version } = useGraphSnapshotsRefresh();
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<GraphSnapshotDto[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadSnapshots = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await listGraphSnapshots();
      setSnapshots(data);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Impossible de charger les vues.');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadSnapshots();
  }, [isOpen, version, loadSnapshots]);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Supprimer la vue « ${name} » ?`)) return;
    try {
      await deleteGraphSnapshot(id);
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Suppression impossible.');
    }
  }

  function handleApply(snapshot: GraphSnapshotDto) {
    setIsOpen(false);
    navigateToMapWithSnapshot(navigate, snapshot.filters);
  }

  return (
    <div className="layout-snapshots-menu" ref={menuRef}>
      <button
        type="button"
        className="layout-snapshots-menu-trigger"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="graph-snapshots-menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        Mes vues
        <span className="layout-snapshots-menu-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {isOpen ? (
        <div id="graph-snapshots-menu" className="layout-snapshots-menu-panel" role="menu">
          {status === 'loading' ? (
            <p className="layout-snapshots-menu-empty">Chargement…</p>
          ) : status === 'error' ? (
            <p className="layout-snapshots-menu-error">{errorMessage}</p>
          ) : snapshots.length === 0 ? (
            <p className="layout-snapshots-menu-empty">Aucune vue enregistrée</p>
          ) : (
            <ul className="layout-snapshots-menu-list">
              {snapshots.map((snapshot) => (
                <li key={snapshot.id} className="layout-snapshots-menu-item">
                  <button
                    type="button"
                    className="layout-snapshots-menu-item-btn"
                    role="menuitem"
                    onClick={() => handleApply(snapshot)}
                  >
                    {snapshot.name}
                  </button>
                  <button
                    type="button"
                    className="layout-snapshots-menu-delete"
                    aria-label={`Supprimer ${snapshot.name}`}
                    onClick={() => void handleDelete(snapshot.id, snapshot.name)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
