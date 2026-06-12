import { MarkerType } from '@xyflow/react';

import type { GraphEdgeDto } from '@/types/api';

import { edgeColorForProperty, edgeDashedForRelation } from './graphTheme';

import { edgeColorValue } from './edgeColorProperty';

import type { OrientedEdgeType } from './OrientedEdge';

import type { Point } from './elkLayout';



/** Arrowhead marker tinted to match the link color. */

export function orientedMarkerEnd(color: string) {

  return { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };

}



/** Build an {@link OrientedEdgeType} with colors derived from a chosen edge property. */

export function buildOrientedEdge(params: {

  id: string;

  sourceId: string;

  targetId: string;

  relationType: string;

  sourceNodeType: string;

  targetNodeType: string;

  dataLabel?: string | null;

  colorPropertyKey?: string;

  colorValue?: string | null;

  properties?: GraphEdgeDto['properties'];

}): OrientedEdgeType {

  const dataKey = params.dataLabel?.trim() || null;

  const colorPropertyKey = params.colorPropertyKey ?? 'data';

  const colorValue =

    params.colorValue !== undefined

      ? params.colorValue

      : edgeColorValue(

          {

            id: params.id,

            sourceId: params.sourceId,

            targetId: params.targetId,

            type: params.relationType,

            data: dataKey,

            properties: params.properties,

          },

          colorPropertyKey

        );

  const edgeColor = edgeColorForProperty(colorValue, params.relationType, colorPropertyKey);

  const dashed = edgeDashedForRelation(params.relationType);

  const label = dataKey || params.relationType;

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



/** Re-apply stroke colors when the user switches the color-coding property. */

export function restyleEdgeColorProperty(

  edge: OrientedEdgeType,

  colorPropertyKey: string,

  raw?: GraphEdgeDto

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

  const colorValue = edgeColorValue(dto, colorPropertyKey);

  const edgeColor = edgeColorForProperty(colorValue, relationType, colorPropertyKey);

  return {

    ...edge,

    markerEnd: orientedMarkerEnd(edgeColor),

    data: {

      ...edge.data!,

      sourceColor: edgeColor,

      targetColor: edgeColor,

      colorPropertyKey,

      colorValue,

      properties: dto.properties ?? edge.data?.properties,

    },

  };

}



/**

 * Merge an ELK orthogonal route (and its line-jumps) into an edge's data so the

 * {@link OrientedEdge} renderer draws node-avoiding bends instead of the

 * smoothstep fallback. Interior bend points exclude the route endpoints (the

 * edge uses live handle positions for those).

 */

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


