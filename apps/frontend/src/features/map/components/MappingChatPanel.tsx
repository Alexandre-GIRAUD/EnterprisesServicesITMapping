import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatAskResponseDto, ChatCitationDto, ChatHistoryMessageDto, GraphFilters } from '@/types/api';
import { askMappingChat } from '../api/mappingChatApi';
import { appliedFiltersFromChat } from '../utils/chatAppliedFilters';
import { navigateToModuleGraph } from '../utils/mapNavigation';
import { chatSuggestionDraft } from './mappingChatSuggestions';
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

const MAPPING_CHAT_SUGGESTIONS = [
  'Which applications manage payments?',
  'Which applications are connected to…',
  'What does an application do?',
] as const;

function renderAnswer(text: string) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split('\n');
    const isList = lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l) || l.trim() === '');
    if (isList) {
      return (
        <ul key={i} className="mapping-chat-list">
          {lines
            .filter((l) => l.trim())
            .map((l, j) => (
              <li key={j}>{inlineFormat(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>
            ))}
        </ul>
      );
    }
    if (/^##\s+/.test(block.trim())) {
      return (
        <h4 key={i} className="mapping-chat-heading">
          {inlineFormat(block.trim().replace(/^##\s+/, ''))}
        </h4>
      );
    }
    return (
      <p key={i} className="mapping-chat-paragraph">
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 ? <br /> : null}
            {inlineFormat(line)}
          </span>
        ))}
      </p>
    );
  });
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  async function handleSend(raw?: string) {
    const message = (raw ?? input).trim();
    if (!message || busy) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = '';
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

  function askSuggestion(text: string) {
    const next = chatSuggestionDraft(text);
    if (!next.shouldSend) {
      setInput(next.draft);
      const field = inputRef.current;
      if (field) {
        field.focus();
        field.style.height = 'auto';
        field.style.height = `${field.scrollHeight}px`;
      }
      return;
    }
    void handleSend(next.draft);
  }

  return (
    <section className="mapping-chat-panel" aria-label="Ask anything">
      <div className="mapping-chat-transcript">
        {turns.length === 0 ? (
          <ul className="mapping-chat-suggestions">
            {MAPPING_CHAT_SUGGESTIONS.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="mapping-chat-suggestion"
                  onClick={() => askSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
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
                renderAnswer(turn.content)
              )}
              {turn.warnings && turn.warnings.length > 0 ? (
                <ul className="mapping-chat-warnings">
                  {turn.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              {turn.citations && turn.citations.length > 0 ? (
                <div className="mapping-chat-citations">
                  {turn.citations.map((c) => (
                    <button
                      key={`${c.type}:${c.id}`}
                      type="button"
                      className="mapping-chat-citation"
                      onClick={() => handleCitation(c)}
                      title={`${c.type} ${c.id}`}
                    >
                      {c.type === 'EDGE' ? 'Edge' : c.type === 'FUNCTIONAL_DOC' ? 'Doc' : 'App'} ·{' '}
                      {c.label}
                    </button>
                  ))}
                </div>
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
        <div className="mapping-chat-field">
          <textarea
            ref={inputRef}
            className="mapping-chat-input"
            rows={2}
            value={input}
            disabled={busy}
            placeholder="Ask anything"
            onChange={(e) => {
              setInput(e.target.value);
              const field = e.target;
              field.style.height = 'auto';
              field.style.height = `${field.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <button
            type="submit"
            className="mapping-chat-send"
            disabled={busy || !input.trim()}
            aria-label="Send"
          >
            <SendMark />
          </button>
        </div>
      </form>
    </section>
  );
}

function SendMark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
