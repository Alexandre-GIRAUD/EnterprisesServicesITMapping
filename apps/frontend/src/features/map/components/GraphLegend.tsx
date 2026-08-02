import {
  EDGE_TYPE_STYLES,
  NODE_TYPE_STYLES,
  type EdgeTypeKey,
  type NodeTypeKey,
} from './graphTheme';
import {
  labelForColorProperty,
  legendLabelForColorValue,
  NODE_TYPE_COLOR_KEY,
  nodeBorderColorForValue,
  nodeFillColorForValue,
  strokeColorForLegendSwatch,
  type AttributeOption,
} from './edgeColorProperty';

type Props = {
  nodeTypes: NodeTypeKey[];
  relationTypes?: EdgeTypeKey[];
  colorPropertyKey?: string;
  colorPropertyOptions?: AttributeOption[];
  onColorPropertyChange?: (key: string) => void;
  colorValues?: string[];
  labelPropertyKey?: string;
  labelPropertyOptions?: AttributeOption[];
  onLabelPropertyChange?: (key: string) => void;
  appFillKey?: string;
  appFillOptions?: AttributeOption[];
  onAppFillChange?: (key: string) => void;
  fillValues?: string[];
  appBorderKey?: string;
  appBorderOptions?: AttributeOption[];
  onAppBorderChange?: (key: string) => void;
  borderValues?: string[];
  showIndirectFlow?: boolean;
};

function nodeValueLabel(propertyKey: string, value: string): string {
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return (
      (NODE_TYPE_STYLES as Record<string, { legendLabel: string } | undefined>)[value]
        ?.legendLabel ?? value
    );
  }
  return value;
}

/**
 * Legend: display coding for link color/label and app fill/border.
 * Does not mutate graph attributes — only chooses how to paint.
 */
export function GraphLegend({
  nodeTypes,
  relationTypes = [],
  colorPropertyKey,
  colorPropertyOptions = [],
  onColorPropertyChange,
  colorValues = [],
  labelPropertyKey,
  labelPropertyOptions = [],
  onLabelPropertyChange,
  appFillKey,
  appFillOptions = [],
  onAppFillChange,
  fillValues = [],
  appBorderKey,
  appBorderOptions = [],
  onAppBorderChange,
  borderValues = [],
  showIndirectFlow = false,
}: Props) {
  const showCoding =
    colorPropertyOptions.length > 0 &&
    colorPropertyKey != null &&
    onColorPropertyChange != null;

  const colorGroupTitle =
    colorPropertyKey != null ? labelForColorProperty(colorPropertyKey) : 'Links';

  return (
    <div className="graph-legend" role="note" aria-label="Graph legend">
      {showCoding && (
        <div className="graph-legend__group graph-legend__group--control">
          <label className="graph-legend__control">
            <span className="graph-legend__title">Link color</span>
            <select
              className="graph-legend__select"
              value={colorPropertyKey}
              onChange={(event) => onColorPropertyChange(event.target.value)}
              aria-label="Edge property used for link color"
            >
              {colorPropertyOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {labelPropertyOptions.length > 0 &&
            labelPropertyKey != null &&
            onLabelPropertyChange != null && (
              <label className="graph-legend__control">
                <span className="graph-legend__title">Link label</span>
                <select
                  className="graph-legend__select"
                  value={labelPropertyKey}
                  onChange={(event) => onLabelPropertyChange(event.target.value)}
                  aria-label="Edge property used for link label"
                >
                  {labelPropertyOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

          {appFillOptions.length > 0 && appFillKey != null && onAppFillChange != null && (
            <label className="graph-legend__control">
              <span className="graph-legend__title">App fill</span>
              <select
                className="graph-legend__select"
                value={appFillKey}
                onChange={(event) => onAppFillChange(event.target.value)}
                aria-label="App property used for node fill"
              >
                {appFillOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {appBorderOptions.length > 0 &&
            appBorderKey != null &&
            onAppBorderChange != null && (
              <label className="graph-legend__control">
                <span className="graph-legend__title">App border</span>
                <select
                  className="graph-legend__select"
                  value={appBorderKey}
                  onChange={(event) => onAppBorderChange(event.target.value)}
                  aria-label="App property used for node border"
                >
                  {appBorderOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
        </div>
      )}

      {!showCoding && nodeTypes.length > 0 && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">Nodes</p>
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

      {fillValues.length > 0 && appFillKey != null && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">
            Fill · {labelForColorProperty(appFillKey)}
          </p>
          <ul className="graph-legend__list">
            {fillValues.map((value) => (
              <li key={`fill-${value}`} className="graph-legend__item">
                <span
                  className="graph-legend__swatch graph-legend__swatch--node"
                  style={{
                    backgroundColor: nodeFillColorForValue(appFillKey, value),
                    borderColor: '#94a3b8',
                  }}
                  aria-hidden="true"
                />
                <span className="graph-legend__label">
                  {nodeValueLabel(appFillKey, value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {borderValues.length > 0 && appBorderKey != null && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">
            Border · {labelForColorProperty(appBorderKey)}
          </p>
          <ul className="graph-legend__list">
            {borderValues.map((value) => (
              <li key={`border-${value}`} className="graph-legend__item">
                <span
                  className="graph-legend__swatch graph-legend__swatch--node"
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: nodeBorderColorForValue(appBorderKey, value),
                  }}
                  aria-hidden="true"
                />
                <span className="graph-legend__label">
                  {nodeValueLabel(appBorderKey, value)}
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
          <p className="graph-legend__title">Relationships</p>
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

      {showIndirectFlow && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">Flow style</p>
          <ul className="graph-legend__list">
            <li className="graph-legend__item">
              <span
                className="graph-legend__swatch graph-legend__swatch--edge is-dashed"
                style={{ color: '#64748b' }}
                aria-hidden="true"
              />
              <span className="graph-legend__label">Indirect flow</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
