/**
 * API request/response DTOs aligned with backend.
 */

/** Graph node as returned by /api/graph and module-graph */
export interface GraphNodeDto {
  id: string;
  label: string;
  type: string;
  /** Present on GET …/module-graph when non-empty (Neo4j description). */
  description?: string | null;
  /** Dynamic business properties of the node (Data Model target=NODE keys); empty on module-graph. */
  properties?: Record<string, string>;
}

/** Graph edge as returned by /api/graph */
export interface GraphEdgeDto {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  /** Human-readable data exchanged on the link (Neo4j `r.data`), when present. */
  data?: string | null;
  /** Colorable relationship properties from Neo4j (excludes temporal fields). */
  properties?: Record<string, string>;
}

export interface GraphEdgeCreateRequest {
  sourceId: string;
  targetId: string;
  type: string;
}

export interface GraphEdgeCreateResponse {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
}

export interface GraphResponseDto {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
}

/** Application CRUD – request body (identity only; business attributes live in the Data Model) */
export interface ApplicationRequest {
  name: string;
  description?: string;
}

/** Application CRUD – response body */
export interface ApplicationResponse {
  id: string;
  name: string;
  description?: string;
  /** True when the app already has modules (CONTAINS); IA suggestion is blocked server-side. */
  hasModuleSubtree?: boolean;
  /**
   * Business attributes stored as flat Application properties, rendered/edited from the Data Model
   * target=NODE fields (GET /applications/{id} only).
   */
  nodeAttributes?: Record<string, string>;
  /**
   * Catalogue classifications via CLASSIFIED_AS (target=NODE_REF): field key → linked refs
   * (GET /applications/{id} only).
   */
  nodeRefs?: Record<string, NodeRefSummary[]>;
}

export type NodeRefSummary = {
  id: string;
  name: string;
  value?: string;
};

/** PATCH /applications/{id}/node-attributes — blank value clears the property. */
export interface ApplicationNodeAttributesPatchRequest {
  attributes: Record<string, string>;
}

/** PATCH /applications/{id}/node-refs — replace CLASSIFIED_AS links by catalogue ref ids. */
export interface ApplicationNodeRefsPatchRequest {
  refs: Record<string, string[]>;
}

/** GitHub repo summary from {@code GET /api/integrations/github/repos} */
export interface GitHubRepoDto {
  id: number;
  fullName: string;
  name: string;
  description?: string;
  htmlUrl: string;
  repoPrivate: boolean;
}

/** {@code POST /api/applications/{id}/modules/suggest-from-github} */
export interface SuggestModulesFromGithubRequest {
  fullName?: string | null;
}

export interface SuggestModulesCreatedItem {
  neo4jModuleId: string;
  slugId: string;
  businessName: string;
}

export interface SuggestModulesSkippedItem {
  scope: string;
  reason: string;
  detail: string;
}

export interface SuggestModulesFromGithubResponse {
  created: SuggestModulesCreatedItem[];
  skipped: SuggestModulesSkippedItem[];
  /** Files whose content was read during the agentic selection loop (traceability). */
  analyzedFiles?: string[];
}

/** {@code POST /api/applications/{id}/connections/suggest-from-github} */
export interface SuggestConnectionsFromGithubRequest {
  fullName?: string | null;
}

/** A materialized DEPENDS_ON edge suggested by the AI connection agent. */
export interface SuggestConnectionsCreatedItem {
  edgeId: string;
  sourceApplicationId: string;
  targetApplicationId: string;
  peerName: string;
  /** Analyzed-app perspective: 'outbound' | 'inbound'. */
  direction: string;
  /** Connection kind stored as Neo4j r.data (API, KAFKA, MQ, NAS, …). */
  connectionKind: string;
  channel: string;
}

export interface SuggestConnectionsSkippedItem {
  scope: string;
  reason: string;
  detail: string;
}

