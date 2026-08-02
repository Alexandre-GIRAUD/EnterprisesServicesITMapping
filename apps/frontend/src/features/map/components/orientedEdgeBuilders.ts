import { MarkerType } from '@xyflow/react';
import type { GraphEdgeDto } from '@/types/api';
import { edgeColorForProperty, edgeDashedForRelation } from './graphTheme';
import { edgeColorValue, edgeLabelText } from './edgeColorProperty';
import type { OrientedEdgeType } from './OrientedEdge';
import type { Point } from './elkLayout';

/** Arrowhead marker tinted to match the link color. */
export function orientedMarkerEnd(color: string) {
  return { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
}

/** Build an OrientedEdge; reads existing fields only for stroke/label display. */
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
  const edgeColor = edgeColorForProperty(colorValue, params.relationType, colorPropertyKey);
  const dashed = edgeDashedForRelation(params.relationType);
  const label = edgeLabelText(dto, labelPropertyKey);

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
      dashed,
      relation: params.relationType,
      dataLabel: label,
      dataKey,
      colorPropertyKey,
      colorValue,
      properties: params.properties,
    },
  };
}

/** Re-apply stroke / label from existing DTO fields (keep routes). Never mutates DTO. */
export function restyleEdgeColorProperty(
  edge: OrientedEdgeType,
  colorPropertyKey: string,
  raw?: GraphEdgeDto,
  labelPropertyKey?: string
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
    const edgeColor = edgeColorForProperty(null, relationType, colorPropertyKey);
    return {
      ...edge,
      label: '+',
      markerEnd: orientedMarkerEnd(edgeColor),
      data: {
        ...edge.data!,
        sourceColor: edgeColor,
        targetColor: edgeColor,
        colorPropertyKey,
        colorValue: null,
        dataLabel: 'Indirect',
        properties: dto.properties ?? edge.data?.properties,
      },
    };
  }

  const colorValue = edgeColorValue(dto, colorPropertyKey);
  const edgeColor = edgeColorForProperty(colorValue, relationType, colorPropertyKey);
  const label = edgeLabelText(dto, labelPropertyKey ?? 'data');
  return {
    ...edge,
    label,
    markerEnd: orientedMarkerEnd(edgeColor),
    data: {
      ...edge.data!,
      sourceColor: edgeColor,
      targetColor: edgeColor,
      colorPropertyKey,
      colorValue,
      dataLabel: label,
      properties: dto.properties ?? edge.data?.properties,
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
