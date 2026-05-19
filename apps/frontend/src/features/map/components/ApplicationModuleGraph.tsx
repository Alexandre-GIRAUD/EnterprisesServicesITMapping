import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import nodeHtmlLabel from 'cytoscape-node-html-label';
import { useEffect, useRef, useState } from 'react';
import { fetchModuleGraph } from '../api/graphApi';
import { buildModuleNodeCardHtml, buildNodeHoverHint } from './moduleNodeCardHtml';

nodeHtmlLabel(cytoscape);

type Props = {
  applicationId: string;
};

/**
 * Module tree graph (GET …/module-graph).
 * Card UI uses cytoscape-node-html-label: native Cytoscape labels cannot render
 * separate title weight, hr divider, and smaller description text on one node.
 */
export function ApplicationModuleGraph({ applicationId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [hoverHint, setHoverHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus('loading');
      setMessage(null);
      setHoverHint(null);
      try {
        const data = await fetchModuleGraph(applicationId);
        if (cancelled || !containerRef.current) return;

        const elements: ElementDefinition[] = [
          ...data.nodes.map((n) => {
            const name = n.label?.trim() || n.id;
            const description = n.description?.trim() ?? '';
            const hasDescription = description.length > 0;
            return {
              data: {
                id: n.id,
                name,
                description,
                nodeType: n.type,
                cardSize: hasDescription ? 'tall' : 'short',
              },
            };
          }),
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
                label: '',
                'background-opacity': 0,
                'border-opacity': 0,
                width: 172,
                height: 56,
                padding: '0px',
              },
            },
            {
              selector: 'node[cardSize = "tall"]',
              style: {
                height: 96,
              },
            },
            {
              selector: 'node[nodeType = "Application"]',
              style: {
                width: 184,
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
            spacingFactor: 1.5,
            padding: 48,
          },
          wheelSensitivity: 0.35,
          minZoom: 0.25,
          maxZoom: 2.5,
        });

        type CyWithHtmlLabel = Core & {
          nodeHtmlLabel: (
            configs: Array<{
              query: string;
              tpl: (data: Record<string, unknown>) => string;
              cssClass?: string;
              valign?: string;
              halign?: string;
            }>,
            options?: { enablePointerEvents?: boolean }
          ) => void;
        };
        (cy as unknown as CyWithHtmlLabel).nodeHtmlLabel(
          [
            {
              query: 'node',
              cssClass: 'module-node-html-label',
              valign: 'center',
              halign: 'center',
              tpl: (nodeData: Record<string, unknown>) =>
                buildModuleNodeCardHtml({
                  name: String(nodeData.name ?? ''),
                  description: String(nodeData.description ?? ''),
                  nodeType: String(nodeData.nodeType ?? 'Module'),
                }),
            },
          ],
          { enablePointerEvents: true }
        );

        cy.on('layoutstop', () => {
          cy.fit(undefined, 48);
        });

        cy.on('mouseover', 'node', (evt: cytoscape.EventObject) => {
          const name = String(evt.target.data('name') ?? '');
          const desc = String(evt.target.data('description') ?? '');
          setHoverHint(buildNodeHoverHint(name, desc));
        });

        cy.on('mouseout', 'node', () => {
          setHoverHint(null);
        });

        cyRef.current = cy;

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

  useEffect(() => {
    if (status !== 'ready') return;
    const cy = cyRef.current;
    const el = containerRef.current;
    if (!cy || !el) return;

    const resize = () => {
      cy.resize();
    };
    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    window.addEventListener('resize', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [status]);

  const hintText = hoverHint ?? (status === 'ready' ? message : null);

  return (
    <div className="graph-canvas-wrap module-graph-wrap">
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
      {hintText && status !== 'error' && (
        <p className="graph-canvas-hint module-graph-hint" title={hoverHint ?? undefined}>
          {hintText}
        </p>
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
