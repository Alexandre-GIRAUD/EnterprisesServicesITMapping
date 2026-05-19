/**
 * API request/response DTOs aligned with backend.
 */

/** Temporal in API responses (ISO instant strings) */
export interface TemporalDto {
  validFrom: string | null;
  validTo: string | null;
}

/** Graph node as returned by /api/graph and module-graph */
export interface GraphNodeDto {
  id: string;
  label: string;
  type: string;
  temporal?: TemporalDto;
  /** Present on GET …/module-graph when non-empty (Neo4j description). */
  description?: string | null;
}

/** Graph edge as returned by /api/graph */
export interface GraphEdgeDto {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
}

export interface GraphEdgeCreateRequest {
  sourceId: string;
  targetId: string;
  type: string;
  validFrom?: string;
  validTo?: string | null;
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
  validFrom?: string;
  validTo?: string | null;
}

export interface BusinessUnitSummary {
  id: string;
  name: string | null;
  code: string | null;
  description: string | null;
}

/** Application CRUD – response body */
export interface ApplicationResponse {
  id: string;
  name: string;
  description?: string;
  validFrom: string;
  validTo: string | null;
  /** True when the app already has modules (CONTAINS); IA suggestion is blocked server-side. */
  hasModuleSubtree?: boolean;
  /** Set on GET /applications/{id} when linked via HAS_APPLICATION from a BusinessUnit. */
  businessUnit?: BusinessUnitSummary | null;
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
}
