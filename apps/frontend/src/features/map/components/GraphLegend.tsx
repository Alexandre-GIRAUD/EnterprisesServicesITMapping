import {
  EDGE_TYPE_STYLES,
  NODE_TYPE_STYLES,
  type EdgeTypeKey,
  type NodeTypeKey,
} from './graphTheme';
import {
  labelForColorProperty,
  legendLabelForColorValue,
  strokeColorForLegendSwatch,
} from './edgeColorProperty';

type ColorPropertyOption = {
  key: string;
  label: string;
};

type Props = {
  /** Node types to document (in display order). */
  nodeTypes: NodeTypeKey[];
  /** Relation types when links have no property selector (e.g. module graph). */
  relationTypes?: EdgeTypeKey[];
  /** Active edge property used for link colors (application graph). */
  colorPropertyKey?: string;
  /** Available properties for the color selector. */
  colorPropertyOptions?: ColorPropertyOption[];
  onColorPropertyChange?: (key: string) => void;
  /** Distinct values for the active color property. */
  colorValues?: string[];
};

/**
 * Static, non-interactive legend explaining node colors and link data types.
 * Colors come from {@link graphTheme} so the legend always matches the graph.
 */
export function GraphLegend({
  nodeTypes,
  relationTypes = [],
  colorPropertyKey,
  colorPropertyOptions = [],
  onColorPropertyChange,
  colorValues = [],
}: Props) {
  const showColorSelector =
    colorPropertyOptions.length > 0 && colorPropertyKey != null && onColorPropertyChange != null;
  const colorGroupTitle =
    colorPropertyKey != null ? labelForColorProperty(colorPropertyKey) : 'Liens';

  return (
    <div className="graph-legend" role="note" aria-label="Légende du graphe">
      {showColorSelector && (
        <div className="graph-legend__group graph-legend__group--control">
          <label className="graph-legend__control">
            <span className="graph-legend__title">Couleur des liens</span>
            <select
              className="graph-legend__select"
              value={colorPropertyKey}
              onChange={(event) => onColorPropertyChange(event.target.value)}
              aria-label="Propriété utilisée pour la couleur des liens"
            >
              {colorPropertyOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {nodeTypes.length > 0 && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">Nœuds</p>
          <ul className="graph-legend__list">
            {nodeTypes.map((key) => (
              <li key={key} className="graph-legend__item">
                <span
                  className="graph-legend__swatch graph-legend__swatch--node"
                  style={{ borderColor: NODE_TYPE_STYLES[key].color }}
                  aria-hidden="true"
                />
                <span className="graph-legend__label">
                  {NODE_TYPE_STYLES[key].legendLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {colorValues.length > 0 && colorPropertyKey != null && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">{colorGroupTitle}</p>
          <ul className="graph-legend__list">
            {colorValues.map((value) => (
              <li key={value} className="graph-legend__item">
                <span
                  className="graph-legend__swatch graph-legend__swatch--edge"
                  style={{
                    color: strokeColorForLegendSwatch(colorPropertyKey, value),
                  }}
                  aria-hidden="true"
                />
                <span className="graph-legend__label">
                  {legendLabelForColorValue(colorPropertyKey, value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {relationTypes.length > 0 && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">Relations</p>
          <ul className="graph-legend__list">
            {relationTypes.map((key) => (
              <li key={key} className="graph-legend__item">
                <span
                  className={`graph-legend__swatch graph-legend__swatch--edge${
                    EDGE_TYPE_STYLES[key].dashed ? ' is-dashed' : ''
                  }`}
                  style={{ color: EDGE_TYPE_STYLES[key].color }}
                  aria-hidden="true"
                />
                <span className="graph-legend__label">
                  {EDGE_TYPE_STYLES[key].legendLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
