import type { ChangeDetectionItemDto, ChangeDetectionRunDto } from '@/types/api';

export type PendingChangeChip = {
  runId: string;
  itemId: string;
  kind: ChangeDetectionItemDto['kind'];
  appName: string;
  source: string;
  dest: string | null;
  nodesLabel: string;
  meta: string;
  ariaLabel: string;
};

const KIND_LABELS: Record<ChangeDetectionItemDto['kind'], string> = {
  CONNECTION: 'Connection',
  MODULE: 'Module',
  NODE_ATTRIBUTE: 'Node attribute',
};

export function kindLabel(kind: ChangeDetectionItemDto['kind']): string {
  return KIND_LABELS[kind];
}

function payloadString(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Resolve display name for a run's linked application. */
export function resolveAppName(
  applicationId: string | null | undefined,
  nameById: Map<string, string> | Record<string, string>
): string {
  if (!applicationId?.trim()) return 'Unlinked application';
  const id = applicationId.trim();
  const name = nameById instanceof Map ? nameById.get(id) : nameById[id];
  return name?.trim() || 'Unknown application';
}

function catalogueName(
  peerName: string,
  nameById: Map<string, string> | Record<string, string>
): string {
  const wanted = peerName.trim().toLowerCase();
  const names = nameById instanceof Map ? nameById.values() : Object.values(nameById);
  for (const name of names) {
    if (name.trim().toLowerCase() === wanted) return name.trim();
  }
  return peerName.trim();
}

/**
 * Source and destination of a detected connection.
 * Outbound: this application → the catalogue peer. Inbound: the peer → this application.
 */
export function resolveSourceDest(
  run: ChangeDetectionRunDto,
  item: ChangeDetectionItemDto,
  nameById: Map<string, string> | Record<string, string>
): { source: string; dest: string | null; destMissing: boolean } {
  const payload = item.payload ?? {};
  const peerName = payloadString(payload, 'peerApplicationName');
  const direction = payloadString(payload, 'direction')?.toLowerCase();
  const appName = resolveAppName(run.applicationId, nameById);
  if (peerName && (direction === 'outbound' || direction === 'inbound')) {
    const peer = catalogueName(peerName, nameById);
    if (direction === 'inbound') {
      return { source: peer, dest: appName, destMissing: false };
    }
    return { source: appName, dest: peer, destMissing: false };
  }
  const sourceFromPayload = payloadString(
    payload,
    'sourceName',
    'source',
    'fromName',
    'from',
    'sourceApplicationName'
  );
  const destFromPayload = payloadString(
    payload,
    'destName',
    'destinationName',
    'dest',
    'destination',
    'toName',
    'to',
    'targetApplicationName'
  );
  const source = sourceFromPayload ?? appName;
  if (destFromPayload) {
    return { source, dest: destFromPayload, destMissing: false };
  }
  return { source, dest: null, destMissing: true };
}

export function shortRepo(repoFullName: string): string {
  const parts = repoFullName.split('/');
  return parts.length > 1 ? parts[parts.length - 1]! : repoFullName;
}

export function shortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

export function kindChipClass(kind: ChangeDetectionItemDto['kind']): string {
  switch (kind) {
    case 'CONNECTION':
      return 'change-chip-kind change-chip-kind--connection';
    case 'MODULE':
      return 'change-chip-kind change-chip-kind--module';
    case 'NODE_ATTRIBUTE':
      return 'change-chip-kind change-chip-kind--node-attr';
    default:
      return 'change-chip-kind';
  }
}

export function flattenPendingChips(
  runs: ChangeDetectionRunDto[],
  nameById: Map<string, string> | Record<string, string>
): PendingChangeChip[] {
  const chips: PendingChangeChip[] = [];
  for (const run of runs) {
    for (const item of run.items) {
      if (item.status !== 'PENDING') continue;
      const { source, dest } = resolveSourceDest(run, item, nameById);
      const appName = resolveAppName(run.applicationId, nameById);
      const nodesLabel = dest ? `${source} → ${dest}` : source;
      const meta = `${shortRepo(run.repoFullName)} · ${shortSha(run.commitSha)}`;
      chips.push({
        runId: run.id,
        itemId: item.id,
        kind: item.kind,
        appName,
        source,
        dest,
        nodesLabel,
        meta,
        ariaLabel: `Review ${item.kind} for ${appName}`,
      });
    }
  }
  return chips;
}

export function countPendingItems(runs: ChangeDetectionRunDto[]): number {
  return runs.reduce((n, run) => n + run.items.filter((i) => i.status === 'PENDING').length, 0);
}

export function githubCommitUrl(repoFullName: string, commitSha: string): string {
  return `https://github.com/${repoFullName}/commit/${commitSha}`;
}

export type EdgeAttributeRow = { key: string; label: string; value: string };

/** Edge fields that accept will write. Labels come from the data model when known. */
export function edgeAttributeRows(
  payload: Record<string, unknown> | null | undefined,
  labels: ReadonlyMap<string, string> = new Map()
): EdgeAttributeRow[] {
  const raw = payload?.edgeAttributes;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const rows: EdgeAttributeRow[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const trimmed = key.trim();
    const text = formatAttributeValue(value);
    if (!trimmed || !text) continue;
    rows.push({ key: trimmed, label: attributeLabel(trimmed, labels), value: text });
  }
  return rows;
}

function attributeLabel(key: string, labels: ReadonlyMap<string, string>): string {
  return labels.get(key)?.trim() || humanizeAttributeKey(key);
}

function humanizeAttributeKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatAttributeValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!Array.isArray(value)) return '';
  return value
    .map((entry) => formatAttributeValue(entry))
    .filter(Boolean)
    .join(', ');
}
