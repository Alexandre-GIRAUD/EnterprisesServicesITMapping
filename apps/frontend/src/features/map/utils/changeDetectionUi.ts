import type { ChangeDetectionItemDto, ChangeDetectionRunDto } from '@/types/api';

export type PendingChangeChip = {
  runId: string;
  itemId: string;
  kind: ChangeDetectionItemDto['kind'];
  appName: string;
  nodesLabel: string;
  meta: string;
  ariaLabel: string;
};

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
  if (nameById instanceof Map) {
    return nameById.get(id) ?? id.slice(0, 8);
  }
  return nameById[id] ?? id.slice(0, 8);
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
    case 'EDGE_ATTRIBUTE':
      return 'change-chip-kind change-chip-kind--edge-attr';
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
