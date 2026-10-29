import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react';
import type { ApplicationResponse, GraphEdgeCreateResponse, GraphEdgeDto, GraphNodeFilterDto, StoredAttribute } from '@/types/api';
import { shareSavedSandbox } from '../api/sandboxSharesApi';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { useSandboxes } from '../hooks/useSandboxes';
import { MAX_OPEN_SANDBOXES, type SandboxDocFilters } from '../utils/sandboxDocuments';
import type { ApplicationUpdatePatch } from './ApplicationDetailsDrawer';
import { ApplicationDetailsDrawer } from './ApplicationDetailsDrawer';
import { ApplicationSearchBar } from './ApplicationSearchBar';
import { EdgeDetailsDrawer } from './EdgeDetailsDrawer';
import { FilterDrawer } from './FilterDrawer';
import type { GraphMode } from './GraphModeTabs';
import { SandboxesPanel } from './SandboxesPanel';
import type { SelectedEdgeDetails } from '../utils/selectedEdgeFromDto';
import { CartographyChatHistory } from './CartographyChatHistory';
import type { SideMenuTool } from './SelfServiceToolBar';
import type { CartographyChatTurn } from '../utils/mapNavigation';
import { WorkspaceDrawer } from './WorkspaceDrawer';

type GraphCanvasSideToolInput = {
  graphMode: GraphMode;
  activeSideMenuTool: SideMenuTool;
  isSandbox: boolean;
  sandboxes: ReturnType<typeof useSandboxes>;
  applications: ApplicationResponse[];
  nodeFilters: GraphNodeFilterDto[];
  applicationIds: string[];
  nodeAttributes: Record<string, string[]>;
  nodeRefs: Record<string, string[]>;
  edgeAttributes: Record<string, string[]>;
  edgeIds: string[];
  matchNothing: boolean;
  blankedDimensions: string[];
  graphEdges: GraphEdgeDto[];
  filters: ReturnType<typeof useGraphFilters>;
  graphAppsForDrawer: ApplicationResponse[];
  onNodeCreatedHandler: (created: ApplicationResponse) => void;
  onEdgeCreatedHandler: (created: GraphEdgeCreateResponse) => string | null;
  noopClose: () => void;
  status: 'loading' | 'ready' | 'error';
  setIsSaveSnapshotOpen: Dispatch<SetStateAction<boolean>>;
  setSandboxToast: Dispatch<SetStateAction<string | null>>;
  setTextPlacement: Dispatch<SetStateAction<boolean>>;
  rememberSandboxIcon: (iconKey: string) => void;
  setIconGhostPos: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setIconPlacement: Dispatch<SetStateAction<{ iconKey: string; sticky: boolean } | null>>;
  toolkitRequest: 'add-node-form' | 'add-edge-form' | null;
  setToolkitRequest: Dispatch<SetStateAction<'add-node-form' | 'add-edge-form' | null>>;
  menuEditKind: 'application' | 'flow' | null;
  selectedApplication: { id: string; label: string } | null;
  selectedEdge: SelectedEdgeDetails | null;
  closeApplicationDetails: () => void;
  openApplicationDetails: (id: string, label: string, isFromMenu?: boolean) => void;
  closeEdgeDetails: () => void;
  setMenuEditKind: Dispatch<SetStateAction<'application' | 'flow' | null>>;
  openEdgeByIdRef: MutableRefObject<(edgeId: string) => void>;
  resolveSandboxApplication: (id: string) => ApplicationResponse | null;
  handleApplicationUpdated: (applicationId: string, patch: ApplicationUpdatePatch) => void;
  openModuleGraphById: (applicationId: string, label: string) => void;
  onApplicationDeletedHandler: (applicationId: string) => void;
  handleEdgeAttributesUpdated: (edgeId: string, properties: Record<string, StoredAttribute>) => void;
  handleEdgeDeleted: (edgeId: string) => void;
  activeSandboxFilters: SandboxDocFilters;
  sandboxSeed: () => Parameters<ReturnType<typeof useSandboxes>['openNew']>[0];
  isReadOnly: boolean;
  chatTurns: CartographyChatTurn[];
  onChatTurnsChange: (turns: CartographyChatTurn[]) => void;
};

