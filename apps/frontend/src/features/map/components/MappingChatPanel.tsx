import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatAskResponseDto, ChatCitationDto, ChatHistoryMessageDto } from '@/types/api';
import { askMappingChat } from '../api/mappingChatApi';
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
};

/** Lightweight markdown-ish rendering: paragraphs + bullets + bold **text**. */
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

export function MappingChatPanel({ onFocusApplication, onFocusEdge }: MappingChatPanelProps) {
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
      const res: ChatAskResponseDto = await askMappingChat(message, history.slice(-10));
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
          content: "Désolé, je n'ai pas pu répondre. Vérifiez la configuration LLM ou réessayez.",
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
    <section className="mapping-chat-panel" aria-label="IT mapping chat">
      <p className="mapping-chat-lead">
        Posez une question sur le graphe Production ou la documentation fonctionnelle (ex. « Qui
        est connecté à … ? », « Que fait … ? »).
      </p>

      <div className="mapping-chat-transcript">
        {turns.length === 0 ? (
          <p className="mapping-chat-hint">Aucune conversation pour l’instant.</p>
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
        {busy ? <p className="mapping-chat-hint">Réflexion…</p> : null}
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
          placeholder="Votre question…"
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
          <span className="graph-drawer-action-title">{busy ? '…' : 'Envoyer'}</span>
        </button>
      </form>
    </section>
  );
}
