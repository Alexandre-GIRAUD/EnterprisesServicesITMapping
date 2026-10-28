import { useEffect, useState } from 'react';
import type { AttributeChangeEventDto, AuditTargetType } from '@/types/api';
import {
  fetchApplicationHistory,
  fetchAttributeHistory,
  HUMAN_REASON_LABEL,
} from '../api/attributeAuditApi';
import { linkEventSummary } from '../utils/historyEventSummary';

const PAGE_SIZE = 50;

type AttributeHistorySectionProps = {
  targetType: AuditTargetType;
  targetId: string | null;
  enabled: boolean;
  /** Bump to reload after a successful save. */
  refreshKey?: number;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function displayValue(value: string | null): string {
  if (value == null || value.trim() === '') return '(cleared)';
  return value;
}

function actorLabel(event: AttributeChangeEventDto): string {
  if (event.actorType === 'HUMAN') {
    const who = event.actorUsername?.trim();
    return who ? `HUMAN · ${who}` : 'HUMAN';
  }
  const src = event.aiSource?.trim();
  return src ? `AI · ${src}` : 'AI';
}

function reasonLabel(event: AttributeChangeEventDto): string | null {
  if (event.actorType !== 'HUMAN' || !event.humanReason) return null;
  const base = HUMAN_REASON_LABEL[event.humanReason] ?? event.humanReason;
  if (event.humanReason === 'Others' && event.humanReasonComment?.trim()) {
    return `${base}: ${event.humanReasonComment.trim()}`;
  }
  return base;
}

/**
 * Chronological change history for application / edge drawers. An application lists its own
 * changes plus those of its modules and flows. Collapsed until the heading is opened.
 */
export function AttributeHistorySection({
  targetType,
  targetId,
  enabled,
  refreshKey = 0,
}: AttributeHistorySectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<AttributeChangeEventDto[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isApplication = targetType === 'APPLICATION';

  function fetchPage(id: string, pageIndex: number) {
    return isApplication
      ? fetchApplicationHistory(id, pageIndex, PAGE_SIZE)
      : fetchAttributeHistory(targetType, id, pageIndex, PAGE_SIZE);
  }

  useEffect(() => {
    if (!enabled || !isOpen || !targetId) {
      setItems([]);
      setTotal(0);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    void loadAll(targetId)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load history.');
        setItems([]);
        setTotal(0);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPage only reads these deps
  }, [enabled, isOpen, targetId, targetType, refreshKey]);

  async function loadAll(id: string) {
    const collected: AttributeChangeEventDto[] = [];
    let pageIndex = 0;
    let totalCount = 0;
    let more = true;
    while (more) {
      const data = await fetchPage(id, pageIndex);
      collected.push(...data.items);
      totalCount = data.totalElements;
      more = data.hasMore;
      pageIndex += 1;
    }
    return { items: collected, total: totalCount };
  }

  return (
    <section className="graph-details-section attribute-history-section" aria-label="History">
      <h3 className="graph-details-section-title">
        <button
          type="button"
          className="attribute-history-toggle"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className={`attribute-history-chevron${isOpen ? ' is-open' : ''}`} aria-hidden="true" />
          History{isOpen && total > 0 ? ` (${total})` : ''}
        </button>
      </h3>

      {!isOpen ? null : !enabled ? (
        <p className="graph-details-text attribute-history-section__disabled">
          History is not recorded in sandbox.
        </p>
      ) : status === 'loading' && items.length === 0 ? (
        <p className="graph-details-text">Loading history…</p>
      ) : status === 'error' && items.length === 0 ? (
        <p className="graph-details-text graph-details-text-error">
          {errorMessage ?? 'Unable to load history.'}
        </p>
      ) : items.length === 0 ? (
        <p className="graph-details-text">No changes recorded.</p>
      ) : (
        <>
          <ul className="attribute-history-list">
            {items.map((event) => {
              const isLink = event.fieldKey === '__link__';
              const link = isLink ? linkEventSummary(event) : null;
              return (
              <li key={event.id} className="attribute-history-item">
                <div className="attribute-history-item__meta">
                  <span
                    className={`attribute-history-badge attribute-history-badge--${event.actorType.toLowerCase()}`}
                  >
                    {actorLabel(event)}
                  </span>
                  <time dateTime={event.createdAt}>{formatWhen(event.createdAt)}</time>
                </div>
                {link ? (
                  <>
                    <p className="attribute-history-item__field">
                      <strong>{link.title}</strong>
                    </p>
                    {link.detail ? (
                      <p className="attribute-history-item__diff">{link.detail}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="attribute-history-item__field">
                      <strong>{event.fieldKey}</strong>
                    </p>
                    <p className="attribute-history-item__diff">
                      <span className="attribute-history-old">{displayValue(event.oldValue)}</span>
                      <span aria-hidden="true"> → </span>
                      <span className="attribute-history-new">{displayValue(event.newValue)}</span>
                    </p>
                  </>
                )}
                {reasonLabel(event) ? (
                  <p className="attribute-history-item__reason">{reasonLabel(event)}</p>
                ) : null}
              </li>
              );
            })}
          </ul>
          {errorMessage ? (
            <p className="graph-details-text graph-details-text-error">{errorMessage}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
