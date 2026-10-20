export function chatSuggestionDraft(text: string): { send: boolean; draft: string } {
  if (text.endsWith('…')) return { send: false, draft: text.slice(0, -1).trimEnd() };
  return { send: true, draft: text };
}
