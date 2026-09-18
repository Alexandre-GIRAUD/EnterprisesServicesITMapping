import { type FormEvent, useEffect, useState } from 'react';
import type { CommentDto, CommentTargetType } from '@/types/api';
import {
  COMMENT_MAX_BODY,
  clampCommentBody,
  createComment,
  deleteComment,
  fetchComments,
  updateComment,
} from '../api/commentsApi';

type CommentsSectionProps = {
  targetType: CommentTargetType;
  targetId: string | null;
  enabled: boolean;
};

function formatCommentWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Shared comments panel for ApplicationDetailsDrawer and EdgeDetailsDrawer.
 */
export function CommentsSection({ targetType, targetId, enabled }: CommentsSectionProps) {
  const [items, setItems] = useState<CommentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !targetId) {
      setItems([]);
      setTotal(0);
      setPage(0);
      setHasMore(false);
      setStatus('idle');
      setErrorMessage(null);
      setDraft('');
      setEditingId(null);
      setConfirmDeleteId(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);
    setEditingId(null);
    setConfirmDeleteId(null);
    setPage(0);

    void fetchComments(targetType, targetId, 0, 20)
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
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load comments.');
        setItems([]);
        setTotal(0);
        setHasMore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, targetId, targetType]);

  async function onPost(event: FormEvent) {
    event.preventDefault();
    if (!enabled || !targetId || posting) return;
    const body = clampCommentBody(draft);
    if (!body) return;
    setPosting(true);
    setErrorMessage(null);
    try {
      const created = await createComment({ targetType, targetId, body });
      setItems((prev) => [created, ...prev]);
      setTotal((n) => n + 1);
      setDraft('');
      setStatus('ready');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setPosting(false);
    }
  }

  async function onLoadMore() {
    if (!enabled || !targetId || !hasMore || status === 'loading') return;
    const nextPage = page + 1;
    setStatus('loading');
    try {
      const data = await fetchComments(targetType, targetId, nextPage, 20);
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.totalElements);
      setHasMore(data.hasMore);
      setPage(data.page);
      setStatus('ready');
    } catch (err: unknown) {
      setStatus('ready');
      setErrorMessage(err instanceof Error ? err.message : 'Unable to load more comments.');
    }
  }

  async function onSaveEdit(id: string) {
    const body = clampCommentBody(editDraft);
    if (!body) return;
    setSavingId(id);
    setErrorMessage(null);
    try {
      const updated = await updateComment(id, { body });
      setItems((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to update comment.');
    } finally {
      setSavingId(null);
    }
  }

  async function onConfirmDelete(id: string) {
    setSavingId(id);
    setErrorMessage(null);
    try {
      await deleteComment(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      setTotal((n) => Math.max(0, n - 1));
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to delete comment.');
    } finally {
      setSavingId(null);
    }
  }

  const draftLen = draft.length;
  const canPost = enabled && Boolean(targetId) && clampCommentBody(draft).length > 0 && !posting;

  return (
    <section className="graph-details-section comments-section" aria-label="Comments">
      <h3 className="graph-details-section-title">
        Comments{total > 0 ? ` (${total})` : ''}
      </h3>

      {!enabled ? (
        <p className="graph-details-text comments-section__disabled">
          Comments are not available in sandbox.
        </p>
      ) : (
        <>
          <form className="comments-composer" onSubmit={(e) => void onPost(e)}>
            <label className="graph-drawer-field">
              <span className="visually-hidden">Add a comment</span>
              <textarea
                className="graph-drawer-input graph-drawer-textarea comments-composer__input"
                placeholder="Add a comment…"
                value={draft}
                maxLength={COMMENT_MAX_BODY}
                rows={3}
                disabled={posting || !targetId}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <div className="comments-composer__footer">
              <span className="comments-composer__count" aria-live="polite">
                {draftLen}/{COMMENT_MAX_BODY}
              </span>
              <button
                type="submit"
                className="graph-drawer-action graph-drawer-action-primary comments-composer__post"
                disabled={!canPost}
              >
                <span className="graph-drawer-action-title">{posting ? 'Posting…' : 'Post'}</span>
              </button>
            </div>
          </form>

          {errorMessage ? (
            <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {status === 'loading' && items.length === 0 ? (
            <p className="graph-details-text">Loading comments…</p>
          ) : null}

          {status === 'error' && items.length === 0 ? (
            <p className="graph-details-text graph-details-text-error">Unable to load comments.</p>
          ) : null}

          {status === 'ready' && items.length === 0 ? (
            <p className="graph-details-text">No comments yet.</p>
          ) : null}

          {items.length > 0 ? (
            <ul className="comments-list">
              {items.map((comment) => {
                const isEditing = editingId === comment.id;
                const isBusy = savingId === comment.id;
                return (
                  <li key={comment.id} className="comments-item">
                    <div className="comments-item__meta">
                      <span className="comments-item__author">{comment.authorUsername}</span>
                      <span className="comments-item__sep" aria-hidden="true">
                        ·
                      </span>
                      <time dateTime={comment.createdAt} className="comments-item__when">
                        {formatCommentWhen(comment.createdAt)}
                      </time>
                      {comment.edited ? (
                        <span className="comments-item__edited">edited</span>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="comments-item__edit">
                        <textarea
                          className="graph-drawer-input graph-drawer-textarea"
                          value={editDraft}
                          maxLength={COMMENT_MAX_BODY}
                          rows={3}
                          disabled={isBusy}
                          onChange={(e) => setEditDraft(e.target.value)}
                        />
                        <div className="comments-item__actions">
                          <button
                            type="button"
                            className="graph-drawer-action graph-drawer-action-primary"
                            disabled={isBusy || !clampCommentBody(editDraft)}
                            onClick={() => void onSaveEdit(comment.id)}
                          >
                            <span className="graph-drawer-action-title">
                              {isBusy ? 'Saving…' : 'Save'}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="graph-drawer-action"
                            disabled={isBusy}
                            onClick={() => setEditingId(null)}
                          >
                            <span className="graph-drawer-action-title">Cancel</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="comments-item__body">{comment.body}</p>
                    )}

                    {!isEditing && (comment.canEdit || comment.canDelete) ? (
                      <div className="comments-item__actions">
                        {comment.canEdit ? (
                          <button
                            type="button"
                            className="comments-item__link"
                            disabled={isBusy}
                            onClick={() => {
                              setConfirmDeleteId(null);
                              setEditingId(comment.id);
                              setEditDraft(comment.body);
                            }}
                          >
                            Edit
                          </button>
                        ) : null}
                        {comment.canDelete ? (
                          confirmDeleteId === comment.id ? (
                            <>
                              <button
                                type="button"
                                className="comments-item__link comments-item__link--danger"
                                disabled={isBusy}
                                onClick={() => void onConfirmDelete(comment.id)}
                              >
                                {isBusy ? 'Deleting…' : 'Confirm delete'}
                              </button>
                              <button
                                type="button"
                                className="comments-item__link"
                                disabled={isBusy}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="comments-item__link comments-item__link--danger"
                              disabled={isBusy}
                              onClick={() => {
                                setEditingId(null);
                                setConfirmDeleteId(comment.id);
                              }}
                            >
                              Delete
                            </button>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {hasMore ? (
            <button
              type="button"
              className="graph-drawer-action comments-load-more"
              disabled={status === 'loading'}
              onClick={() => void onLoadMore()}
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
