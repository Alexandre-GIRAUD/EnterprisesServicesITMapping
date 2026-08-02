import { useState } from 'react';
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
  type LegendColorMaps,
  type LegendSetup,
} from './edgeColorProperty';

type Props = {
  nodeTypes: NodeTypeKey[];
  relationTypes?: EdgeTypeKey[];
  simpleMode?: boolean;
  colorPropertyKey?: string;
  colorPropertyOptions?: AttributeOption[];
  onColorPropertyChange?: (key: string) => void;
  colorValues?: string[];
  labelPropertyKey?: string;
  labelPropertyOptions?: AttributeOption[];
  onLabelPropertyChange?: (key: string) => void;
  labelValues?: string[];
  appFillKey?: string;
  appFillOptions?: AttributeOption[];
  onAppFillChange?: (key: string) => void;
  fillValues?: string[];
  appBorderKey?: string;
  appBorderOptions?: AttributeOption[];
  onAppBorderChange?: (key: string) => void;
  borderValues?: string[];
  legendColors?: LegendColorMaps;
  onValueColorChange?: (channel: keyof LegendColorMaps, value: string, color: string) => void;
  legendSetups?: LegendSetup[];
  onSaveLegendSetup?: (name: string) => void;
  onApplyLegendSetup?: (setup: LegendSetup) => void;
  onDeleteLegendSetup?: (id: string) => void;
  showIndirectFlow?: boolean;
};

function nodeValueLabel(propertyKey: string, value: string): string {
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return (
      (NODE_TYPE_STYLES as Record<string, { legendLabel: string } | undefined>)[value]
        ?.legendLabel ?? (value === 'Application' ? 'App' : value)
    );
  }
  return value;
}

