import type { GraphNodeDto } from '../../../types/api.ts';

/** Editable facts about one module, as the module drawer shows them. */
export type ModuleDetails = {
  id: string;
  name: string;
  description: string;
  owner: string;
  technology: string;
  /** Data the module consumes. */
  dataIn: string[];
  /** Data the module produces. */
  dataOut: string[];
};

export type ModuleDetailsField = 'description' | 'owner' | 'technology' | 'dataIn' | 'dataOut';

const FIELDS: ModuleDetailsField[] = ['description', 'owner', 'technology', 'dataIn', 'dataOut'];

function sameKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Split typed text on new lines, commas and semicolons; drop blanks and case-insensitive repeats. */
export function parseDataList(text: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of text.split(/[\n,;]/)) {
    const item = part.trim();
    if (!item || seen.has(sameKey(item))) continue;
    seen.add(sameKey(item));
    items.push(item);
  }
  return items;
}

function listOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function moduleDetailsFromNode(node: GraphNodeDto): ModuleDetails {
  const properties = node.properties ?? {};
  return {
    id: node.id,
    name: node.label?.trim() || node.id,
    description: node.description?.trim() ?? '',
    owner: textOf(properties.owner),
    technology: textOf(properties.technology),
    dataIn: listOf(properties.dataIn),
    dataOut: listOf(properties.dataOut),
  };
}

/**
 * Group modules that exchange data: B consumes something A produces. Returns module id → group
 * index (in order of first appearance); modules linked to nobody are left out.
 */
export function moduleLinkGroups(modules: ModuleDetails[]): Map<string, number> {
  const parent = new Map(modules.map((m) => [m.id, m.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };

  const producers = new Map<string, string[]>();
  for (const m of modules) {
    for (const item of m.dataOut) {
      producers.set(sameKey(item), [...(producers.get(sameKey(item)) ?? []), m.id]);
    }
  }
  const linked = new Set<string>();
  for (const m of modules) {
    for (const item of m.dataIn) {
      for (const producerId of producers.get(sameKey(item)) ?? []) {
        if (producerId === m.id) continue;
        parent.set(find(producerId), find(m.id));
        linked.add(producerId);
        linked.add(m.id);
      }
    }
  }

  const groupOfRoot = new Map<string, number>();
  const groups = new Map<string, number>();
  for (const m of modules) {
    if (!linked.has(m.id)) continue;
    const root = find(m.id);
    if (!groupOfRoot.has(root)) groupOfRoot.set(root, groupOfRoot.size);
    groups.set(m.id, groupOfRoot.get(root)!);
  }
  return groups;
}

export function changedModuleFields(before: ModuleDetails, after: ModuleDetails): ModuleDetailsField[] {
  return FIELDS.filter((field) => {
    const a = before[field];
    const b = after[field];
    return Array.isArray(a) && Array.isArray(b)
      ? a.length !== b.length || a.some((item, i) => item !== b[i])
      : a !== b;
  });
}
