import { useState } from 'react';
import { createApplication } from '../api/applicationsApi';

type CreateNodeInput = {
  name: string;
  description?: string;
};

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
      });
      return created;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to create the node';
      setError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { createNode, isSubmitting, error };
}
