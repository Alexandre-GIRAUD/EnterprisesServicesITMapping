import { LegendColorPicker } from './LegendSwatch';

export type LegendChip = {
  value: string;
  label: string;
  color: string;
};

type Props = {
  chips: LegendChip[];
  onChange: (value: string, color: string) => void;
};

/** The values of the chosen attribute, each with its color picker, wrapping along the line. */
export function LegendValueChips({ chips, onChange }: Props) {
  return (
    <ul className="graph-legend__chips">
      {chips.map((chip) => (
        <li key={chip.value} className="graph-legend__chip">
          <span className="graph-legend__label">{chip.label}</span>
          <LegendColorPicker
            label={chip.label}
            color={chip.color}
            onChange={(color) => onChange(chip.value, color)}
          />
        </li>
      ))}
    </ul>
  );
}
