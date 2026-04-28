import { useState } from 'react';
import { createApplication } from '../api/applicationsApi';

type CreateNodeInput = {
  name: string;
  description?: string;
  validFrom?: string;
  validTo?: string;
};

function toIsoOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

export function useCreateApplicationNode() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createNode(input: CreateNodeInput) {
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await createApplication({
        name: input.name,
        description: input.description,
        validFrom: toIsoOrUndefined(input.validFrom),
        validTo: input.validTo ? new Date(input.validTo).toISOString() : null,
      });
      return created;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Impossible de créer le node';
      setError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { createNode, isSubmitting, error };
}
