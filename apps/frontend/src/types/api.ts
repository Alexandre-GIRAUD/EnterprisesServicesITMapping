/**
 * API request/response DTOs aligned with backend.
 */

/** Temporal in API responses (ISO instant strings) */
export interface TemporalDto {
  validFrom: string | null;
  validTo: string | null;
}

/** Graph node as returned by /api/graph */
export interface GraphNodeDto {
  id: string;
  label: string;
  type: string;
  temporal?: TemporalDto;
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

/** Application CRUD – response body */
export interface ApplicationResponse {
  id: string;
  name: string;
  description?: string;
  validFrom: string;
  validTo: string | null;
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