export interface SuggestConnectionsFromGithubResponse {
  created: SuggestConnectionsCreatedItem[];
  skipped: SuggestConnectionsSkippedItem[];
  /** Files whose content was read during the agentic discovery loop (traceability). */
  analyzedFiles?: string[];
}

/**
 * Canonical graph filter set: graph identity (application ids) plus Data Model NODE attributes,
 * NODE_REF catalogue ids, and EDGE attributes on DEPENDS_ON. Values inside one key combine with OR,
 * keys/axes combine with AND. An empty list means "no filter on that axis".
 */
export type GraphFilters = {
  applicationIds: string[];
  nodeAttributes: Record<string, string[]>;
  /** Data Model target=NODE_REF key → selected :DataModelRef ids. */
  nodeRefs: Record<string, string[]>;
  /** Data Model target=EDGE key → selected values on DEPENDS_ON relationships. */
  edgeAttributes?: Record<string, string[]>;
};

/** One filterable dimension from GET /api/graph/node-filters. */
export type GraphNodeFilterDto = {
  /** Data Model field key. */
  key: string;
  label: string;
  /** NODE/EDGE: attribute values; NODE_REF: catalogue ref ids (same order as options). */
  values: string[];
  fromAllowedValues: boolean;
  /** NODE (flat props), NODE_REF (catalogue), or EDGE (DEPENDS_ON props). Defaults to NODE. */
  kind?: 'NODE' | 'NODE_REF' | 'EDGE';
  multiple?: boolean;
  /** Present for NODE_REF: id + display name. */
  options?: Array<{ id: string; name: string }>;
};

export type GraphNodePosition = { x: number; y: number };

/** Display-only legend coding pinned with a saved view. */
export type GraphSnapshotLegend = {
  edgeColorKey: string;
  edgeLabelKey: string;
  appFillKey: string;
  appBorderKey: string;
  colors?: {
    edgeStroke?: Record<string, string>;
    edgeLabel?: Record<string, string>;
    appFill?: Record<string, string>;
    appBorder?: Record<string, string>;
  };
  hideEdgeLabels?: boolean;
};

/**
 * Saved-view payload: graph filters + diagram collapse + node layout + legend.
 * {@link hiddenApplicationIds}, {@link nodePositions}, and {@link legend} are UI-only
 * (not sent to GET /api/graph).
 */
export type GraphSnapshotFilters = GraphFilters & {
  /** Application node ids that were collapsed when the view was pinned. */
  hiddenApplicationIds?: string[];
  /** Canvas positions of visible application nodes at pin time. */
  nodePositions?: Record<string, GraphNodePosition>;
  /** Legend coding (keys + per-value colors) at pin time. */
  legend?: GraphSnapshotLegend;
};

export type GraphSnapshotDto = {
  id: string;
  name: string;
  filters: GraphSnapshotFilters;
  createdAt: string;
  updatedAt: string;
};

/** How AI connection suggestion treats this field. */
export type DataModelDetection = 'AUTOMATIC_DETECTION' | 'MANUAL';

/** Where a Data Model field applies in the graph. */
export type DataModelTarget = 'EDGE' | 'NODE' | 'NODE_REF';

/** Workspace Data Model field (dynamic edge / application-node enrichment). */
export type DataModelFieldDto = {
  key: string;
  label: string;
  description?: string;
  promptHint?: string;
  allowedValues?: string[];
  enforceEnum: boolean;
  required: boolean;
  /** Defaults to AUTOMATIC_DETECTION when omitted (backend). */
  detection?: DataModelDetection;
  /** Defaults to EDGE when omitted (backend). */
  target?: DataModelTarget;
  /** NODE_REF only: allow several CLASSIFIED_AS links. Defaults to false. */
  multiple?: boolean;
};

/** {@code GET/PUT /api/data-model} */
export type DataModelResponse = {
  fields: DataModelFieldDto[];
  updatedAt: string;
};

export type DataModelPutRequest = {
  fields: DataModelFieldDto[];
};
