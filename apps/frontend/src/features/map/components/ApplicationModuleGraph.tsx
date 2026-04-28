import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import { useEffect, useRef, useState } from 'react';
import { fetchModuleGraph } from '../api/graphApi';

type Props = {
  applicationId: string;
};

/**
 * Second Cytoscape instance: module tree under one Application (GET …/module-graph).
 */
export function ApplicationModuleGraph({ applicationId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus('loading');
      setMessage(null);
      try {
        const data = await fetchModuleGraph(applicationId);
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
        cyRef.current = cytoscape({
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
                'background-color': '#111827',
                width: 'label',
                height: 'label',
                'min-width': '112px',
                'min-height': '40px',
                padding: '14px',
                'text-wrap': 'wrap',
                'text-max-width': '140px',
                'border-width': '1.5px',
                'border-color': '#334155',
                'border-opacity': 1,
              },
            },
            {
              selector: 'node[nodeType = "Application"]',
              style: {
                'background-color': '#0a0a0a',
                'border-width': '2px',
                'border-color': '#38bdf8',
                'border-opacity': 0.95,
              },
            },
            {
              selector: 'node[nodeType = "Module"]',
              style: {
                'border-color': '#52525b',
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
            spacingFactor: 1.4,
            padding: 40,
          },
          wheelSensitivity: 0.35,
          minZoom: 0.25,
          maxZoom: 2.5,
        });

        setStatus('ready');
        setMessage(
          data.nodes.length <= 1 && data.edges.length === 0
            ? 'Aucun module lié à cette application pour l’instant (racine seule).'
            : null
        );
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          let msg = e instanceof Error ? e.message : 'Impossible de charger le graphe modules';
          if (msg.includes('404')) {
            msg =
              'Application introuvable ou inactive à cette date (404). Vérifiez l’identifiant ou revenez à la carte.';
          }
          if (msg === 'Failed to fetch') {
            msg +=
              ' — backend injoignable. Vérifiez VITE_API_PROXY_TARGET ou VITE_API_BASE_URL.';
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
  }, [applicationId]);

  return (
    <div className="graph-canvas-wrap">
      {status === 'loading' && (
        <p className="graph-canvas-status" role="status">
          Chargement des modules…
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
      <div
        ref={containerRef}
        className="graph-canvas module-graph-canvas"
        role="img"
        aria-label="Graphe des modules de l’application"
      />
    </div>
  );
}
