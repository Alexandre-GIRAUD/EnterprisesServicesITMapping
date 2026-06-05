import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ApplicationResponse,
  BusinessUnitListItem,
  GraphEdgeCreateResponse,
  GraphNodeDto,
  RegionSummary,
} from '@/types/api';
import { fetchApplications } from '../api/applicationsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { fetchRegions } from '../api/regionsApi';
import { fetchGraph } from '../api/graphApi';
import { WorkspaceDrawer } from './WorkspaceDrawer';
import { FilterDrawer } from './FilterDrawer';
import { ApplicationDetailsDrawer } from './ApplicationDetailsDrawer';
import { ApplicationsTablePanel } from './ApplicationsTablePanel';

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
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [graphNodes, setGraphNodes] = useState<GraphNodeDto[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<SelectedApplication | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitListItem[]>([]);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [applicationIds, setApplicationIds] = useState<string[]>([]);
  const [businessUnitIds, setBusinessUnitIds] = useState<string[]>([]);
  const [regionCodes, setRegionCodes] = useState<string[]>([]);
  const filtersActive =
    applicationIds.length > 0 || businessUnitIds.length > 0 || regionCodes.length > 0;

  const openApplicationDetails = useCallback((id: string, label: string) => {
    setSelectedApplication({ id, label });
    setIsDetailsDrawerOpen(true);
    setIsDrawerOpen(false);
  }, []);

  const refreshApplications = useCallback(async () => {
    try {
      const rows = await fetchApplications();
      setApplications(rows);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshBusinessUnits = useCallback(async () => {
    try {
      const rows = await fetchBusinessUnits();
      setBusinessUnits(rows);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshRegions = useCallback(async () => {
    try {
      const rows = await fetchRegions();
      setRegions(rows);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshApplications();
    void refreshBusinessUnits();
    void refreshRegions();
  }, [refreshApplications, refreshBusinessUnits, refreshRegions]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus('loading');
        setMessage(null);
        const data = await fetchGraph({
          applicationIds: applicationIds.length > 0 ? applicationIds : undefined,
          businessUnitIds: businessUnitIds.length > 0 ? businessUnitIds : undefined,
          regionCodes: regionCodes.length > 0 ? regionCodes : undefined,
        });
        if (cancelled || !containerRef.current) return;

        setGraphNodes(data.nodes);

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
            openApplicationDetails(
              n.id(),
              (n.data('label') as string | undefined) ?? n.id()
            );
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
        const emptyHint =
          data.nodes.length === 0
            ? filtersActive
              ? 'Aucune application pour ces filtres (business unit / location). Décochez tout ou changez de critères.'
              : 'Aucun nœud pour cette date. Démarrez le backend avec Neo4j pour charger les données de démo.'
            : 'Astuce : cliquez sur une application pour ouvrir le graphe de ses modules.';
        setMessage(emptyHint);
      } catch (e) {
        if (!cancelled) {
          setGraphNodes([]);
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
  }, [navigate, applicationIds, businessUnitIds, regionCodes, filtersActive, openApplicationDetails]);

  /** Keep Cytoscape sized to its flex container (viewport / drawer / responsive). */
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

  function handleNodeCreated(created: ApplicationResponse) {
    const cy = cyRef.current;
    if (!cy) return;
    if (cy.getElementById(created.id).nonempty()) return;

    setGraphNodes((prev) => {
      if (prev.some((n) => n.id === created.id)) return prev;
      return [
        ...prev,
        {
          id: created.id,
          label: created.name,
          type: 'Application',
          temporal: {
            validFrom: created.validFrom,
            validTo: created.validTo,
          },
          description: created.description ?? null,
        },
      ];
    });

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

  /** Remove application node + incident edges from Cytoscape after successful API delete */
  function handleApplicationDeleted(applicationId: string) {
    const cy = cyRef.current;
    if (!cy) return;
    const node = cy.getElementById(applicationId);
    if (node.nonempty() && node.isNode()) {
      cy.remove(node);
    }
    setGraphNodes((prev) => prev.filter((n) => n.id !== applicationId));
    setSelectedApplication(null);
    setIsDetailsDrawerOpen(false);
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
          <button
            type="button"
            className="graph-filter-toggle"
            onClick={() => setIsFilterDrawerOpen((open) => !open)}
            aria-expanded={isFilterDrawerOpen}
            aria-controls="graph-filter-drawer"
          >
            <span className="graph-drawer-toggle-label">Filtres</span>
            <span className="graph-drawer-toggle-icon" aria-hidden="true">
              {filtersActive ? 'On' : 'Off'}
            </span>
          </button>

          <button
            type="button"
            className={`graph-details-overlay${isFilterDrawerOpen ? ' is-visible' : ''}`}
            aria-label="Fermer les filtres"
            onClick={() => setIsFilterDrawerOpen(false)}
          />
          <FilterDrawer
            isOpen={isFilterDrawerOpen}
            onClose={() => setIsFilterDrawerOpen(false)}
            applications={applications}
            businessUnits={businessUnits}
            regions={regions}
            initialApplicationIds={applicationIds}
            initialBusinessUnitIds={businessUnitIds}
            initialRegionCodes={regionCodes}
            onApply={({ applicationIds: appIds, businessUnitIds: buIds, regionCodes: codes }) => {
              setApplicationIds(appIds);
              setBusinessUnitIds(buIds);
              setRegionCodes(codes);
            }}
          />

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
            onApplicationDeleted={handleApplicationDeleted}
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
          onBusinessUnitsChanged={refreshBusinessUnits}
        />
      </div>

      <div className="graph-table-section">
        <button
          type="button"
          className="graph-table-toggle"
          disabled={status === 'loading'}
          onClick={() => setIsTableOpen((open) => !open)}
          aria-expanded={isTableOpen}
          aria-controls="graph-applications-table-panel"
        >
          <span className="graph-table-toggle-icon" aria-hidden="true">
            ⊞
          </span>
          <span>Table</span>
          <span className="graph-table-toggle-count" aria-hidden="true">
            {graphNodes.filter((n) => n.type === 'Application').length}
          </span>
        </button>
        <ApplicationsTablePanel
          isOpen={isTableOpen}
          status={status}
          nodes={graphNodes}
          applicationsCatalog={applications}
          errorMessage={status === 'error' ? message : null}
          onRowClick={openApplicationDetails}
        />
      </div>
    </div>
  );
}
