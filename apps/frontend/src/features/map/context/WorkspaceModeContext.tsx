import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { GraphMode } from '../components/GraphModeTabs';

type WorkspaceModeState = {
  mode: GraphMode;
  sandboxDirty: boolean;
  setMode: (mode: GraphMode) => void;
  setSandboxDirty: (dirty: boolean) => void;
};

const WorkspaceModeContext = createContext<WorkspaceModeState | null>(null);

export function WorkspaceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<GraphMode>('normal');
  const [sandboxDirty, setSandboxDirty] = useState(false);
  const value = useMemo(
    () => ({ mode, sandboxDirty, setMode, setSandboxDirty }),
    [mode, sandboxDirty],
  );
  return <WorkspaceModeContext.Provider value={value}>{children}</WorkspaceModeContext.Provider>;
}

export function useWorkspaceMode(): WorkspaceModeState {
  const value = useContext(WorkspaceModeContext);
  if (!value) {
    return {
      mode: 'normal',
      sandboxDirty: false,
      setMode: () => undefined,
      setSandboxDirty: () => undefined,
    };
  }
  return value;
}
