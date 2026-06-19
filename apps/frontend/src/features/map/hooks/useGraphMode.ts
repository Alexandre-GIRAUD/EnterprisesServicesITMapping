import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { GraphMode } from '../components/GraphModeTabs';

type UseGraphModeParams = {
  setMessage: Dispatch<SetStateAction<string | null>>;
  setIsDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setIsFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setIsDetailsDrawerOpen: Dispatch<SetStateAction<boolean>>;
  /** Forces a fresh graph fetch (used when returning to the normal mode). */
  reloadGraph: () => void;
};

/**
 * Owns the graph view mode (normal / sandbox / views) and the transitions
 * between them. Cross-cutting UI side effects (drawers, status message, graph
 * reload) are injected so the hook stays focused on mode state.
 */
export function useGraphMode({
  setMessage,
  setIsDrawerOpen,
  setIsFilterDrawerOpen,
  setIsDetailsDrawerOpen,
  reloadGraph,
}: UseGraphModeParams) {
  const [graphMode, setGraphMode] = useState<GraphMode>('normal');
  const [sandboxDirty, setSandboxDirty] = useState(false);
  const graphModeRef = useRef(graphMode);
  graphModeRef.current = graphMode;

  const isSandbox = graphMode === 'sandbox';
  const isViewsMode = graphMode === 'views';

  function switchToSandboxMode() {
    setGraphMode('sandbox');
    setSandboxDirty(false);
    setMessage('Impact Sandbox — customize your graph, no changes saved.');
    setIsDrawerOpen(true);
  }

  function switchToViewsMode() {
    if (sandboxDirty && !window.confirm('Leave sandbox? Local changes will be lost.')) {
      return;
    }
    setGraphMode('views');
    setSandboxDirty(false);
    setIsDrawerOpen(false);
    setIsFilterDrawerOpen(false);
    setIsDetailsDrawerOpen(false);
  }

  function switchToNormalMode() {
    if (sandboxDirty && !window.confirm('Leave sandbox? Local changes will be lost.')) {
      return;
    }
    setGraphMode('normal');
    setSandboxDirty(false);
    setIsDrawerOpen(false);
    reloadGraph();
  }

  return {
    graphMode,
    setGraphMode,
    sandboxDirty,
    setSandboxDirty,
    graphModeRef,
    isSandbox,
    isViewsMode,
    switchToSandboxMode,
    switchToViewsMode,
    switchToNormalMode,
  };
}
