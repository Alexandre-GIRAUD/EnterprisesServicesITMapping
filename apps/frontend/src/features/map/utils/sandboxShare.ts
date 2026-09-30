const MAX_NAME_LENGTH = 80;
const MAX_NAME_ATTEMPTS = 50;

export type SharedSandboxInboxItem<T> = {
  id: string;
  name: string;
  senderUsername: string;
  document: T;
};

export type SavedSandboxCopy<T> = {
  id: string;
  name: string;
  updatedAt: string;
  document: T;
  sourceShareId?: string;
};

/** Same naming rule as the view share: keep the name, or `Name (from sender)`. */
export function chooseCopyName(original: string, senderUsername: string, isTaken: (name: string) => boolean): string {
  if (!isTaken(original)) return original;
  const from = ` (from ${senderUsername.trim()})`;
  for (let number = 1; number <= MAX_NAME_ATTEMPTS; number += 1) {
    const tail = number === 1 ? from : `${from} ${number}`;
    const candidate = fitCopyName(original, tail);
    if (!isTaken(candidate)) return candidate;
  }
  throw new Error('No free name for the copy.');
}

function fitCopyName(original: string, tail: string): string {
  const room = MAX_NAME_LENGTH - tail.length;
  if (room < 1) return tail.slice(tail.length - MAX_NAME_LENGTH);
  const base = original.length <= room ? original : original.slice(0, room).trim();
  return `${base || original.slice(0, 1)}${tail}`;
}

type CopyableDocument = { id: string; name: string; dirty: boolean };

/** Merge an inbox of shared sandboxes into the local saved list. Already imported ids are only acknowledged. */
export function importSharedSandboxes<T extends CopyableDocument>(
  saved: readonly SavedSandboxCopy<T>[],
  inbox: readonly SharedSandboxInboxItem<T>[],
  newId: () => string,
  now: string,
): { saved: SavedSandboxCopy<T>[]; acknowledgedIds: string[] } {
  const next = saved.map((item) => item);
  const acknowledgedIds: string[] = [];
  for (const item of inbox) {
    acknowledgedIds.push(item.id);
    if (next.some((existing) => existing.sourceShareId === item.id)) continue;
    const taken = new Set(next.map((existing) => existing.name.trim().toLowerCase()));
    const name = chooseCopyName(item.name, item.senderUsername, (candidate) =>
      taken.has(candidate.trim().toLowerCase()),
    );
    const id = newId();
    next.push({
      id,
      name,
      updatedAt: now,
      sourceShareId: item.id,
      document: { ...item.document, id, name, dirty: false },
    });
  }
  return { saved: next, acknowledgedIds };
}
