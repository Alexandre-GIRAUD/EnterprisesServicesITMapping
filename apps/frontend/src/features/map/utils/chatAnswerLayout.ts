import type { ChatCitationDto } from '@/types/api';

export type ChatAnswerLine = {
  kind: 'gap' | 'section' | 'text' | 'item';
  depth: number;
  text: string;
  citations: ChatCitationDto[];
};

const ATTRIBUTE_LINE = /^(data|frequency|channel|kind|connection kind)\b/i;
const PEER_LINE = /^(to|from)\b/i;
const SECTION_LINE = /^(outbound|inbound)\b/i;

/** Indent a connection answer and attach each citation to the peer line that names it. */
export function layoutChatAnswer(text: string, citations: ChatCitationDto[] = []): ChatAnswerLine[] {
  const lines = text.split('\n').map(toLine).filter((line) => line.kind !== 'gap' || line.text === '');
  const condensed = collapseGaps(lines);
  attachCitations(condensed, citationsNamedIn(text, citations));
  return condensed;
}

function citationsNamedIn(text: string, citations: ChatCitationDto[]): ChatCitationDto[] {
  const answer = text.toLowerCase();
  return citations.filter((citation) => isNamedInAnswer(answer, citation));
}

function isNamedInAnswer(answer: string, citation: ChatCitationDto): boolean {
  if (citation.type !== 'EDGE') {
    return containsName(answer, citation.label);
  }
  const ends = edgeEnds(citation.label);
  if (!ends) return containsName(answer, citation.label);
  return containsName(answer, ends.left) && containsName(answer, ends.right);
}

function containsName(answer: string, name: string): boolean {
  const needle = name.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!needle) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${needle}(?![\\p{L}\\p{N}])`, 'u').test(answer);
}

function toLine(raw: string): ChatAnswerLine {
  if (raw.trim() === '') {
    return { kind: 'gap', depth: 0, text: '', citations: [] };
  }
  const bullet = raw.match(/^(\s*)(?:[-*]|\d+\.)\s+(.*)$/);
  const text = (bullet ? bullet[2] : raw.trim()).replace(/^#{1,6}\s+/, '');
  const spaces = bullet ? bullet[1].replace(/\t/g, '  ').length : leadingSpaces(raw);
  let depth = Math.floor(spaces / 2);
  const plain = text.replace(/\*\*/g, '').trim();
  if (depth === 0 && PEER_LINE.test(plain)) depth = 1;
  if (depth === 0 && ATTRIBUTE_LINE.test(plain)) depth = 2;
  const kind = SECTION_LINE.test(plain) ? 'section' : bullet || depth > 0 ? 'item' : 'text';
  return { kind, depth, text, citations: [] };
}

function leadingSpaces(raw: string): number {
  return raw.match(/^ */)?.[0].length ?? 0;
}

function collapseGaps(lines: ChatAnswerLine[]): ChatAnswerLine[] {
  const out: ChatAnswerLine[] = [];
  for (const line of lines) {
    if (line.kind === 'gap' && (out.length === 0 || out[out.length - 1]?.kind === 'gap')) continue;
    out.push(line);
  }
  if (out[out.length - 1]?.kind === 'gap') out.pop();
  return out;
}

function attachCitations(lines: ChatAnswerLine[], citations: ChatCitationDto[]) {
  const used = new Set<string>();
  for (const line of lines) {
    const plain = line.text.replace(/\*\*/g, '').trim();
    const to = plain.match(/^to\s+(.+?)\s*:?$/i);
    const from = plain.match(/^from\s+(.+?)\s*:?$/i);
    const peer = (to?.[1] ?? from?.[1])?.trim().toLowerCase();
    if (!peer) continue;
    line.citations = citations.filter((citation) => {
      if (used.has(citation.id) || citation.type !== 'EDGE') return false;
      const ends = edgeEnds(citation.label);
      if (!ends) return false;
      const side = (to ? ends.right : ends.left).toLowerCase();
      return side === peer;
    });
    for (const citation of line.citations) used.add(citation.id);
  }
}

function edgeEnds(label: string): { left: string; right: string } | null {
  const parts = label.split(/\s*(?:→|->)\s*/);
  if (parts.length !== 2) return null;
  const left = parts[0]?.trim() ?? '';
  const right = parts[1]?.trim() ?? '';
  if (!left || !right) return null;
  return { left, right };
}
