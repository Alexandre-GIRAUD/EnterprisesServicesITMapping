import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { AuditTargetType } from '@/types/api';
import {
  confirmEntityValidation,
  fetchEntityValidation,
  type EntityValidation,
} from '../api/entityValidationApi';

type DrawerSignOff = {
  line: ReactNode;
  button: ReactNode;
  dialog: ReactNode;
};

export function useDrawerSignOff(
  targetType: AuditTargetType,
  targetId: string | null,
  enabled: boolean
): DrawerSignOff {
  const [stamp, setStamp] = useState<EntityValidation | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validateRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    setStamp(null);
    setIsOpen(false);
    if (!enabled || !targetId) return;
    let cancelled = false;
    fetchEntityValidation(targetType, targetId)
      .then((row) => {
        if (!cancelled) setStamp(row);
      })
      .catch(() => {
        if (!cancelled) setStamp(null);
      });
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId, enabled]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = window.setTimeout(() => validateRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [isOpen]);

  async function confirm() {
    if (!targetId || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const saved = await confirmEntityValidation(targetType, targetId);
      setStamp(saved);
      setIsOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to validate.');
    } finally {
      setIsSaving(false);
    }
  }

  const line =
    enabled && stamp ? (
      <p className="graph-details-id">
        Last validated by {stamp.username} on {formatSignOffDate(stamp.validatedAt)}
      </p>
    ) : null;

  const button =
    enabled && targetId ? (
      <button
        type="button"
        className="graph-drawer-signoff"
        aria-label="Validate the data in this panel"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
      >
        <EyeIcon />
      </button>
    ) : null;

  const dialog =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="save-snapshot-dialog-backdrop"
            role="presentation"
            onClick={() => {
              if (!isSaving) setIsOpen(false);
            }}
          >
            <div
              className="save-snapshot-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id={titleId} className="save-snapshot-dialog-title">
                Validate this data?
              </h2>
              <p className="save-snapshot-dialog-hint">
                This records you as having validated the data shown in the panel.
              </p>
              {error ? <p className="save-snapshot-dialog-error">{error}</p> : null}
              <div className="save-snapshot-dialog-actions">
                <button
                  type="button"
                  className="save-snapshot-dialog-btn save-snapshot-dialog-btn--secondary"
                  onClick={() => setIsOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  ref={validateRef}
                  type="button"
                  className="save-snapshot-dialog-btn save-snapshot-dialog-btn--primary"
                  onClick={() => void confirm()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Validating…' : 'Validate'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return { line, button, dialog };
}

function formatSignOffDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
