import type { AttributeChangeMeta, HumanChangeReason } from '@/types/api';
import {
  HUMAN_CHANGE_REASON_OPTIONS,
  REASON_COMMENT_MAX,
} from '../api/attributeAuditApi';

type AttributeChangeReasonFieldsProps = {
  reason: HumanChangeReason | '';
  reasonComment: string;
  onReasonChange: (reason: HumanChangeReason | '') => void;
  onCommentChange: (comment: string) => void;
  disabled?: boolean;
  required?: boolean;
};

/**
 * Reason select + optional Others comment for human attribute edits.
 */
export function AttributeChangeReasonFields({
  reason,
  reasonComment,
  onReasonChange,
  onCommentChange,
  disabled = false,
  required = true,
}: AttributeChangeReasonFieldsProps) {
  const needsComment = reason === 'Others';

  return (
    <fieldset className="graph-drawer-field graph-drawer-fieldset attribute-change-reason">
      <legend className="graph-drawer-field-label">
        Change reason{required ? ' *' : ''}
      </legend>
      <label className="graph-drawer-field">
        <span className="visually-hidden">Reason</span>
        <select
          className="graph-drawer-input"
          value={reason}
          onChange={(e) =>
            onReasonChange((e.target.value || '') as HumanChangeReason | '')
          }
          disabled={disabled}
          required={required}
        >
          <option value="">Select a reason…</option>
          {HUMAN_CHANGE_REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {needsComment ? (
        <label className="graph-drawer-field">
          <span className="graph-drawer-field-label">Comment *</span>
          <textarea
            className="graph-drawer-input graph-drawer-textarea"
            value={reasonComment}
            onChange={(e) => onCommentChange(e.target.value.slice(0, REASON_COMMENT_MAX))}
            maxLength={REASON_COMMENT_MAX}
            rows={3}
            disabled={disabled}
            required
            placeholder="Describe why this change is needed…"
          />
          <span className="graph-drawer-field-hint">
            {reasonComment.length}/{REASON_COMMENT_MAX}
          </span>
        </label>
      ) : null}
      <p className="graph-drawer-field-hint">
        Required when you change Data Model attributes. Sandbox edits are not recorded.
      </p>
    </fieldset>
  );
}

export function buildChangeMeta(
  reason: HumanChangeReason | '',
  reasonComment: string
): AttributeChangeMeta | null {
  if (!reason) return null;
  return {
    reason,
    reasonComment: reason === 'Others' ? reasonComment.trim() : null,
  };
}

export function validateChangeMeta(
  reason: HumanChangeReason | '',
  reasonComment: string
): string | null {
  if (!reason) return 'A change reason is required when attributes are modified.';
  if (reason === 'Others' && !reasonComment.trim()) {
    return 'A comment is required when reason is Others.';
  }
  return null;
}
