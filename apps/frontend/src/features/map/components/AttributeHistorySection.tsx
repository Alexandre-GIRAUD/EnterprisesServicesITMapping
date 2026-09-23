import { useEffect, useState } from 'react';
import type { AttributeChangeEventDto, AuditTargetType } from '@/types/api';
import {
  fetchAttributeHistory,
  HUMAN_REASON_LABEL,
} from '../api/attributeAuditApi';

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

function linkEventSummary(event: AttributeChangeEventDto): { title: string; detail: string | null } {
  const created = !event.oldValue && Boolean(event.newValue);
  const deleted = Boolean(event.oldValue) && !event.newValue;
  const raw = created ? event.newValue : deleted ? event.oldValue : null;
  let detail: string | null = null;
  if (raw) {
    try {
      const snap = JSON.parse(raw) as {
        sourceId?: string;
        targetId?: string;
        type?: string;
        connection_kind?: string;
        channel?: string;
      };
      const parts = [
        snap.type,
        snap.connection_kind,
        snap.channel,
        snap.sourceId && snap.targetId ? `${snap.sourceId} → ${snap.targetId}` : null,
      ].filter(Boolean);
      detail = parts.join(' · ');
    } catch {
      detail = raw.slice(0, 120);
    }
  }
  if (created) return { title: 'Connection created', detail };
  if (deleted) return { title: 'Connection deleted', detail };
  return { title: 'Connection updated', detail };
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
 * Chronological attribute change history for application / edge drawers.
 */
export function AttributeHistorySection({
  targetType,
  targetId,
  enabled,
  refreshKey = 0,
}: AttributeHistorySectionProps) {
  const [items, setItems] = useState<AttributeChangeEventDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !targetId) {
      setItems([]);
      setTotal(0);
      setPage(0);
      setHasMore(false);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);
    setPage(0);

    void fetchAttributeHistory(targetType, targetId, 0, 20)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.totalElements);
        setHasMore(data.hasMore);
        setPage(data.page);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load history.');
        setItems([]);
        setTotal(0);
        setHasMore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, targetId, targetType, refreshKey]);

  async function onLoadMore() {
    if (!enabled || !targetId || !hasMore || status === 'loading') return;
    const nextPage = page + 1;
    setStatus('loading');
    try {
      const data = await fetchAttributeHistory(targetType, targetId, nextPage, 20);
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.totalElements);
      setHasMore(data.hasMore);
      setPage(data.page);
      setStatus('ready');
    } catch (err: unknown) {
      setStatus('ready');
      setErrorMessage(err instanceof Error ? err.message : 'Unable to load more history.');
    }
  }

  return (
    <section className="graph-details-section attribute-history-section" aria-label="History">
      <h3 className="graph-details-section-title">
        History{total > 0 ? ` (${total})` : ''}
      </h3>

      {!enabled ? (
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
        <p className="graph-details-text">No attribute changes recorded yet.</p>
      ) : (
        <>
          <ul className="attribute-history-list">
            {items.map((event) => {
              const isLink =
                event.fieldScope === 'EDGE_LINK' || event.fieldKey === '__link__';
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
          {hasMore ? (
            <button
              type="button"
              className="graph-drawer-action"
              onClick={() => void onLoadMore()}
              disabled={status === 'loading'}
            >
              <span className="graph-drawer-action-title">
                {status === 'loading' ? 'Loading…' : 'Load more'}
              </span>
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
