import { useEffect, useState } from 'react';
import { fetchGraph } from '../api/graphApi';

/** Ids of the applications the selected breach rules flag; null while unknown or when no rule is selected. */
export function useBreachApplicationIds(breach: readonly string[] | undefined): ReadonlySet<string> | null {
  const [ids, setIds] = useState<ReadonlySet<string> | null>(null);
  const selection = (breach ?? []).join(',');
  useEffect(() => {
    if (!selection) {
      setIds(null);
      return undefined;
    }
    let isCancelled = false;
    fetchGraph({ breach: selection.split(',') })
      .then((graph) => {
        if (!isCancelled) setIds(new Set(graph.nodes.filter((n) => n.type === 'Application').map((n) => n.id)));
      })
      .catch(() => {
        if (!isCancelled) setIds(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [selection]);
  return ids;
}
