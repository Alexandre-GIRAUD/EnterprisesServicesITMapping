import { useState } from 'react';
import { NODE_ICON_CATALOG } from './nodeIcons.ts';
import { NodeIconGlyph } from './NodeIconGlyph';

type Props = {
  values: string[];
  iconByValue: Record<string, string>;
  onIconChange?: (value: string, iconKey: string) => void;
};

/** One row per attribute value: its icon, pickable from the whole catalog while editing. */
export function LegendIconRows({ values, iconByValue, onIconChange }: Props) {
  const [openValue, setOpenValue] = useState<string | null>(null);
  return (
    <ul className="graph-legend__list graph-legend__list--icons">
      {values.map((value) => (
        <li key={value} className="graph-legend__item graph-legend__item--icon">
          <button
            type="button"
            className="graph-legend__icon-button"
            disabled={!onIconChange}
            aria-label={`Icon for ${value}`}
            aria-expanded={openValue === value}
            onClick={() => setOpenValue(openValue === value ? null : value)}
          >
            <NodeIconGlyph iconKey={iconByValue[value]} />
          </button>
          <span className="graph-legend__label">{value}</span>
          {onIconChange && openValue === value ? (
            <div className="graph-legend__icon-grid" role="listbox" aria-label={`Icons for ${value}`}>
              {NODE_ICON_CATALOG.map((icon) => (
                <button
                  key={icon.key}
                  type="button"
                  role="option"
                  aria-selected={iconByValue[value] === icon.key}
                  className={`graph-legend__icon-choice${
                    iconByValue[value] === icon.key ? ' is-selected' : ''
                  }`}
                  title={icon.label}
                  onClick={() => {
                    onIconChange(value, icon.key);
                    setOpenValue(null);
                  }}
                >
                  <NodeIconGlyph iconKey={icon.key} size={18} />
                </button>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
