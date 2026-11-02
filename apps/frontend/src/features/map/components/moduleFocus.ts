import type { ModuleLink } from '../utils/moduleDetails';
import { collectDescendants } from './moduleNestedLayout';

/** self: the module and what it holds; neighbor: linked by data; context: holds the module. */
export type ModuleTier = 'self' | 'neighbor' | 'context' | 'faded';

function ancestorsOf(id: string, childrenByParent: Map<string, string[]>): Set<string> {
  const parentById = new Map<string, string>();
  for (const [parent, children] of childrenByParent) {
    for (const child of children) parentById.set(child, parent);
  }
  const ancestors = new Set<string>();
  for (let parent = parentById.get(id); parent; parent = parentById.get(parent)) ancestors.add(parent);
  return ancestors;
}

export function moduleTiers(
  focusId: string,
  nodeIds: string[],
  childrenByParent: Map<string, string[]>,
  links: ModuleLink[]
): Map<string, ModuleTier> {
  const self = collectDescendants(focusId, childrenByParent);
  const neighbors = new Set<string>();
  for (const link of links) {
    if (self.has(link.sourceId)) collectDescendants(link.targetId, childrenByParent).forEach((id) => neighbors.add(id));
    if (self.has(link.targetId)) collectDescendants(link.sourceId, childrenByParent).forEach((id) => neighbors.add(id));
  }
  const context = ancestorsOf(focusId, childrenByParent);

  const tiers = new Map<string, ModuleTier>();
  for (const id of nodeIds) {
    if (self.has(id)) tiers.set(id, 'self');
    else if (neighbors.has(id)) tiers.set(id, 'neighbor');
    else if (context.has(id)) tiers.set(id, 'context');
    else tiers.set(id, 'faded');
  }
  return tiers;
}