export function renderGraphCanvasSideTool(input: GraphCanvasSideToolInput): ReactNode {
  const {
    graphMode,
    activeSideMenuTool,
    isSandbox,
    sandboxes,
    applications,
    nodeFilters,
    applicationIds,
    nodeAttributes,
    nodeRefs,
    edgeAttributes,
    edgeIds,
    matchNothing,
    blankedDimensions,
    graphEdges,
    filters,
    graphAppsForDrawer,
    onNodeCreatedHandler,
    onEdgeCreatedHandler,
    noopClose,
    status,
    setIsSaveSnapshotOpen,
    setSandboxToast,
    setTextPlacement,
    rememberSandboxIcon,
    setIconGhostPos,
    setIconPlacement,
    toolkitRequest,
    setToolkitRequest,
    menuEditKind,
    selectedApplication,
    selectedEdge,
    closeApplicationDetails,
    openApplicationDetails,
    closeEdgeDetails,
    setMenuEditKind,
    openEdgeByIdRef,
    resolveSandboxApplication,
    handleApplicationUpdated,
    openModuleGraphById,
    onApplicationDeletedHandler,
    handleEdgeAttributesUpdated,
    handleEdgeDeleted,
    activeSandboxFilters,
    sandboxSeed,
    isReadOnly,
    chatTurns,
    onChatTurnsChange,
  } = input;

    if (graphMode !== 'normal' && graphMode !== 'sandbox') return null;

    const isExplorer = graphMode === 'normal';

    switch (activeSideMenuTool) {
      case 'changes':
        return null;
      case 'chat':
        return (
          <CartographyChatHistory
            turns={chatTurns}
            onTurnsChange={onChatTurnsChange}
            currentFilters={{
              applicationIds,
              nodeAttributes,
              nodeRefs,
              edgeAttributes,
            }}
            onApplyFilters={filters.applyGraphFilters}
          />
        );
      case 'filters':
        return (
          <>
            {isSandbox ? <ApplicationSearchBar variant="menu" /> : null}
            <FilterDrawer
            key={
              isSandbox
                ? `filters-sandbox-${sandboxes.activeDoc?.id ?? 'none'}`
                : `filters-${graphMode}`
            }
            variant="embedded"
            isOpen
            onClose={noopClose}
            applications={applications}
            nodeFilters={nodeFilters}
            initialApplicationIds={
              isSandbox ? activeSandboxFilters.applicationIds : applicationIds
            }
            initialNodeAttributes={
              isSandbox ? activeSandboxFilters.nodeAttributes : nodeAttributes
            }
            initialNodeRefs={isSandbox ? activeSandboxFilters.nodeRefs : nodeRefs}
            initialEdgeAttributes={isSandbox ? activeSandboxFilters.edgeAttributes ?? {} : edgeAttributes}
            initialEdgeIds={isSandbox ? activeSandboxFilters.edgeIds ?? [] : edgeIds}
            initialMatchNothing={isSandbox ? Boolean(activeSandboxFilters.matchNothing) : matchNothing}
            initialBlankedDimensions={
              isSandbox ? activeSandboxFilters.blankedDimensions ?? [] : blankedDimensions
            }
            edges={graphEdges}
            onApply={({
              applicationIds: appIds,
              nodeAttributes: attrs,
              nodeRefs: refs,
              edgeAttributes: edgeAttrs,
              edgeIds: nextEdgeIds,
              matchNothing: nextMatchNothing,
              blankedDimensions: nextBlanked,
            }) => {
              if (isSandbox) {
                const id = sandboxes.activeId ?? sandboxes.activeDoc?.id;
                if (!id) return;
                sandboxes.patchDoc(id, {
                  filters: {
                    applicationIds: appIds,
                    nodeAttributes: attrs,
                    nodeRefs: refs,
                    edgeAttributes: edgeAttrs ?? {},
                    edgeIds: nextEdgeIds ?? [],
                    matchNothing: Boolean(nextMatchNothing),
                    blankedDimensions: nextBlanked ?? [],
                  },
                  dirty: true,
                });
                return;
              }
              filters.setApplicationIds(appIds);
              filters.setNodeAttributes(attrs);
              filters.setNodeRefs(refs);
              filters.setEdgeAttributes(edgeAttrs ?? {});
              filters.setEdgeIds(nextEdgeIds ?? []);
              filters.setMatchNothing(Boolean(nextMatchNothing));
              filters.setBlankedDimensions(nextBlanked ?? []);
            }}
            showPinView={isExplorer && !isReadOnly}
            pinViewDisabled={status !== 'ready'}
            onPinView={() => setIsSaveSnapshotOpen(true)}
          />
          </>
        );
      case 'actions':
        return (
          <WorkspaceDrawer
            key={`workspace-${graphMode}`}
            variant="embedded"
            isOpen
            onClose={noopClose}
            sandboxMode={isSandbox}
            extraApplications={graphAppsForDrawer}
            onNodeCreated={onNodeCreatedHandler}
            onEdgeCreated={onEdgeCreatedHandler}
            onPickIcon={(iconKey, sticky) => {
              if (sandboxes.openDocs.length === 0) {
                setSandboxToast('Open a sandbox to place an icon.');
                return;
              }
              setTextPlacement(false);
              rememberSandboxIcon(iconKey);
              setIconGhostPos({ x: 0, y: 0 });
              setIconPlacement({ iconKey, sticky });
            }}
            onClearIconPlacement={() => setIconPlacement(null)}
            onStartTextPlacement={() => {
              if (sandboxes.openDocs.length === 0) {
                setSandboxToast('Open a sandbox to place text.');
                return;
              }
              setIconPlacement(null);
              setTextPlacement(true);
              setIconGhostPos({ x: 0, y: 0 });
            }}
            requestedView={toolkitRequest}
            onRequestedViewConsumed={() => setToolkitRequest(null)}
            applications={applications}
            flows={graphEdges.map((edge) => {
              const readFlowEndName = (endpointId: string) =>
                applications.find((application) => application.id === endpointId)?.name ?? endpointId;
              const data = edge.data?.trim();
              const base = `${readFlowEndName(edge.sourceId)} → ${readFlowEndName(edge.targetId)}`;
              return { id: edge.id, label: data ? `${base} (${data})` : base };
            })}
            onEditApplication={(id) => {
              if (!id) {
                closeApplicationDetails();
                return;
              }
              const application = applications.find((item) => item.id === id);
              openApplicationDetails(id, application?.name?.trim() || id, true);
            }}
            onEditFlow={(id) => {
              if (!id) {
                closeEdgeDetails();
                setMenuEditKind(null);
                return;
              }
              openEdgeByIdRef.current(id);
              setMenuEditKind('flow');
            }}
            editPanel={
              menuEditKind === 'application' && selectedApplication ? (
                <ApplicationDetailsDrawer
                  isEmbedded
                  shouldOpenInEditMode
                  isOpen
                  application={selectedApplication}
                  onClose={closeApplicationDetails}
                  sandboxMode={isSandbox}
                  resolveSandboxApplication={resolveSandboxApplication}
                  onApplicationUpdated={handleApplicationUpdated}
                  onOpenModuleGraph={(applicationId) => {
                    openModuleGraphById(applicationId, selectedApplication.label);
                  }}
                  onApplicationDeleted={onApplicationDeletedHandler}
                />
              ) : menuEditKind === 'flow' && selectedEdge ? (
                <EdgeDetailsDrawer
                  isEmbedded
                  shouldOpenInEditMode
                  isOpen
                  edge={selectedEdge}
                  onClose={closeEdgeDetails}
                  onOpenApplication={(id, label) => openApplicationDetails(id, label, true)}
                  onEdgeAttributesUpdated={handleEdgeAttributesUpdated}
                  onEdgeDeleted={handleEdgeDeleted}
                />
              ) : null
            }
          />
        );
      case 'sandboxes':
        if (!isSandbox) return null;
        return (
          <SandboxesPanel
            openSandboxes={sandboxes.openDocs.map((doc) => ({
              id: doc.id,
              name: doc.name,
              dirty: doc.dirty,
            }))}
            activeSandboxId={sandboxes.activeId}
            onFocusOpen={sandboxes.setActiveId}
            layoutMode={sandboxes.layout}
            onLayoutModeChange={sandboxes.setLayout}
            onNewSandbox={() => {
              if (sandboxes.openDocs.length >= MAX_OPEN_SANDBOXES) {
                setSandboxToast('Close at least one sandbox before opening another.');
                return;
              }
              const id = sandboxes.openNew(sandboxSeed());
              if (!id) setSandboxToast('Close at least one sandbox before opening another.');
            }}
            onSaveSandbox={(id) => {
              const doc = sandboxes.openDocs.find((item) => item.id === id);
              if (!doc) return;
              sandboxes.saveDoc(doc.id, doc.name);
              setSandboxToast('Saved');
            }}
            onDuplicateSandbox={(id) => {
              if (!sandboxes.duplicateDoc(id)) {
                setSandboxToast('Close at least one sandbox before opening another.');
              }
            }}
            onCloseSandbox={sandboxes.closeDoc}
            savedSandboxes={sandboxes.saved}
            sandboxFolders={sandboxes.sandboxFolders}
            onLoadSandbox={(id) => {
              const result = sandboxes.loadSaved(id);
              if (result === 'full') {
                setSandboxToast('Close at least one sandbox before loading another.');
              }
            }}
            onDeleteSavedSandbox={sandboxes.deleteSaved}
            onCreateSandboxFolder={sandboxes.createSandboxFolder}
            onRenameSandboxFolder={sandboxes.renameSandboxFolder}
            onDeleteSandboxFolder={sandboxes.deleteSandboxFolder}
            onMoveSandboxFolder={sandboxes.moveSandboxFolder}
            onRenameSavedSandbox={sandboxes.renameSavedSandbox}
            onMoveSavedSandbox={sandboxes.moveSavedSandbox}
            onRenameOpenSandbox={(id, name) => sandboxes.patchDoc(id, { name, dirty: true })}
            onDuplicateSavedSandbox={sandboxes.duplicateSaved}
            onShareSandbox={async (id, username) => {
              const open = sandboxes.openDocs.find((item) => item.id === id);
              const savedSandbox = sandboxes.saved.find((item) => item.id === id);
              const sandboxDocument = open ?? savedSandbox?.document;
              if (!sandboxDocument) return;
              try {
                await shareSavedSandbox(username, open?.name ?? savedSandbox?.name ?? sandboxDocument.name, sandboxDocument);
                setSandboxToast(`Shared with ${username}.`);
              } catch (error) {
                setSandboxToast(error instanceof Error ? error.message : 'Unable to share.');
              }
            }}
          />
        );
      default:
        return null;
    }
}
