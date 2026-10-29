import { cssColorToHex } from './edgeColorProperty';

export type SwatchKind = 'edge' | 'fill' | 'border' | 'app' | 'label' | 'text';

export function LegendSwatch({
  color,
  kind,
  borderColor,
}: {
  color: string;
  kind: SwatchKind;
  borderColor?: string;
}) {
  if (kind === 'edge') {
    return (
      <span
        className="graph-legend__swatch graph-legend__swatch--edge"
        style={{ color }}
        aria-hidden="true"
      />
    );
  }
  if (kind === 'label' || kind === 'text') {
    return (
      <span
        className="graph-legend__swatch graph-legend__swatch--text-label"
        style={{ color, borderColor: `${color}55` }}
        aria-hidden="true"
      >
        {kind === 'text' ? 'text' : 'label'}
      </span>
    );
  }
  return (
    <span
      className={`graph-legend__swatch graph-legend__swatch--node${
        kind === 'app' ? ' graph-legend__swatch--mini-app' : ''
      }`}
      style={{
        backgroundColor: kind === 'border' ? '#ffffff' : color,
        borderColor: kind === 'fill' ? '#94a3b8' : (borderColor ?? color),
      }}
      aria-hidden="true"
    />
  );
}

export function LegendColorPicker({
  label,
  color,
  onChange,
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
}) {
  return (
    <input
      type="color"
      className="graph-legend__color"
      value={cssColorToHex(color)}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Color for ${label}`}
      title="Choose color"
    />
  );
}
