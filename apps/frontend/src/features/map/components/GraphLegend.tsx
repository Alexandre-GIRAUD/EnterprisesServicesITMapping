import {
  EDGE_TYPE_STYLES,
  NODE_TYPE_STYLES,
  type EdgeTypeKey,
  type NodeTypeKey,
} from './graphTheme';

type Props = {
  /** Node types to document (in display order). */
  nodeTypes: NodeTypeKey[];
  /** Edge/relation types to document (in display order). */
  edgeTypes: EdgeTypeKey[];
};

/**
 * Static, non-interactive legend explaining node colors and relation types.
 * Colors come from {@link graphTheme} so the legend always matches the graph.
 */
export function GraphLegend({ nodeTypes, edgeTypes }: Props) {
  return (
    <div className="graph-legend" role="note" aria-label="Légende du graphe">
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

      {edgeTypes.length > 0 && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">Relations</p>
          <ul className="graph-legend__list">
            {edgeTypes.map((key) => (
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
