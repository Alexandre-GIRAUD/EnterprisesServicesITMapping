import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGraph } from '../api/graphApi';

/**
 * Graphe des applications et dépendances (Cytoscape.js), alimenté par GET /api/graph.
 */
export function GraphCanvas() {
  const drawerActions = ['Add Node', 'Add Edge', 'Add Module', 'Settings'];
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchGraph();
        if (cancelled || !containerRef.current) return;

        const elements: ElementDefinition[] = [
          ...data.nodes.map((n) => ({
            data: { id: n.id, label: n.label, nodeType: n.type },
          })),
          ...data.edges.map((e) => ({
            data: {
              id: e.id,
              source: e.sourceId,
              target: e.targetId,
              label: e.type,
            },
          })),
        ];

        cyRef.current?.destroy();
        const cy = cytoscape({
          container: containerRef.current,
          elements,
          style: [
            {
              selector: 'node',
              style: {
                shape: 'round-rectangle',
                label: 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '12px',
                'font-weight': 600,
                color: '#f8fafc',
                'text-outline-width': 0,
                'background-color': '#0a0a0a',
                width: 'label',
                height: 'label',
                'min-width': '112px',
                'min-height': '40px',
                padding: '14px',
                'text-wrap': 'wrap',
                'text-max-width': '140px',
                'border-width': '1.5px',
                'border-color': '#3b82f6',
                'border-opacity': 0.9,
                opacity: 1,
              },
            },
            {
              selector: 'node:active',
              style: {
                'border-color': '#60a5fa',
                'border-width': '2.5px',
              },
            },
            {
              selector: 'edge',
              style: {
                width: '1.5px',
                'line-color': '#94a3b8',
                'line-opacity': 0.9,
                'target-arrow-color': '#94a3b8',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'arrow-scale': 1.1,
                label: 'data(label)',
                'font-size': '9px',
                color: '#64748b',
              },
            },
          ],
          layout: {
            name: 'breadthfirst',
            directed: true,
            spacingFactor: 1.35,
            padding: 40,
          },
          wheelSensitivity: 0.35,
          minZoom: 0.25,
          maxZoom: 2.5,
        });
        cyRef.current = cy;

        cy.on('tap', 'node', (evt) => {
          const n = evt.target;
          if (n.nonempty() && n.data('nodeType') === 'Application') {
            navigate(`/map/apps/${encodeURIComponent(n.id())}`);
          }
        });

        setStatus('ready');
        setMessage(
          data.nodes.length === 0
            ? 'Aucun nœud pour cette date. Démarrez le backend avec Neo4j pour charger les données de démo.'
            : 'Astuce : cliquez sur une application pour ouvrir le graphe de ses modules.'
        );
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          let msg = e instanceof Error ? e.message : 'Impossible de charger le graphe';
          if (msg === 'Failed to fetch') {
            msg +=
              ' — le backend est injoignable. En dev Vite, vérifiez VITE_API_PROXY_TARGET (ex. 8081 avec Docker) ou lancez Spring Boot sur le port attendu.';
          }
          setMessage(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [navigate]);

  return (
    <div className="graph-canvas-wrap">
      {status === 'loading' && (
        <p className="graph-canvas-status" role="status">
          Chargement du graphe…
        </p>
      )}
      {status === 'error' && message && (
        <p className="graph-canvas-error" role="alert">
          {message}
        </p>
      )}
      {status === 'ready' && message && (
        <p className="graph-canvas-hint">{message}</p>
      )}
      <div className={`graph-workspace${isDrawerOpen ? ' is-drawer-open' : ''}`}>
        <div className="graph-stage">
          <button
            type="button"
            className="graph-drawer-toggle"
            onClick={() => setIsDrawerOpen((open) => !open)}
            aria-expanded={isDrawerOpen}
            aria-controls="graph-actions-drawer"
          >
            <span className="graph-drawer-toggle-label">Workspace</span>
            <span className="graph-drawer-toggle-icon" aria-hidden="true">
              {isDrawerOpen ? 'Close' : 'Open'}
            </span>
          </button>

          <div
            ref={containerRef}
            className="graph-canvas"
            role="img"
            aria-label="Graphe des dépendances entre applications"
          />
        </div>

        <button
          type="button"
          className={`graph-drawer-overlay${isDrawerOpen ? ' is-visible' : ''}`}
          aria-label="Fermer le drawer"
          onClick={() => setIsDrawerOpen(false)}
        />

        <aside
          id="graph-actions-drawer"
          className={`graph-drawer${isDrawerOpen ? ' is-open' : ''}`}
          aria-label="Panneau latéral des actions"
        >
          <header className="graph-drawer-header">
            <p className="graph-drawer-eyebrow">Workspace</p>
            <div className="graph-drawer-title-row">
              <div>
                <h2 className="graph-drawer-title">Actions</h2>
                <p className="graph-drawer-description">
                  Préparez vos prochaines opérations depuis un panneau latéral sobre et moderne.
                </p>
              </div>
              <button
                type="button"
                className="graph-drawer-close"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Fermer le panneau"
              >
                x
              </button>
            </div>
          </header>

          <div className="graph-drawer-actions" role="list">
            {drawerActions.map((action) => (
              <button key={action} type="button" className="graph-drawer-action" role="listitem">
                <span className="graph-drawer-action-title">{action}</span>
                <span className="graph-drawer-action-meta">Soon</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
