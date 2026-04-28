import { useState } from 'react';
import type { GraphEdgeCreateResponse } from '@/types/api';
import { createGraphEdge } from '../api/graphApi';

type CreateEdgeInput = {
  sourceId: string;
  targetId: string;
  type: string;
  validFrom?: string;
  validTo?: string;
};

function toIsoOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

export function useCreateGraphEdge() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createEdge(input: CreateEdgeInput): Promise<GraphEdgeCreateResponse | null> {
    setIsSubmitting(true);
    setError(null);
    try {
      return await createGraphEdge({
        sourceId: input.sourceId,
        targetId: input.targetId,
        type: input.type,
        validFrom: toIsoOrUndefined(input.validFrom),
        validTo: input.validTo ? new Date(input.validTo).toISOString() : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de creer la relation');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { createEdge, isSubmitting, error };
}
