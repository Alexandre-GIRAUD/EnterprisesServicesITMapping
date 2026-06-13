import type { ApplicationResponse, GraphEdgeCreateResponse } from '@/types/api';

export function isSandboxId(id: string): boolean {
  return id.startsWith('sandbox-');
}

export function createSandboxApplicationId(): string {
  return `sandbox-app-${crypto.randomUUID()}`;
}

export function createSandboxEdgeId(): string {
  return `sandbox-edge-${crypto.randomUUID()}`;
}

export function buildSandboxApplicationResponse(input: {
  name: string;
  description?: string;
  year?: number;
}): ApplicationResponse {
  return {
    id: createSandboxApplicationId(),
    name: input.name,
    description: input.description,
    year: input.year ?? null,
    businessUnit: null,
    regions: [],
    contributors: [],
  };
}

export function buildSandboxEdgeResponse(input: {
  sourceId: string;
  targetId: string;
  type: string;
}): GraphEdgeCreateResponse {
  return {
    id: createSandboxEdgeId(),
    sourceId: input.sourceId,
    targetId: input.targetId,
    type: input.type,
  };
}

export function applicationResponseFromGraphNode(node: {
  id: string;
  label: string;
  description?: string | null;
  year?: number;
}): ApplicationResponse {
  return {
    id: node.id,
    name: node.label,
    description: node.description ?? undefined,
    year: node.year ?? null,
    businessUnit: null,
    regions: [],
    contributors: [],
  };
}
