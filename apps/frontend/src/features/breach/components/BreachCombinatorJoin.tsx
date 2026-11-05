import type { BreachCombinator } from '@/types/api';

const COMBINATORS: BreachCombinator[] = ['AND', 'OR'];
/** The first join between siblings holds the toggle; the next ones repeat its value. */
const TOGGLE_POSITION = 1;

type BreachCombinatorJoinProps = {
  position: number;
  value: BreachCombinator;
  label: string;
  isReadOnly: boolean;
  onChange: (value: BreachCombinator) => void;
};

/** What joins an item to the one before it; nothing before the first item. */
export function BreachCombinatorJoin({ position, value, label, isReadOnly, onChange }: BreachCombinatorJoinProps) {
  if (position < TOGGLE_POSITION) return null;
  if (position > TOGGLE_POSITION) return <span className="breach-join-pill">{value}</span>;
  return (
    <div className="breach-combinator" role="radiogroup" aria-label={label}>
      {COMBINATORS.map((combinator) => (
        <button
          key={combinator}
          type="button"
          role="radio"
          aria-checked={value === combinator}
          className={`breach-combinator-btn${value === combinator ? ' is-active' : ''}`}
          disabled={isReadOnly}
          onClick={() => onChange(combinator)}
        >
          {combinator}
        </button>
      ))}
    </div>
  );
}
