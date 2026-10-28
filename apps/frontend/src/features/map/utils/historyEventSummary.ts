import type { AttributeChangeEventDto } from '@/types/api';

type LinkSnapshot = {
  name?: string;
  sourceId?: string;
  targetId?: string;
  type?: string;
  connection_kind?: string;
  channel?: string;
};

const LINK_ENTITY_LABEL: Record<string, string> = {
  APP_LINK: 'Application',
  MODULE_LINK: 'Module',
  EDGE_LINK: 'Connection',
};

function snapshotDetail(fieldScope: string, raw: string): string {
  try {
    const snapshot = JSON.parse(raw) as LinkSnapshot;
    if (fieldScope !== 'EDGE_LINK') return snapshot.name ?? '';
    return [
      snapshot.type,
      snapshot.connection_kind,
      snapshot.channel,
      snapshot.sourceId && snapshot.targetId ? `${snapshot.sourceId} → ${snapshot.targetId}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  } catch {
    return raw.slice(0, 120);
  }
}

/** Creation or deletion of an application, module or flow, with its name or endpoints. */
export function linkEventSummary(event: AttributeChangeEventDto): {
  title: string;
  detail: string | null;
} {
  const entity = LINK_ENTITY_LABEL[event.fieldScope] ?? 'Connection';
  const isCreated = !event.oldValue && Boolean(event.newValue);
  const isDeleted = Boolean(event.oldValue) && !event.newValue;
  const raw = isCreated ? event.newValue : isDeleted ? event.oldValue : null;
  const detail = raw ? snapshotDetail(event.fieldScope, raw) : null;
  const verb = isCreated ? 'created' : isDeleted ? 'deleted' : 'updated';
  return { title: `${entity} ${verb}`, detail };
}

