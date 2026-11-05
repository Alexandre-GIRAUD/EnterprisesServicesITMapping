/**
 * API request/response DTOs aligned with backend.
 */

/** One Data Model value, or several when the field allows multiple values. */
export type StoredAttribute = string | string[];

/** Graph node as returned by /api/graph and module-graph */
export interface GraphNodeDto {
  id: string;
  label: string;
  type: string;
  /** Present on GET …/module-graph when non-empty (Neo4j description). */
  description?: string | null;
  /** Dynamic business properties of the node (Data Model target=NODE keys); empty on module-graph. */
  properties?: Record<string, StoredAttribute>;
  /** Catalogue names (Data Model target=NODE_REF): field key → ref names. */
  nodeRefs?: Record<string, string[]>;
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
  properties?: Record<string, StoredAttribute>;
}

export interface GraphEdgeCreateRequest {
  sourceId: string;
  targetId: string;
  type: string;
  changeMeta?: AttributeChangeMeta | null;
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
  nodeAttributes?: Record<string, StoredAttribute>;
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
  attributes: Record<string, StoredAttribute>;
  changeMeta?: AttributeChangeMeta | null;
}

export type HumanChangeReason =
  | 'MissedOnScan'
  | 'NotInSources'
  | 'WrongData'
  | 'WrongFormat'
  | 'WrongSpelling'
  | 'OutdatedData'
  | 'Others';

export type AttributeChangeMeta = {
  reason: HumanChangeReason;
  reasonComment?: string | null;
};

export type AuditTargetType = 'APPLICATION' | 'EDGE';
export type AuditActorType = 'HUMAN' | 'AI';
export type AuditFieldScope =
  | 'NODE_ATTR'
  | 'EDGE_ATTR'
  | 'APP_FIELD'
  | 'EDGE_LINK'
  | 'APP_LINK'
  | 'MODULE_LINK';

export type AttributeChangeEventDto = {
  id: string;
  targetType: AuditTargetType | 'MODULE';
  targetId: string;
  fieldScope: AuditFieldScope;
  fieldKey: string;
  oldValue: string | null;
  newValue: string | null;
  actorType: AuditActorType;
  actorUserId: string | null;
  actorUsername: string | null;
  aiSource: string | null;
  humanReason: HumanChangeReason | null;
  humanReasonComment: string | null;
  createdAt: string;
};

export type AttributeChangePageDto = {
  items: AttributeChangeEventDto[];
  page: number;
  size: number;
  totalElements: number;
  hasMore: boolean;
};

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

export interface BitbucketRepoDto {
  id: string;
  fullName: string;
  name: string;
  description?: string;
  htmlUrl: string;
  repoPrivate: boolean;
}

