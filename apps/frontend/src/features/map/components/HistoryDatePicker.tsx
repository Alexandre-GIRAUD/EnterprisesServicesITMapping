import { useEffect, useState } from 'react';
import { fetchHistoryRange } from '../api/attributeAuditApi';

type HistoryDatePickerProps = {
  /** Past day shown (YYYY-MM-DD), or null for today. */
  day: string | null;
  onChange: (day: string | null) => void;
};

/** Picks the day Production is shown as of. Today means the live graph. */
export function HistoryDatePicker({ day, onChange }: HistoryDatePickerProps) {
  const [range, setRange] = useState<{ firstDay: string; today: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHistoryRange()
      .then((next) => {
        if (!cancelled) setRange(next);
      })
      .catch(() => {
        if (!cancelled) setRange(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <label className="history-date-picker" title="Show Production as it stood on this day">
      <span className="history-date-picker__label">Date</span>
      <input
        type="date"
        value={day ?? range?.today ?? ''}
        min={range?.firstDay}
        max={range?.today}
        disabled={!range}
        onChange={(event) => {
          const next = event.target.value;
          onChange(!next || next === range?.today ? null : next);
        }}
      />
    </label>
  );
}
