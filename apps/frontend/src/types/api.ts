/**
 * API request/response DTOs aligned with backend.
 */

/** Graph node as returned by /api/graph and module-graph */
export interface GraphNodeDto {
  id: string;
  label: string;
  type: string;
  /** Reference year of the node (Application/Module); omitted when null. */
  year?: number;
  /** Present on GET …/module-graph when non-empty (Neo4j description). */
  description?: string | null;
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

/** Application CRUD – request body */
export interface ApplicationRequest {
  name: string;
  description?: string;
  year?: number;
}

export interface BusinessUnitSummary {
  id: string;
  name: string | null;
  code: string | null;
  description: string | null;
}

/** Region linked to an application via IS_USED_IN (detail GET / catalogue GET /regions). */
export interface RegionSummary {
  id: string;
  code: string;
  name: string;
}

/** Application CRUD – response body */
export interface ApplicationResponse {
  id: string;
  name: string;
  description?: string;
  /** Reference year (e.g. 2025); null when not set. */
  year: number | null;
  /** True when the app already has modules (CONTAINS); IA suggestion is blocked server-side. */
  hasModuleSubtree?: boolean;
  /** Set on GET /applications/{id} when linked via HAS_APPLICATION from a BusinessUnit. */
  businessUnit?: BusinessUnitSummary | null;
  /** Regions via IS_USED_IN (GET /applications/{id} when non-empty). */
  regions?: RegionSummary[];
  /** Contributors with WORK_ON → this application (GET /applications/{id} when non-empty). */
  contributors?: ContributorSummary[];
}

/** Minimal contributor row for application detail and lists. */
export interface ContributorSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export interface ContributorListItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  team: string | null;
}

export interface ContributorLinkedApplication {
  id: string;
  name: string | null;
}

export interface ContributorDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  team: string | null;
  businessUnit: BusinessUnitSummary | null;
  manager: ContributorSummary | null;
  applications: ContributorLinkedApplication[];
}

export interface ContributorWriteRequest {
  firstName: string;
  lastName: string;
  team?: string | null;
  businessUnitId?: string | null;
  managerContributorId?: string | null;
  applicationIds?: string[];
}

/** GET /business-units — filter dropdown */
export interface BusinessUnitListItem {
  id: string;
  name: string;
}

/** POST /business-units */
export interface BusinessUnitCreateRequest {
  name: string;
  code?: string;
  description?: string;
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

/** Canonical graph filter set (year + dimension id lists). */
export type GraphFilters = {
  year: number | null;
  applicationIds: string[];
  businessUnitIds: string[];
  regionCodes: string[];
};

/** Alias kept for snapshot APIs; identical to {@link GraphFilters}. */
export type GraphSnapshotFilters = GraphFilters;

export type GraphSnapshotDto = {
  id: string;
  name: string;
  filters: GraphFilters;
  createdAt: string;
  updatedAt: string;
};

/** How AI connection suggestion treats this field. */
export type DataModelDetection = 'AUTOMATIC_DETECTION' | 'MANUAL';

/** Where a Data Model field applies in the graph. */
export type DataModelTarget = 'EDGE' | 'NODE';

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
};

/** {@code GET/PUT /api/data-model} */
export type DataModelResponse = {
  fields: DataModelFieldDto[];
  updatedAt: string;
};

export type DataModelPutRequest = {
  fields: DataModelFieldDto[];
};
