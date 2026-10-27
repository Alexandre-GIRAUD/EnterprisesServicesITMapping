import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg';
import type { ChatCitationDto, ChatHistoryMessageDto, GraphFilters } from '@/types/api';
import { askMappingChat } from '@/features/map/api/mappingChatApi';
import { appliedFiltersFromChat } from '@/features/map/utils/chatAppliedFilters';
import { layoutChatAnswer, type ChatAnswerLine } from '@/features/map/utils/chatAnswerLayout';
import { navigateToModuleGraph, type MapLocationState } from '@/features/map/utils/mapNavigation';

type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitationDto[];
  warnings?: string[];
  appliedFilters?: GraphFilters;
};

const HISTORY_TURN_LIMIT = 10;
const FAILED_ANSWER = 'Sorry, I could not answer. Check the LLM configuration or try again.';
const SUGGESTIONS = ['Which apps handle payments?', 'Who is connected to ', 'What does ', 'Clear the map filters'];

export function ChatPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, isBusy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || isBusy) return;
    const history: ChatHistoryMessageDto[] = turns.map(({ role, content }) => ({ role, content }));
    setInput('');
    setError(null);
    setTurns((previous) => [...previous, { role: 'user', content: message }]);
    setIsBusy(true);
    try {
      const response = await askMappingChat(message, history.slice(-HISTORY_TURN_LIMIT));
      const answer: ChatTurn = {
        role: 'assistant',
        content: response.answerMarkdown,
        citations: response.citations,
        warnings: response.warnings,
        appliedFilters: appliedFiltersFromChat(response.appliedFilters) ?? undefined,
      };
      setTurns((previous) => [...previous, answer]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chat request failed.');
      setTurns((previous) => [...previous, { role: 'assistant', content: FAILED_ANSWER }]);
    } finally {
      setIsBusy(false);
    }
  }

  function openCitation(citation: ChatCitationDto) {
    navigateToModuleGraph(navigate, citation.id, citation.label);
  }

  function openFiltersOnMap(filters: GraphFilters) {
    navigate('/map', {
      state: { graphMode: 'normal', applySnapshot: filters } satisfies MapLocationState,
    });
  }

  const isEmpty = turns.length === 0;

  return (
    <div className="chat-page">
      <header className="chat-page-header">
        <h1>Chatbot</h1>
      </header>

      <section className={`chat-conversation${isEmpty ? ' is-empty' : ''}`} aria-label="Conversation">
        {isEmpty ? (
          <div className="chat-empty">
            <img src={flowraLogo} alt="" className="chat-empty-logo" aria-hidden />
            <h2 className="chat-empty-title">How can I help you today?</h2>
          </div>
        ) : (
          <div className="chat-transcript">
            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <div key={index} className="chat-message chat-message--user">
                  <p>{turn.content}</p>
                </div>
              ) : (
                <AssistantMessage
                  key={index}
                  turn={turn}
                  onCitation={openCitation}
                  onOpenFilters={openFiltersOnMap}
                />
              ),
            )}
            {isBusy ? (
              <div className="chat-message chat-message--assistant">
                <FlowraAvatar />
                <p className="chat-thinking">Thinking…</p>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
        {error ? (
          <p className="chat-error" role="alert">
            {error}
          </p>
        ) : null}
        <ChatComposer value={input} isBusy={isBusy} onChange={setInput} onSend={() => void send(input)} />
        {isEmpty ? (
          <div className="chat-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chat-suggestion"
                onClick={() => setInput(suggestion)}
              >
                {suggestion.endsWith(' ') ? `${suggestion}…` : suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function FlowraAvatar() {
  return <img src={flowraLogo} alt="" className="chat-avatar" aria-hidden />;
}

function AssistantMessage({
  turn,
  onCitation,
  onOpenFilters,
}: {
  turn: ChatTurn;
  onCitation: (citation: ChatCitationDto) => void;
  onOpenFilters: (filters: GraphFilters) => void;
}) {
  const { appliedFilters, warnings = [] } = turn;
  return (
    <div className="chat-message chat-message--assistant">
      <FlowraAvatar />
      <div className="chat-answer">
        {layoutChatAnswer(turn.content, turn.citations ?? []).map((line, index) => (
          <AnswerLine key={index} line={line} onCitation={onCitation} />
        ))}
        {warnings.length > 0 ? (
          <ul className="chat-warnings">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        {appliedFilters ? (
          <button type="button" className="chat-map-link" onClick={() => onOpenFilters(appliedFilters)}>
            Open on the map
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AnswerLine({
  line,
  onCitation,
}: {
  line: ChatAnswerLine;
  onCitation: (citation: ChatCitationDto) => void;
}) {
  if (line.kind === 'gap') return <div className="chat-line-gap" />;
  return (
    <div className={`chat-line chat-line--${line.kind} chat-line--d${line.depth}`}>
      <span>{formatBold(line.text)}</span>
      {line.citations.map((citation) => (
        <CitationChip key={citation.id} citation={citation} onCitation={onCitation} />
      ))}
    </div>
  );
}

function CitationChip({
  citation,
  onCitation,
}: {
  citation: ChatCitationDto;
  onCitation: (citation: ChatCitationDto) => void;
}) {
  if (citation.type === 'EDGE') {
    return <span className="chat-citation">Edge · {citation.label}</span>;
  }
  const kind = citation.type === 'FUNCTIONAL_DOC' ? 'Doc' : 'App';
  return (
    <button type="button" className="chat-citation" title={citation.label} onClick={() => onCitation(citation)}>
      {kind} · {citation.label}
    </button>
  );
}

function formatBold(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function ChatComposer({
  value,
  isBusy,
  onChange,
  onSend,
}: {
  value: string;
  isBusy: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <textarea
        className="chat-composer-input"
        rows={2}
        autoFocus
        value={value}
        disabled={isBusy}
        placeholder="Ask Flowra…"
        aria-label="Message"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) return;
          event.preventDefault();
          onSend();
        }}
      />
      <button
        type="submit"
        className="chat-composer-send"
        disabled={isBusy || !value.trim()}
        aria-label="Send message"
      >
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );
}
