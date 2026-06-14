import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type GraphSnapshotsContextValue = {
  version: number;
  refreshSnapshots: () => void;
};

const GraphSnapshotsContext = createContext<GraphSnapshotsContextValue | null>(null);

export function GraphSnapshotsProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const refreshSnapshots = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({ version, refreshSnapshots }),
    [version, refreshSnapshots]
  );

  return (
    <GraphSnapshotsContext.Provider value={value}>{children}</GraphSnapshotsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- companion hook to provider
export function useGraphSnapshotsRefresh(): GraphSnapshotsContextValue {
  const ctx = useContext(GraphSnapshotsContext);
  if (!ctx) {
    return { version: 0, refreshSnapshots: () => {} };
  }
  return ctx;
}
