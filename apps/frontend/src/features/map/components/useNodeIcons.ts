import { useCallback, useMemo, useState } from 'react';
import type { GraphNodeDto } from '@/types/api';
import {
  NODE_TYPE_COLOR_KEY,
  collectNodeLegendValues,
  nodePropertyOptions,
  type AttributeOption,
} from './edgeColorProperty.ts';
import {
  NODE_ICON_NONE_KEY,
  defaultIconForValue,
  loadNodeIconAttribute,
  loadNodeIconMap,
  nodeIconKeyFor,
  nodeLabelScale,
  storeNodeIcons,
} from './nodeIcons.ts';

/** Display-only icon coding: an attribute picks the icon of each node. Off by default. */
export function useNodeIcons(nodes: GraphNodeDto[]) {
  const [attributeKey, setAttributeKey] = useState(loadNodeIconAttribute);
  const [picked, setPicked] = useState(loadNodeIconMap);

  const options = useMemo<AttributeOption[]>(
    () => [
      { key: NODE_ICON_NONE_KEY, label: 'None' },
      ...nodePropertyOptions(nodes).filter((option) => option.key !== NODE_TYPE_COLOR_KEY),
    ],
    [nodes],
  );
  const activeKey = options.some((o) => o.key === attributeKey) ? attributeKey : NODE_ICON_NONE_KEY;
  const values = useMemo(
    () => (activeKey === NODE_ICON_NONE_KEY ? [] : collectNodeLegendValues(nodes, activeKey)),
    [nodes, activeKey],
  );
  const iconByValue = useMemo(
    () => Object.fromEntries(values.map((v) => [v, picked[v] ?? defaultIconForValue(values, v)])),
    [values, picked],
  );

  const changeAttribute = useCallback(
    (key: string) => {
      setAttributeKey(key);
      storeNodeIcons(key, picked);
    },
    [picked],
  );
  const changeIcon = useCallback(
    (value: string, iconKey: string) => {
      const next = { ...picked, [value]: iconKey };
      setPicked(next);
      storeNodeIcons(attributeKey, next);
    },
    [picked, attributeKey],
  );

  const iconKeyOf = useCallback(
    (node: GraphNodeDto) => nodeIconKeyFor(node, activeKey, picked, values),
    [activeKey, picked, values],
  );
  const labelScale = nodeLabelScale(activeKey !== NODE_ICON_NONE_KEY);

  return { activeKey, options, values, iconByValue, changeAttribute, changeIcon, iconKeyOf, labelScale };
}
