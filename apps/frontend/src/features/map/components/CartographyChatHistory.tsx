import { useEffect, useRef, useState, type ReactNode } from 'react';
import flowraLogo from '@/assets/flowra.svg';
import type { ChatHistoryMessageDto, GraphFilters } from '@/types/api';
import { askMappingChat } from '@/features/map/api/mappingChatApi';
import { appliedFiltersFromChat } from '@/features/map/utils/chatAppliedFilters';
import { layoutChatAnswer } from '@/features/map/utils/chatAnswerLayout';
import type { CartographyChatTurn } from '../utils/mapNavigation';

const HISTORY_TURN_LIMIT = 10;
const FAILED_ANSWER = 'Sorry, I could not answer. Check the LLM configuration or try again.';

export function CartographyChatHistory({
  turns,
  onTurnsChange,
  currentFilters,
  onApplyFilters,
}: {
  turns: CartographyChatTurn[];
  onTurnsChange: (turns: CartographyChatTurn[]) => void;
  currentFilters?: GraphFilters;
  onApplyFilters: (filters: GraphFilters) => void;
}) {
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, isBusy]);

  async function send() {
    const message = input.trim();
    if (!message || isBusy) return;
    const history: ChatHistoryMessageDto[] = turns.map(({ role, content }) => ({ role, content }));
    const withUser: CartographyChatTurn[] = [...turns, { role: 'user', content: message }];
    setInput('');
    setError(null);
    onTurnsChange(withUser);
    setIsBusy(true);
    try {
      const response = await askMappingChat(message, history.slice(-HISTORY_TURN_LIMIT), currentFilters);
      const appliedFilters = appliedFiltersFromChat(response.appliedFilters);
      onTurnsChange([
        ...withUser,
        {
          role: 'assistant',
          content: response.answerMarkdown,
          warnings: response.warnings,
        },
      ]);
      if (appliedFilters) onApplyFilters(appliedFilters);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chat request failed.');
      onTurnsChange([...withUser, { role: 'assistant', content: FAILED_ANSWER }]);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="cartography-chat">
      <div className="cartography-chat-history" aria-label="Chat">
        {turns.length === 0 ? (
          <div className="chat-empty cartography-chat-empty">
            <img src={flowraLogo} alt="" className="chat-empty-logo" aria-hidden />
            <h2 className="chat-empty-title">How can I help you today?</h2>
          </div>
        ) : (
          turns.map((turn, index) =>
            turn.role === 'user' ? (
              <div key={index} className="chat-message chat-message--user">
                <p>{turn.content}</p>
              </div>
            ) : (
              <div key={index} className="chat-message chat-message--assistant">
                <img src={flowraLogo} alt="" className="chat-avatar" aria-hidden />
                <div className="chat-answer">
                  {layoutChatAnswer(turn.content).map((line, lineIndex) =>
                    line.kind === 'gap' ? (
                      <div key={lineIndex} className="chat-line-gap" />
                    ) : (
                      <div key={lineIndex} className={`chat-line chat-line--${line.kind} chat-line--d${line.depth}`}>
                        <span>{formatBold(line.text)}</span>
                      </div>
                    ),
                  )}
                  {turn.warnings && turn.warnings.length > 0 ? (
                    <ul className="chat-warnings">
                      {turn.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ),
          )
        )}
        {isBusy ? (
          <div className="chat-message chat-message--assistant">
            <img src={flowraLogo} alt="" className="chat-avatar" aria-hidden />
            <p className="chat-thinking">Thinking…</p>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
      {error ? (
        <p className="chat-error" role="alert">
          {error}
        </p>
      ) : null}
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          className="chat-composer-input"
          rows={2}
          value={input}
          disabled={isBusy}
          placeholder="Ask Flowra…"
          aria-label="Message"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            void send();
          }}
        />
        <button
          type="submit"
          className="chat-composer-send"
          disabled={isBusy || !input.trim()}
          aria-label="Send message"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
            <path
              d="M10 16V4M4.5 9.5 10 4l5.5 5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
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
