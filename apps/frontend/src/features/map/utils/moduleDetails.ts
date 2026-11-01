import type { GraphEdgeDto, GraphNodeDto } from '../../../types/api.ts';

/** Functional facts about one module, as the module drawer shows them. */
export type ModuleDetails = {
  id: string;
  name: string;
  /** What the module does, in business words. */
  description: string;
  /** Business owner. */
  owner: string;
  /** Who uses the module. */
  actors: string[];
  /** When the module acts: real time, end of day, on an event... */
  trigger: string;
  /** Business objects the module consumes. */
  dataIn: string[];
  /** Business objects the module produces. */
  dataOut: string[];
};

export type ModuleDetailsField =
  | 'description'
  | 'owner'
  | 'actors'
  | 'trigger'
  | 'dataIn'
  | 'dataOut';

const MODULE_DETAILS_FIELDS: ModuleDetailsField[] = [
  'description',
  'owner',
  'actors',
  'trigger',
  'dataIn',
  'dataOut',
];

/** Facts about the application as a whole, shown outside any single module. */
export type ApplicationModel = {
  /** Lexicon of business objects the modules pick their data from. */
  businessObjects: string[];
  /** How the modules chain end to end, in a few sentences. */
  mainJourney: string;
  /** What the application covers and what it does not. */
  scope: string;
};

/** One module feeds another, through a business object (empty when unspecified). */
export type ModuleLink = { sourceId: string; targetId: string; object: string };

const FEEDS_EDGE_TYPE = 'FEEDS';
const DATA_LIST_SEPARATOR = /[\n,;]/;

function normalizeDataKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Split typed text on new lines, commas and semicolons; drop blanks and case-insensitive repeats. */
export function parseDataList(text: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of text.split(DATA_LIST_SEPARATOR)) {
    const item = part.trim();
    if (!item || seen.has(normalizeDataKey(item))) continue;
    seen.add(normalizeDataKey(item));
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
    actors: listOf(properties.actors),
    trigger: textOf(properties.trigger),
    dataIn: listOf(properties.dataIn),
    dataOut: listOf(properties.dataOut),
  };
}

export function applicationModelFromNode(node: GraphNodeDto): ApplicationModel {
  const properties = node.properties ?? {};
  return {
    businessObjects: listOf(properties.businessObjects),
    mainJourney: textOf(properties.mainJourney),
    scope: textOf(properties.scope),
  };
}

/** The explicit links between modules: FEEDS edges, the label of the edge being the object. */
export function moduleLinksFromEdges(edges: GraphEdgeDto[]): ModuleLink[] {
  return edges
    .filter((edge) => edge.type === FEEDS_EDGE_TYPE)
    .map((edge) => ({ sourceId: edge.sourceId, targetId: edge.targetId, object: edge.data ?? '' }));
}

/**
 * Group modules joined by explicit links. Returns module id → group index (in order of first
 * appearance); modules linked to nobody are left out.
 */
export function moduleLinkGroups(links: ModuleLink[]): Map<string, number> {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };

  for (const link of links) {
    parent.set(find(link.sourceId), find(link.targetId));
  }

  const groupOfRoot = new Map<string, number>();
  const groups = new Map<string, number>();
  for (const link of links) {
    for (const id of [link.sourceId, link.targetId]) {
      const root = find(id);
      if (!groupOfRoot.has(root)) groupOfRoot.set(root, groupOfRoot.size);
      groups.set(id, groupOfRoot.get(root)!);
    }
  }
  return groups;
}

/** The objects of `list` that `other` does not hold, without repeats. */
function objectsWithout(list: string[], other: string[]): string[] {
  const excluded = new Set(other.map(normalizeDataKey));
  return parseDataList(list.filter((object) => !excluded.has(normalizeDataKey(object))).join('\n'));
}

/**
 * What crosses the application border: objects some module consumes that no module produces
 * (inputs), and objects some module produces that no module consumes (outputs).
 */
export function externalData(modules: ModuleDetails[]): { inputs: string[]; outputs: string[] } {
  const consumed = modules.flatMap((module) => module.dataIn);
  const produced = modules.flatMap((module) => module.dataOut);
  return {
    inputs: objectsWithout(consumed, produced),
    outputs: objectsWithout(produced, consumed),
  };
}

export function changedModuleFields(before: ModuleDetails, after: ModuleDetails): ModuleDetailsField[] {
  return MODULE_DETAILS_FIELDS.filter((field) => {
    const a = before[field];
    const b = after[field];
    return Array.isArray(a) && Array.isArray(b)
      ? a.length !== b.length || a.some((item, index) => item !== b[index])
      : a !== b;
  });
}
