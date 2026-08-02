import { MarkerType } from '@xyflow/react';
import type { GraphEdgeDto } from '@/types/api';
import { edgeDashedForRelation } from './graphTheme';
import {
  edgeColorValue,
  edgeLabelText,
  paintEdgeStrokeColor,
  resolveSharedEdgeLabelColor,
  type LegendColorMaps,
} from './edgeColorProperty';
import type { OrientedEdgeType } from './OrientedEdge';
import type { Point } from './elkLayout';

export function orientedMarkerEnd(color: string) {
  return { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
}

/** Build an OrientedEdge; reads existing fields only. Never mutates DTO properties. */
export function buildOrientedEdge(params: {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  sourceNodeType: string;
  targetNodeType: string;
  dataLabel?: string | null;
  colorPropertyKey?: string;
  labelPropertyKey?: string;
  colorValue?: string | null;
  properties?: GraphEdgeDto['properties'];
  colors?: LegendColorMaps;
  hideEdgeLabels?: boolean;
}): OrientedEdgeType {
  const dataKey = params.dataLabel?.trim() || null;
  const colorPropertyKey = params.colorPropertyKey ?? 'data';
  const labelPropertyKey = params.labelPropertyKey ?? 'data';
  const dto: GraphEdgeDto = {
    id: params.id,
    sourceId: params.sourceId,
    targetId: params.targetId,
    type: params.relationType,
    data: dataKey,
    properties: params.properties,
  };
  const colorValue =
    params.colorValue !== undefined
      ? params.colorValue
      : edgeColorValue(dto, colorPropertyKey);
  const edgeColor = paintEdgeStrokeColor(
    colorValue,
    params.relationType,
    colorPropertyKey,
    params.colors?.edgeStroke
  );
  const dashed = edgeDashedForRelation(params.relationType);
  const label = edgeLabelText(dto, labelPropertyKey);
  const labelValue = edgeColorValue(dto, labelPropertyKey);
  const labelColor = resolveSharedEdgeLabelColor(
    colorPropertyKey,
    labelPropertyKey,
    labelValue,
    params.relationType,
    params.colors,
    edgeColor
  );

  return {
    id: params.id,
    source: params.sourceId,
    target: params.targetId,
    type: 'oriented',
    label,
    markerEnd: orientedMarkerEnd(edgeColor),
    data: {
      sourceColor: edgeColor,
      targetColor: edgeColor,
      labelColor,
      dashed,
      relation: params.relationType,
      dataLabel: label,
      dataKey,
      colorPropertyKey,
      colorValue,
      properties: params.properties,
      hideEdgeLabels: params.hideEdgeLabels,
    },
  };
}

/** Re-apply stroke / label from existing DTO (keep routes). Never mutates DTO. */
export function restyleEdgeColorProperty(
  edge: OrientedEdgeType,
  colorPropertyKey: string,
  raw?: GraphEdgeDto,
  labelPropertyKey?: string,
  colors?: LegendColorMaps,
  hideEdgeLabels?: boolean
): OrientedEdgeType {
  const relationType = raw?.type ?? (edge.data?.relation as string | undefined) ?? 'DEPENDS_ON';
  const dto: GraphEdgeDto =
    raw ?? {
      id: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      type: relationType,
      data: edge.data?.dataKey ?? null,
      properties: edge.data?.properties,
    };

  if (edge.data?.indirect) {
    const edgeColor = paintEdgeStrokeColor(null, relationType, colorPropertyKey, colors?.edgeStroke);
    return {
      ...edge,
      label: '+',
      markerEnd: orientedMarkerEnd(edgeColor),
      data: {
        ...edge.data!,
        sourceColor: edgeColor,
        targetColor: edgeColor,
        labelColor: edgeColor,
        colorPropertyKey,
        colorValue: null,
        dataLabel: 'Indirect',
        properties: dto.properties ?? edge.data?.properties,
        hideEdgeLabels,
      },
    };
  }

  const colorValue = edgeColorValue(dto, colorPropertyKey);
  const edgeColor = paintEdgeStrokeColor(
    colorValue,
    relationType,
    colorPropertyKey,
    colors?.edgeStroke
  );
  const labelKey = labelPropertyKey ?? 'data';
  const label = edgeLabelText(dto, labelKey);
  const labelValue = edgeColorValue(dto, labelKey);
  const labelColor = resolveSharedEdgeLabelColor(
    colorPropertyKey,
    labelKey,
    labelValue,
    relationType,
    colors,
    edgeColor
  );
  return {
    ...edge,
    label,
    markerEnd: orientedMarkerEnd(edgeColor),
    data: {
      ...edge.data!,
      sourceColor: edgeColor,
      targetColor: edgeColor,
      labelColor,
      colorPropertyKey,
      colorValue,
      dataLabel: label,
      properties: dto.properties ?? edge.data?.properties,
      hideEdgeLabels,
    },
  };
}

export function attachRoute(
  edge: OrientedEdgeType,
  route: Point[] | undefined,
  jumps: Point[] | undefined
): OrientedEdgeType {
  if (!route || route.length < 2) return edge;
  return {
    ...edge,
    data: {
      ...edge.data!,
      bendPoints: route.slice(1, -1),
      routeStart: route[0],
      routeEnd: route[route.length - 1],
      jumps: jumps ?? [],
    },
  };
}
