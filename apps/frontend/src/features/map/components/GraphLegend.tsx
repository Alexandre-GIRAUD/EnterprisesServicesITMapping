import { useState, type ReactNode } from 'react';
import {
  EDGE_TYPE_STYLES,
  NODE_TYPE_STYLES,
  type EdgeTypeKey,
  type NodeTypeKey,
} from './graphTheme';
import {
  HIDE_EDGE_LABELS_KEY,
  NODE_TYPE_COLOR_KEY,
  RELATION_TYPE_COLOR_KEY,
  legendLabelForColorValue,
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
  /** Stroke color per label value (from matching edges); used for the "label" swatch. */
  labelStrokeColors?: Record<string, string>;
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
  hideEdgeLabels?: boolean;
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
  borderColor,
}: {
  label: string;
  color: string;
  onChange?: (color: string) => void;
  kind: 'edge' | 'fill' | 'border' | 'app' | 'label';
  borderColor?: string;
}) {
  return (
    <li className="graph-legend__item">
      {kind === 'edge' ? (
        <span
          className="graph-legend__swatch graph-legend__swatch--edge"
          style={{ color }}
          aria-hidden="true"
        />
      ) : kind === 'label' ? (
        <span
          className="graph-legend__swatch graph-legend__swatch--text-label"
          style={{ color, borderColor: `${color}55` }}
          aria-hidden="true"
        >
          label
        </span>
      ) : (
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

function Section({
  title,
  showTitle,
  children,
}: {
  title: string;
  showTitle: boolean;
  children: ReactNode;
}) {
  return (
    <div className="graph-legend__group">
      {showTitle ? <p className="graph-legend__title">{title}</p> : null}
      <ul className="graph-legend__list">{children}</ul>
    </div>
  );
}

/**
 * Compact read mode by default; Edit reveals controls.
 * Rationalizes shared edge/app channels. Never mutates graph attributes.
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
  labelStrokeColors = {},
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
  hideEdgeLabels = false,
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
  const sharedEdge =
    !simpleMode &&
    !hideEdgeLabels &&
    colorPropertyKey != null &&
    labelPropertyKey != null &&
    colorPropertyKey === labelPropertyKey;
  const sharedApp =
    !simpleMode &&
    appFillKey != null &&
    appBorderKey != null &&
    appFillKey === appBorderKey;

  const nodesTypeOnly =
    simpleMode ||
    (appFillKey === NODE_TYPE_COLOR_KEY && appBorderKey === NODE_TYPE_COLOR_KEY);
  const edgesTypeOnly =
    simpleMode ||
    (colorPropertyKey === RELATION_TYPE_COLOR_KEY &&
      (hideEdgeLabels || labelPropertyKey === RELATION_TYPE_COLOR_KEY));

  const hideSectionTitles = !isEditing && nodesTypeOnly && edgesTypeOnly;
  const showAppsTitle = !hideSectionTitles;
  const showFlowsTitle = !hideSectionTitles;

  const typeAppFill = nodeFillColorForValue(
    NODE_TYPE_COLOR_KEY,
    'Application',
    legendColors.appFill
  );
  const typeAppBorder = nodeBorderColorForValue(
    NODE_TYPE_COLOR_KEY,
    'Application',
    legendColors.appBorder,
    NODE_TYPE_COLOR_KEY,
    legendColors.appFill
  );
  const typeFlowColor = strokeColorForLegendSwatch(
    RELATION_TYPE_COLOR_KEY,
    'DEPENDS_ON',
    'DEPENDS_ON',
    legendColors.edgeStroke
  );

  const appsItems: ReactNode[] = [];
  if (!showCoding && nodeTypes.length > 0 && !simpleMode) {
    for (const key of nodeTypes) {
      appsItems.push(
        <li key={`type-${key}`} className="graph-legend__item">
          <span
            className="graph-legend__swatch graph-legend__swatch--node graph-legend__swatch--mini-app"
            style={{
              backgroundColor: '#ffffff',
              borderColor: NODE_TYPE_STYLES[key].color,
            }}
            aria-hidden="true"
          />
          <span className="graph-legend__label">
            {NODE_TYPE_STYLES[key].legendLabel}
          </span>
        </li>
      );
    }
  } else if (nodesTypeOnly) {
    appsItems.push(
      <ColorValueRow
        key="type-app"
        label="app"
        color={typeAppFill}
        borderColor={typeAppBorder}
        kind="app"
        onChange={
          colorChange
            ? (c) => colorChange('appFill', 'Application', c)
            : undefined
        }
      />
    );
  } else if (sharedApp && appFillKey != null) {
    for (const value of fillValues) {
      const fill = nodeFillColorForValue(appFillKey, value, legendColors.appFill);
      const border = nodeBorderColorForValue(
        appBorderKey!,
        value,
        legendColors.appBorder,
        appFillKey,
        legendColors.appFill
      );
      appsItems.push(
        <ColorValueRow
          key={`mini-app-${value}`}
          label={nodeValueLabel(appFillKey, value)}
          color={fill}
          borderColor={border}
          kind="app"
          onChange={colorChange ? (c) => colorChange('appFill', value, c) : undefined}
        />
      );
    }
  } else {
    if (appFillKey != null) {
      for (const value of fillValues) {
        appsItems.push(
          <ColorValueRow
            key={`fill-${value}`}
            label={nodeValueLabel(appFillKey, value)}
            color={nodeFillColorForValue(appFillKey, value, legendColors.appFill)}
            kind="fill"
            onChange={colorChange ? (c) => colorChange('appFill', value, c) : undefined}
          />
        );
      }
    }
    if (appBorderKey != null) {
      for (const value of borderValues) {
        appsItems.push(
          <ColorValueRow
            key={`border-${value}`}
            label={nodeValueLabel(appBorderKey, value)}
            color={nodeBorderColorForValue(appBorderKey, value, legendColors.appBorder)}
            kind="border"
            onChange={
              colorChange ? (c) => colorChange('appBorder', value, c) : undefined
            }
          />
        );
      }
    }
  }

  const flowsItems: ReactNode[] = [];
  if (!showCoding && relationTypes.length > 0 && !simpleMode) {
    for (const key of relationTypes) {
      flowsItems.push(
        <li key={`rel-${key}`} className="graph-legend__item">
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
      );
    }
  } else if (edgesTypeOnly) {
    flowsItems.push(
      <ColorValueRow
        key="type-flow"
        label="flow"
        color={typeFlowColor}
        kind="edge"
        onChange={
          colorChange
            ? (c) => colorChange('edgeStroke', 'DEPENDS_ON', c)
            : undefined
        }
      />
    );
  } else if (colorPropertyKey != null) {
    for (const value of colorValues) {
      const color = strokeColorForLegendSwatch(
        colorPropertyKey,
        value,
        'DEPENDS_ON',
        legendColors.edgeStroke
      );
      flowsItems.push(
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
    }
    if (!hideEdgeLabels && !sharedEdge && labelPropertyKey != null) {
      for (const value of labelValues) {
        const color =
          labelStrokeColors[value] ??
          strokeColorForLegendSwatch(
            colorPropertyKey,
            colorValues[0] ?? value,
            'DEPENDS_ON',
            legendColors.edgeStroke
          );
        flowsItems.push(
          <ColorValueRow
            key={`label-${value}`}
            label={legendLabelForColorValue(labelPropertyKey, value)}
            color={color}
            kind="label"
          />
        );
      }
    }
  }

  if (showIndirectFlow) {
    flowsItems.push(
      <li key="indirect" className="graph-legend__item">
        <span
          className="graph-legend__swatch graph-legend__swatch--edge is-dashed"
          style={{ color: '#64748b' }}
          aria-hidden="true"
        />
        <span className="graph-legend__label">Indirect flow</span>
      </li>
    );
  }

  const labelSelectValue = hideEdgeLabels
    ? HIDE_EDGE_LABELS_KEY
    : (labelPropertyKey ?? '');

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

          {labelPropertyOptions.length > 0 && onLabelPropertyChange != null && (
            <label className="graph-legend__control">
              <span className="graph-legend__title">Link label</span>
              <select
                className="graph-legend__select"
                value={labelSelectValue}
                onChange={(event) => onLabelPropertyChange(event.target.value)}
                aria-label="Edge property used for link label"
              >
                {labelPropertyOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
                <option value={HIDE_EDGE_LABELS_KEY} className="graph-legend__option--italic">
                  Hide all labels
                </option>
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

      {appsItems.length > 0 && (
        <Section title="Apps" showTitle={showAppsTitle}>
          {appsItems}
        </Section>
      )}

      {flowsItems.length > 0 && (
        <Section title="Flows" showTitle={showFlowsTitle}>
          {flowsItems}
        </Section>
      )}
    </div>
  );
}
