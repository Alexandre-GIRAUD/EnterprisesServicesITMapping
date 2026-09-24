# Tickets — table-columns-datamodel

## T1 — Column catalog + display reconcile (pure)
Build `TableColumnDef` catalog from structural columns + `nodeFilters` (NODE/NODE_REF vs EDGE). Reconcile `displayColumnIds` with localStorage defaults (all visible; append new; drop missing).

**Blocks:** T2, T3, T4

## T2 — Apps / Flows table render from catalog
`ApplicationsTablePanel` / `FeedsTablePanel` render only `display` columns; cell values per spec (structural + attrs; NODE_REF labels when refs available).

**Blocked by:** T1

## T3 — Column picker panel
Display / Hidden zones with reorder + move; keyboard Show/Hide/Up/Down; immediate update.

**Blocked by:** T1

## T4 — Burger in table mode = Columns only
When `displayMode === 'table'`, side menu shows Columns picker only (no Filters/Search/…). Restore tools when leaving table.

**Blocked by:** T3
