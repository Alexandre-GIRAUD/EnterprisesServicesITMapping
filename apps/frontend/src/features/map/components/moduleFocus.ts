import type { ModuleLink } from '../utils/moduleDetails';
import { collectDescendants } from './moduleNestedLayout';

/** self: the module and what it holds; neighbor: linked by data; context: holds the module. */
export type ModuleTier = 'self' | 'neighbor' | 'context' | 'faded';

type ModuleTierInput = {
  focusId: string;
  nodeIds: string[];
  childrenByParent: Map<string, string[]>;
  links: ModuleLink[];
};

function collectAncestors(id: string, childrenByParent: Map<string, string[]>): Set<string> {
  const parentById = new Map<string, string>();
  for (const [parent, children] of childrenByParent) {
    for (const child of children) parentById.set(child, parent);
  }
  const ancestors = new Set<string>();
  for (let parent = parentById.get(id); parent; parent = parentById.get(parent)) ancestors.add(parent);
  return ancestors;
}

/** The modules, with what they hold, that exchange data with the focused module. */
function collectLinkedModules(self: Set<string>, input: ModuleTierInput): Set<string> {
  const linked = new Set<string>();
  const addWithChildren = (id: string) =>
    collectDescendants(id, input.childrenByParent).forEach((member) => linked.add(member));
  for (const link of input.links) {
    if (self.has(link.sourceId)) addWithChildren(link.targetId);
    if (self.has(link.targetId)) addWithChildren(link.sourceId);
  }
  return linked;
}

export function computeModuleTiers(input: ModuleTierInput): Map<string, ModuleTier> {
  const self = collectDescendants(input.focusId, input.childrenByParent);
  const neighbors = collectLinkedModules(self, input);
  const context = collectAncestors(input.focusId, input.childrenByParent);

  const tierOf = (id: string): ModuleTier => {
    if (self.has(id)) return 'self';
    if (neighbors.has(id)) return 'neighbor';
    return context.has(id) ? 'context' : 'faded';
  };
  return new Map(input.nodeIds.map((id) => [id, tierOf(id)]));
}
