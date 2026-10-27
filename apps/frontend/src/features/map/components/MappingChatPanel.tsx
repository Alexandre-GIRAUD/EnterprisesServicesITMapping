import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatAskResponseDto, ChatCitationDto, ChatHistoryMessageDto, GraphFilters } from '@/types/api';
import { askMappingChat } from '../api/mappingChatApi';
import { appliedFiltersFromChat } from '../utils/chatAppliedFilters';
import { layoutChatAnswer, type ChatAnswerLine } from '../utils/chatAnswerLayout';
import { navigateToModuleGraph } from '../utils/mapNavigation';
import { useNavigate } from 'react-router-dom';

type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitationDto[];
  warnings?: string[];
};

type MappingChatPanelProps = {
  /** Focus / select an application node on the current map (Production). */
  onFocusApplication?: (applicationId: string) => void;
  /** Open edge details when an EDGE citation is clicked. */
  onFocusEdge?: (edgeId: string) => void;
  /** Filters currently shown on the Production map. */
  currentFilters?: GraphFilters;
  /** Replace those filters when the answer includes appliedFilters. */
  onApplyFilters?: (filters: GraphFilters) => void;
  /** Reload the Production map after a correction was written. */
  onGraphChanged?: () => void;
};

function renderAnswer(
  text: string,
  citations: ChatCitationDto[],
  onCitation: (citation: ChatCitationDto) => void
) {
  const lines = layoutChatAnswer(text, citations);
  return lines.map((line, index) => (
    <AnswerLine key={index} line={line} onCitation={onCitation} />
  ));
}

function AnswerLine({
  line,
  onCitation,
}: {
  line: ChatAnswerLine;
  onCitation: (citation: ChatCitationDto) => void;
}) {
  if (line.kind === 'gap') return <div className="mapping-chat-gap" />;
  const className = [
    'mapping-chat-line',
    `mapping-chat-line--d${line.depth}`,
    line.kind === 'section' ? 'mapping-chat-line--section' : '',
    line.kind === 'text' ? 'mapping-chat-line--text' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className}>
      <span>{inlineFormat(line.text)}</span>
      {line.citations.map((citation) => (
        <CitationButton key={citation.id} citation={citation} onCitation={onCitation} />
      ))}
    </div>
  );
}

function CitationButton({
  citation,
  onCitation,
}: {
  citation: ChatCitationDto;
  onCitation: (citation: ChatCitationDto) => void;
}) {
  const kind = citation.type === 'EDGE' ? 'Edge' : citation.type === 'FUNCTIONAL_DOC' ? 'Doc' : 'App';
  return (
    <button
      type="button"
      className="mapping-chat-citation"
      onClick={() => onCitation(citation)}
      title={citation.label}
    >
      {kind} · {citation.label}
    </button>
  );
}

function inlineFormat(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function MappingChatPanel({
  onFocusApplication,
  onFocusEdge,
  currentFilters,
  onApplyFilters,
  onGraphChanged,
}: MappingChatPanelProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  async function handleSend() {
    const message = input.trim();
    if (!message || busy) return;
    setInput('');
    setError(null);
    const history: ChatHistoryMessageDto[] = turns.map((t) => ({
      role: t.role,
      content: t.content,
    }));
    setTurns((prev) => [...prev, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const res: ChatAskResponseDto = await askMappingChat(
        message,
        history.slice(-10),
        currentFilters
      );
      const nextFilters = appliedFiltersFromChat(res.appliedFilters);
      if (nextFilters && onApplyFilters) {
        onApplyFilters(nextFilters);
      }
      if (res.graphChanged && onGraphChanged) {
        onGraphChanged();
      }
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answerMarkdown,
          citations: res.citations,
          warnings: res.warnings,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat request failed.');
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I could not answer. Check the LLM configuration or try again.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handleCitation(c: ChatCitationDto) {
    if (c.type === 'APPLICATION' || c.type === 'FUNCTIONAL_DOC') {
      if (onFocusApplication) {
        onFocusApplication(c.id);
      } else {
        navigateToModuleGraph(navigate, c.id, c.label);
      }
      return;
    }
    if (c.type === 'EDGE' && onFocusEdge) {
      onFocusEdge(c.id);
    }
  }

  return (
    <section className="mapping-chat-panel" aria-label="Ask Flora">
      <p className="mapping-chat-lead">
        Ask a question about the Production graph or the functional documentation (for example
        “Who is connected to …?”, “What does … do?”, “Which apps handle payments?”). You can also
        ask to apply, change, or clear the map filters.
      </p>

      <div className="mapping-chat-transcript">
        {turns.length === 0 ? (
          <p className="mapping-chat-hint">No conversation yet.</p>
        ) : (
          turns.map((turn, i) => (
            <div
              key={i}
              className={
                turn.role === 'user'
                  ? 'mapping-chat-bubble mapping-chat-bubble--user'
                  : 'mapping-chat-bubble mapping-chat-bubble--assistant'
              }
            >
              {turn.role === 'user' ? (
                <p className="mapping-chat-paragraph">{turn.content}</p>
              ) : (
                renderAnswer(turn.content, turn.citations ?? [], handleCitation)
              )}
              {turn.warnings && turn.warnings.length > 0 ? (
                <ul className="mapping-chat-warnings">
                  {turn.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        )}
        {busy ? <p className="mapping-chat-hint">Thinking…</p> : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="mapping-chat-error" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="mapping-chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <textarea
          className="mapping-chat-input"
          rows={3}
          value={input}
          disabled={busy}
          placeholder="Your question…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          type="submit"
          className="graph-drawer-action graph-drawer-action-primary mapping-chat-send"
          disabled={busy || !input.trim()}
        >
          <span className="graph-drawer-action-title">{busy ? '…' : 'Send'}</span>
        </button>
      </form>
    </section>
  );
}
