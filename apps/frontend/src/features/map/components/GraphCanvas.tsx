import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import { useEffect, useRef, useState } from 'react';
import { fetchGraph } from '../api/graphApi';

/**
 * Graphe des applications et dépendances (Cytoscape.js), alimenté par GET /api/graph.
 */
export function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

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
        cyRef.current = cytoscape({
          container: containerRef.current,
          elements,
          style: [
            {
              selector: 'node',
              style: {
                label: 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '11px',
                'font-weight': 'bold',
                color: '#fff',
                'background-color': '#2563eb',
                width: 'label',
                height: 'label',
                padding: '12px',
                'text-wrap': 'wrap',
                'text-max-width': '120px',
                'border-width': 2,
                'border-color': '#1e40af',
              },
            },
            {
              selector: 'edge',
              style: {
                width: 2,
                'line-color': '#94a3b8',
                'target-arrow-color': '#94a3b8',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'arrow-scale': 1.2,
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

        setStatus('ready');
        setMessage(
          data.nodes.length === 0
            ? 'Aucun nœud pour cette date. Démarrez le backend avec Neo4j pour charger les données de démo.'
            : null
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
  }, []);

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
      <div
        ref={containerRef}
        className="graph-canvas"
        role="img"
        aria-label="Graphe des dépendances entre applications"
      />
    </div>
  );
}
