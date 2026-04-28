import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApplicationResponse, GraphEdgeCreateResponse } from '@/types/api';
import { fetchGraph } from '../api/graphApi';
import { WorkspaceDrawer } from './WorkspaceDrawer';
import { ApplicationDetailsDrawer } from './ApplicationDetailsDrawer';

type SelectedApplication = {
  id: string;
  label: string;
};

/**
 * Graphe des applications et dépendances (Cytoscape.js), alimenté par GET /api/graph.
 */
export function GraphCanvas() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<SelectedApplication | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchGraph();
        if (cancelled || !containerRef.current) return;

        const elements: ElementDefinition[] = [
          ...data.nodes.map((n) => ({
            data: {
              id: n.id,
              label: n.label,
              nodeType: n.type,
            },
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

        const openDetailsForNode = (evt: cytoscape.EventObject) => {
          const n = evt.target;
          if (n.nonempty() && n.data('nodeType') === 'Application') {
            setSelectedApplication({
              id: n.id(),
              label: (n.data('label') as string | undefined) ?? n.id(),
            });
            setIsDetailsDrawerOpen(true);
            setIsDrawerOpen(false);
          }
        };

        const navigateToModuleMap = (evt: cytoscape.EventObject) => {
          const n = evt.target;
          if (n.nonempty() && n.data('nodeType') === 'Application') {
            navigate(`/map/apps/${encodeURIComponent(n.id())}`);
          }
        };

        cy.on('tap', 'node', openDetailsForNode);
        cy.on('dbltap', 'node', navigateToModuleMap);
        cy.on('dblclick', 'node', navigateToModuleMap);

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

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDetailsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);

    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
      window.removeEventListener('keydown', onEscape);
    };
  }, [navigate]);

  function handleNodeCreated(created: ApplicationResponse) {
    const cy = cyRef.current;
    if (!cy) return;
    if (cy.getElementById(created.id).nonempty()) return;

    const viewport = cy.extent();
    const centerX = (viewport.x1 + viewport.x2) / 2;
    const centerY = (viewport.y1 + viewport.y2) / 2;
    const jitterX = Math.random() * 24 - 12;
    const jitterY = Math.random() * 24 - 12;

    cy.add({
      data: {
        id: created.id,
        label: created.name,
        nodeType: 'Application',
      },
      position: {
        x: centerX + jitterX,
        y: centerY + jitterY,
      },
    });
  }

  function handleEdgeCreated(created: GraphEdgeCreateResponse): string | null {
    const cy = cyRef.current;
    if (!cy) return 'Graphe non initialisé.';
    if (cy.getElementById(created.id).nonempty()) return null;
    if (cy.getElementById(created.sourceId).empty() || cy.getElementById(created.targetId).empty()) {
      return 'Edge créé mais source/target absent du graphe affiché.';
    }

    cy.add({
      data: {
        id: created.id,
        source: created.sourceId,
        target: created.targetId,
        label: created.type,
      },
    });
    return null;
  }

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

          <button
            type="button"
            className={`graph-details-overlay${isDetailsDrawerOpen ? ' is-visible' : ''}`}
            aria-label="Fermer le panneau de détails"
            onClick={() => setIsDetailsDrawerOpen(false)}
          />
          <ApplicationDetailsDrawer
            isOpen={isDetailsDrawerOpen}
            application={selectedApplication}
            onClose={() => setIsDetailsDrawerOpen(false)}
            onOpenModuleGraph={(applicationId) => {
              navigate(`/map/apps/${encodeURIComponent(applicationId)}`);
            }}
          />
        </div>

        <button
          type="button"
          className={`graph-drawer-overlay${isDrawerOpen ? ' is-visible' : ''}`}
          aria-label="Fermer le drawer"
          onClick={() => setIsDrawerOpen(false)}
        />
        <WorkspaceDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onNodeCreated={handleNodeCreated}
          onEdgeCreated={handleEdgeCreated}
        />
      </div>
    </div>
  );
}