function ColorValueRow({
  label,
  color,
  onChange,
  kind,
}: {
  label: string;
  color: string;
  onChange?: (color: string) => void;
  kind: 'edge' | 'fill' | 'border';
}) {
  return (
    <li className="graph-legend__item">
      {kind === 'edge' ? (
        <span
          className="graph-legend__swatch graph-legend__swatch--edge"
          style={{ color }}
          aria-hidden="true"
        />
      ) : (
        <span
          className="graph-legend__swatch graph-legend__swatch--node"
          style={{
            backgroundColor: kind === 'fill' ? color : '#ffffff',
            borderColor: kind === 'border' ? color : '#94a3b8',
          }}
          aria-hidden="true"
        />
      )}
      <span className="graph-legend__label">{label}</span>
      {onChange ? (
        <input
          type="color"
          className="graph-legend__color"
          value={normalizeHex(color)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Color for ${label}`}
          title="Choose color"
        />
      ) : null}
    </li>
  );
}

function normalizeHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#64748b';
}

/**
 * Compact read mode by default; Edit reveals attribute/color/save controls.
 * Never mutates graph attributes.
 */
export function GraphLegend({
  nodeTypes,
  relationTypes = [],
  simpleMode = false,
  colorPropertyKey,
  colorPropertyOptions = [],
  onColorPropertyChange,
  colorValues = [],
  labelPropertyKey,
  labelPropertyOptions = [],
  onLabelPropertyChange,
  labelValues = [],
  appFillKey,
  appFillOptions = [],
  onAppFillChange,
  fillValues = [],
  appBorderKey,
  appBorderOptions = [],
  onAppBorderChange,
  borderValues = [],
  legendColors = {},
  onValueColorChange,
  legendSetups = [],
  onSaveLegendSetup,
  onApplyLegendSetup,
  onDeleteLegendSetup,
  showIndirectFlow = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [selectedSetupId, setSelectedSetupId] = useState('');

  const showCoding =
    colorPropertyOptions.length > 0 &&
    colorPropertyKey != null &&
    onColorPropertyChange != null;

  const canEdit =
    showCoding ||
    Boolean(onSaveLegendSetup && onApplyLegendSetup && onDeleteLegendSetup);

  const colorChange = isEditing ? onValueColorChange : undefined;

  return (
    <div
      className={`graph-legend${isEditing ? ' is-editing' : ''}`}
      role="note"
      aria-label="Graph legend"
    >
      <header className="graph-legend__header">
        <h2 className="graph-legend__heading">Legend</h2>
        {canEdit ? (
          <button
            type="button"
            className="graph-legend__toggle"
            aria-label={isEditing ? 'Done' : 'Edit'}
            title={isEditing ? 'Done' : 'Edit'}
            onClick={() => setIsEditing((v) => !v)}
          >
            {isEditing ? '✓' : 'Edit'}
          </button>
        ) : null}
      </header>

      {/* Edit: Save / use saved legend first */}
      {isEditing && onSaveLegendSetup && onApplyLegendSetup && onDeleteLegendSetup && (
        <div className="graph-legend__group graph-legend__group--control">
          <label className="graph-legend__control">
            <span className="graph-legend__title">Save legend</span>
            <div className="graph-legend__setup-row">
              <input
                className="graph-legend__input"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="Legend name"
                aria-label="Legend setup name"
              />
              <button
                type="button"
                className="graph-legend__btn graph-legend__btn--primary"
                disabled={!setupName.trim()}
                onClick={() => {
                  onSaveLegendSetup(setupName);
                  setSetupName('');
                }}
              >
                Save
              </button>
            </div>
          </label>
          {legendSetups.length > 0 && (
            <div className="graph-legend__setup-row">
              <select
                className="graph-legend__select"
                value={selectedSetupId}
                onChange={(e) => setSelectedSetupId(e.target.value)}
                aria-label="Saved legends"
              >
                <option value="">Saved legends…</option>
                {legendSetups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="graph-legend__btn"
                disabled={!selectedSetupId}
                onClick={() => {
                  const setup = legendSetups.find((s) => s.id === selectedSetupId);
                  if (setup) onApplyLegendSetup(setup);
                }}
              >
                Apply
              </button>
              <button
                type="button"
                className="graph-legend__btn graph-legend__btn--danger"
                disabled={!selectedSetupId}
                onClick={() => {
                  if (!selectedSetupId) return;
                  onDeleteLegendSetup(selectedSetupId);
                  setSelectedSetupId('');
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit: attribute selectors (full mode only) */}
      {isEditing && showCoding && !simpleMode && (
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

      {/* Read (and edit): active coding swatches — pickers only while editing */}
      {!showCoding && nodeTypes.length > 0 && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">App</p>
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

      {simpleMode && borderValues.length > 0 && appBorderKey != null && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">App</p>
          <ul className="graph-legend__list">
            {borderValues.map((value) => {
              const color = nodeBorderColorForValue(
                appBorderKey,
                value,
                legendColors.appBorder
              );
              return (
                <ColorValueRow
                  key={`app-${value}`}
                  label={nodeValueLabel(appBorderKey, value)}
                  color={color}
                  kind="border"
                  onChange={
                    colorChange ? (c) => colorChange('appBorder', value, c) : undefined
                  }
                />
              );
            })}
          </ul>
        </div>
      )}

      {simpleMode && colorValues.length > 0 && colorPropertyKey != null && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">Flow</p>
          <ul className="graph-legend__list">
            {colorValues.map((value) => {
              const color = strokeColorForLegendSwatch(
                colorPropertyKey,
                value,
                'DEPENDS_ON',
                legendColors.edgeStroke
              );
              return (
                <ColorValueRow
                  key={`flow-${value}`}
                  label={legendLabelForColorValue(colorPropertyKey, value)}
                  color={color}
                  kind="edge"
                  onChange={
                    colorChange ? (c) => colorChange('edgeStroke', value, c) : undefined
                  }
                />
              );
            })}
          </ul>
        </div>
      )}

      {!simpleMode && fillValues.length > 0 && appFillKey != null && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">
            Fill · {labelForColorProperty(appFillKey)}
          </p>
          <ul className="graph-legend__list">
            {fillValues.map((value) => {
              const color = nodeFillColorForValue(appFillKey, value, legendColors.appFill);
              return (
                <ColorValueRow
                  key={`fill-${value}`}
                  label={nodeValueLabel(appFillKey, value)}
                  color={color}
                  kind="fill"
                  onChange={
                    colorChange ? (c) => colorChange('appFill', value, c) : undefined
                  }
                />
              );
            })}
          </ul>
        </div>
      )}

      {!simpleMode && borderValues.length > 0 && appBorderKey != null && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">
            Border · {labelForColorProperty(appBorderKey)}
          </p>
          <ul className="graph-legend__list">
            {borderValues.map((value) => {
              const color = nodeBorderColorForValue(
                appBorderKey,
                value,
                legendColors.appBorder
              );
              return (
                <ColorValueRow
                  key={`border-${value}`}
                  label={nodeValueLabel(appBorderKey, value)}
                  color={color}
                  kind="border"
                  onChange={
                    colorChange ? (c) => colorChange('appBorder', value, c) : undefined
                  }
                />
              );
            })}
          </ul>
        </div>
      )}

      {!simpleMode && colorValues.length > 0 && colorPropertyKey != null && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">
            Stroke · {labelForColorProperty(colorPropertyKey)}
          </p>
          <ul className="graph-legend__list">
            {colorValues.map((value) => {
              const color = strokeColorForLegendSwatch(
                colorPropertyKey,
                value,
                'DEPENDS_ON',
                legendColors.edgeStroke
              );
              return (
                <ColorValueRow
                  key={`stroke-${value}`}
                  label={legendLabelForColorValue(colorPropertyKey, value)}
                  color={color}
                  kind="edge"
                  onChange={
                    colorChange ? (c) => colorChange('edgeStroke', value, c) : undefined
                  }
                />
              );
            })}
          </ul>
        </div>
      )}

      {!simpleMode && labelValues.length > 0 && labelPropertyKey != null && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">
            Label · {labelForColorProperty(labelPropertyKey)}
          </p>
          <ul className="graph-legend__list">
            {labelValues.map((value) => {
              const color =
                legendColors.edgeLabel?.[value] ??
                strokeColorForLegendSwatch(labelPropertyKey, value);
              return (
                <ColorValueRow
                  key={`label-${value}`}
                  label={legendLabelForColorValue(labelPropertyKey, value)}
                  color={color}
                  kind="edge"
                  onChange={
                    colorChange ? (c) => colorChange('edgeLabel', value, c) : undefined
                  }
                />
              );
            })}
          </ul>
        </div>
      )}

      {relationTypes.length > 0 && (
        <div className="graph-legend__group">
          <p className="graph-legend__title">Flow</p>
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
