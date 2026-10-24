export function chatSuggestionDraft(text: string): { shouldSend: boolean; draft: string } {
  const ELLIPSIS = '…';
  if (text.endsWith(ELLIPSIS)) {
    return { shouldSend: false, draft: text.slice(0, -ELLIPSIS.length).trimEnd() };
  }
  return { shouldSend: true, draft: text };
}