/** {@code GET /api/change-detections} — GitHub push diff suggestions (review before Neo4j write). */
export type ChangeDetectionItemDto = {
  id: string;
  kind: 'MODULE' | 'CONNECTION' | 'NODE_ATTRIBUTE';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  confidence: number;
  summary: string;
  evidence: Array<{ path: string; hunkPreview?: string }>;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ChangeDetectionRunDto = {
  id: string;
  provider: string;
  repoFullName: string;
  commitSha: string;
  branchRef: string;
  applicationId?: string | null;
  status: string;
  truncated: boolean;
  buckets: string[];
  files: Array<{ path: string; status: string; bucket: string }>;
  errorMessage?: string | null;
  items: ChangeDetectionItemDto[];
  createdAt: string;
  updatedAt: string;
};

/** {@code GET /api/override-conflicts} — AI write blocked by human field override. */
export type OverrideConflictStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type AttributeOverrideConflictDto = {
  id: string;
  targetType: 'APPLICATION' | 'EDGE';
  targetId: string;
  fieldScope: 'NODE_ATTR' | 'EDGE_ATTR';
  fieldKey: string;
  protectedValue: string | null;
  proposedValue: string | null;
  aiSource: string | null;
  status: OverrideConflictStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
};

export type AttributeOverrideConflictPageDto = {
  items: AttributeOverrideConflictDto[];
  page: number;
  size: number;
  totalElements: number;
  hasMore: boolean;
};

/** {@code POST /api/chat/ask} — IT mapping chatbot. */
export type ChatCitationType = 'APPLICATION' | 'EDGE' | 'FUNCTIONAL_DOC' | 'MODULE';

export type ChatCitationDto = {
  type: ChatCitationType;
  id: string;
  label: string;
};

export type ChatHistoryMessageDto = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatAskResponseDto = {
  answerMarkdown: string;
  citations: ChatCitationDto[];
  warnings: string[];
  /** Present when this answer replaces the Production map filters, including an empty set that clears them. */
  appliedFilters?: GraphFilters | null;
  /** True when this answer wrote an application, a flow, or a property. */
  graphChanged?: boolean;
};

/** {@code POST /api/applications/{id}/modules/suggest-from-github} */
export interface SuggestModulesFromGithubRequest {
  fullName?: string | null;
  replaceExisting?: boolean | null;
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
  /** Client-only: a dimension has nothing checked, so the graph is empty. */
  matchNothing?: boolean;
  /** Client-only: dimension keys (or `applications`) with nothing checked. */
  blankedDimensions?: string[];
  /** Client-only: specific flows to keep. Empty means every fetched flow. */
  edgeIds?: string[];
  /** Client-only: also show applications linked by a feed to a filtered application. */
  withNeighbours?: boolean;
  /** Live map only: breach rule ids, or `any`, whose breaches the graph keeps. Not saved in views. */
  breach?: string[];
  /** Client-only: draw the breach flames and flow colour; off by default, like `withNeighbours`. */
  shouldShowBreaches?: boolean;
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
  appTextKey?: string;
  colors?: {
    edgeStroke?: Record<string, string>;
    edgeLabel?: Record<string, string>;
    appFill?: Record<string, string>;
    appBorder?: Record<string, string>;
    appText?: Record<string, string>;
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
  folderId?: string | null;
};

export type GraphViewFolderDto = {
  id: string;
  name: string;
  parentId: string | null;
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
  /** NODE only: id of the added source feeding this field (detection is then MANUAL). */
  sourceId?: string;
};

/** {@code GET/PUT /api/data-model} */
export type DataModelResponse = {
  fields: DataModelFieldDto[];
  updatedAt: string;
};

export type DataModelPutRequest = {
  fields: DataModelFieldDto[];
};

/** {@code GET/POST/PATCH/DELETE /api/comments} — notes on applications or edges. */
export type CommentTargetType = 'APPLICATION' | 'EDGE';

export type CommentDto = {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  body: string;
  authorUsername: string;
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type CommentPageDto = {
  items: CommentDto[];
  page: number;
  size: number;
  totalElements: number;
  hasMore: boolean;
};

export type CreateCommentRequest = {
  targetType: CommentTargetType;
  targetId: string;
  body: string;
};

export type UpdateCommentRequest = {
  body: string;
};

/** {@code GET/POST …/applications/{id}/functional-documentation} */
export type FunctionalDocStatus = 'MISSING' | 'PENDING' | 'READY' | 'FAILED';

export type FunctionalDocNamedItem = {
  name: string;
  description: string;
};

export type FunctionalDocActor = {
  name: string;
  role: string;
};

export type FunctionalDocIntegration = {
  name: string;
  purpose: string;
};

export type FunctionalDocPayload = {
  title: string;
  summary: string;
  business_capabilities: FunctionalDocNamedItem[];
  users_and_actors: FunctionalDocActor[];
  main_flows: FunctionalDocNamedItem[];
  data_concepts: FunctionalDocNamedItem[];
  integrations_functional: FunctionalDocIntegration[];
  out_of_scope: string[];
  assumptions: string[];
  limitations: string[];
  sources: string[];
};

export type FunctionalDocumentationDto = {
  applicationId: string;
  status: FunctionalDocStatus;
  locale: string;
  payload: FunctionalDocPayload | null;
  sourceRepo: string | null;
  analyzedFiles: string[];
  generatedAt: string | null;
  errorMessage: string | null;
};

/** Data sources that fill Data Model application attributes ({@code /api/sources}). */
export type SourceKind = 'API' | 'MCP';
export type SourceAuthType = 'NONE' | 'BEARER' | 'API_KEY' | 'BASIC';

export type DataSourceDto = {
  id: string;
  name: string;
  kind: SourceKind;
  endpoint: string;
  toolName: string | null;
  itemsPath: string | null;
  authType: SourceAuthType;
  authHeaderName: string | null;
  authUsername: string | null;
  /** The secret is never returned: only whether one is stored. */
  secretSet: boolean;
  keyColumn: string | null;
  columnMap: Record<string, string>;
};

/** Blank {@code secret} on update keeps the stored one. */
export type DataSourceRequest = Omit<DataSourceDto, 'id' | 'secretSet'> & { secret?: string };

export type SourceMappingEntryDto = { applicationId: string; sourceKey: string | null; noMatch: boolean };

export type SourceMappingResponse = {
  sourceKeys: string[];
  applications: { id: string; name: string }[];
  entries: SourceMappingEntryDto[];
  suggestions: Record<string, string>;
};

export type SourceNameDto = { id: string; name: string; kind: SourceKind };

export type SourceSyncResponse = {
  updatedApplications: number;
  failedApplications: number;
  missingKeyApplications: number;
  fieldsWithoutColumn: string[];
};

export type SourceMappingAlertDto = {
  sourceId: string;
  sourceName: string;
  applications: { id: string; name: string }[];
};

export type BreachSubject = 'APPLICATION' | 'FLOW';
export type BreachCombinator = 'AND' | 'OR';
export type BreachScope =
  | 'SELF'
  | 'ANY_FLOW_IN'
  | 'ANY_FLOW_OUT'
  | 'ANY_FLOW'
  | 'FLOW'
  | 'SOURCE'
  | 'TARGET'
  | 'SOURCE_OR_TARGET';
export type BreachOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'GREATER_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_OR_EQUAL'
  | 'CONTAINS'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY';

export type BreachConditionDto = {
  scope: BreachScope;
  attribute: string;
  operator: BreachOperator;
  value: string;
};

export type BreachGroupDto = { combinator: BreachCombinator; conditions: BreachConditionDto[] };

export type BreachDefinitionDto = { combinator: BreachCombinator; groups: BreachGroupDto[] };

/** Body of {@code POST /api/breach-rules} and {@code PUT /api/breach-rules/{id}}. */
export type BreachRuleRequest = { name: string; subject: BreachSubject; definition: BreachDefinitionDto };

/** {@code GET /api/breach-rules} item. */
export type BreachRuleDto = BreachRuleRequest & {
  id: string;
  breachCount: number;
  unknownCount: number;
  updatedAt: string;
  /** Username of the last editor; null when that user was deleted. */
  updatedBy: string | null;
};

export type BreachTestedValueDto = { scope: BreachScope; attribute: string; values: string[] };

export type BreachElementDto = {
  kind: BreachSubject;
  id: string;
  label: string;
  /** Flows only. */
  source?: BreachEndpointDto;
  /** Flows only. */
  target?: BreachEndpointDto;
  values: BreachTestedValueDto[];
};

export type BreachEndpointDto = { id: string; label: string };

/** {@code GET /api/breach-rules/{id}/evaluation} */
export type BreachResultDto = { ruleId: string; breaches: BreachElementDto[]; unknown: BreachElementDto[] };

/** {@code GET /api/breach-rules/evaluation}: rule ids by application id and by flow id, and rule names. */
export type BreachSummaryDto = {
  applications: Record<string, string[]>;
  flows: Record<string, string[]>;
  ruleNames: Record<string, string>;
};

export type BreachImpactDto = { ruleId: string; ruleName: string; element: BreachElementDto };

/** {@code GET /api/change-detections/{runId}/items/{itemId}/breach-impact} */
export type BreachImpactResponseDto = { entering: BreachImpactDto[]; leaving: BreachImpactDto[] };
