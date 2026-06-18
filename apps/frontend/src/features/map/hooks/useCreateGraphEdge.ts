import { useState } from 'react';
import type { GraphEdgeCreateResponse } from '@/types/api';
import { createGraphEdge } from '../api/graphApi';

type CreateEdgeInput = {
  sourceId: string;
  targetId: string;
  type: string;
};

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
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create the relationship');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { createEdge, isSubmitting, error };
}
