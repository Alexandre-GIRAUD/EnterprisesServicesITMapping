import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphNodeFilterDto } from '@/types/api';
import {
  buildColumnCatalog,
  hideColumn,
  loadDisplayColumnIds,
  moveColumnInDisplay,
  reconcileDisplayColumnIds,
  showColumn,
  storeDisplayColumnIds,
  visibleColumns,
  hiddenColumns,
  type TableColumnDef,
  type TableContentKind,
} from '../utils/tableColumns';

export function useTableColumns(table: TableContentKind, filters: GraphNodeFilterDto[]) {
  const catalog = useMemo(() => buildColumnCatalog(table, filters), [table, filters]);
  const tableRef = useRef(table);

  const [displayIds, setDisplayIds] = useState<string[]>(() =>
    reconcileDisplayColumnIds(catalog, loadDisplayColumnIds(table))
  );

  useEffect(() => {
    if (tableRef.current !== table) {
      tableRef.current = table;
      setDisplayIds(reconcileDisplayColumnIds(catalog, loadDisplayColumnIds(table)));
      return;
    }
    setDisplayIds((prev) => reconcileDisplayColumnIds(catalog, prev));
  }, [catalog, table]);

  useEffect(() => {
    storeDisplayColumnIds(table, displayIds);
  }, [table, displayIds]);

  const displayed = useMemo(
    () => visibleColumns(catalog, displayIds),
    [catalog, displayIds]
  );
  const hidden = useMemo(() => hiddenColumns(catalog, displayIds), [catalog, displayIds]);

  const hide = useCallback((columnId: string) => {
    setDisplayIds((prev) => hideColumn(prev, columnId));
  }, []);

  const show = useCallback(
    (columnId: string) => {
      setDisplayIds((prev) => showColumn(prev, catalog, columnId));
    },
    [catalog]
  );

  const showAt = useCallback(
    (columnId: string, toIndex: number) => {
      setDisplayIds((prev) =>
        moveColumnInDisplay(showColumn(prev, catalog, columnId), columnId, toIndex)
      );
    },
    [catalog]
  );

  const moveInDisplay = useCallback((columnId: string, toIndex: number) => {
    setDisplayIds((prev) => moveColumnInDisplay(prev, columnId, toIndex));
  }, []);

  return {
    catalog,
    displayIds,
    displayed,
    hidden,
    hide,
    show,
    showAt,
    moveInDisplay,
  };
}

export type { TableColumnDef };
