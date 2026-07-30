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
}): ApplicationResponse {
  return {
    id: createSandboxApplicationId(),
    name: input.name,
    description: input.description,
    nodeAttributes: {},
    nodeRefs: {},
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
  properties?: Record<string, string>;
}): ApplicationResponse {
  return {
    id: node.id,
    name: node.label,
    description: node.description ?? undefined,
    nodeAttributes: node.properties ?? {},
  };
}
