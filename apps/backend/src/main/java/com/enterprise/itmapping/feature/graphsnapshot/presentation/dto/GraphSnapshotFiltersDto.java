package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import java.util.List;
import java.util.Map;

/**
 * Pinned graph filter set.
 *
 * @param applicationIds graph identity filter (OR on application ids)
 * @param nodeAttributes Data Model {@code target=NODE} key → selected values (OR inside a key, AND
 *     across keys)
 * @param nodeRefs Data Model {@code target=NODE_REF} key → selected catalogue ref ids
 * @param edgeAttributes Data Model {@code target=EDGE} key → selected values on {@code DEPENDS_ON}
 * @param hiddenApplicationIds application node ids collapsed when the view was pinned (UI-only)
 * @param nodePositions canvas positions of visible application nodes at pin time (UI-only)
 * @param legend display coding for the legend at pin time (UI-only; optional)
 */
public record GraphSnapshotFiltersDto(
    List<String> applicationIds,
    Map<String, List<String>> nodeAttributes,
    Map<String, List<String>> nodeRefs,
    Map<String, List<String>> edgeAttributes,
    List<String> hiddenApplicationIds,
    Map<String, NodePositionDto> nodePositions,
    GraphSnapshotLegendDto legend) {

  public GraphSnapshotFiltersDto {
    applicationIds = applicationIds != null ? List.copyOf(applicationIds) : List.of();
    nodeAttributes = nodeAttributes != null ? Map.copyOf(nodeAttributes) : Map.of();
    nodeRefs = nodeRefs != null ? Map.copyOf(nodeRefs) : Map.of();
    edgeAttributes = edgeAttributes != null ? Map.copyOf(edgeAttributes) : Map.of();
    hiddenApplicationIds =
        hiddenApplicationIds != null ? List.copyOf(hiddenApplicationIds) : List.of();
    nodePositions = nodePositions != null ? Map.copyOf(nodePositions) : Map.of();
  }

  /** Convenience when UI-only pin fields are empty. */
  public GraphSnapshotFiltersDto(
      List<String> applicationIds,
      Map<String, List<String>> nodeAttributes,
      Map<String, List<String>> nodeRefs,
      Map<String, List<String>> edgeAttributes) {
    this(applicationIds, nodeAttributes, nodeRefs, edgeAttributes, List.of(), Map.of(), null);
  }

  /** Convenience when edgeAttributes and UI-only pin fields are empty. */
  public GraphSnapshotFiltersDto(
      List<String> applicationIds,
      Map<String, List<String>> nodeAttributes,
      Map<String, List<String>> nodeRefs) {
    this(applicationIds, nodeAttributes, nodeRefs, Map.of(), List.of(), Map.of(), null);
  }

  /** Convenience when nodeRefs/edgeAttributes and UI-only pin fields are empty. */
  public GraphSnapshotFiltersDto(
      List<String> applicationIds, Map<String, List<String>> nodeAttributes) {
    this(applicationIds, nodeAttributes, Map.of(), Map.of(), List.of(), Map.of(), null);
  }

  /** Convenience when edgeAttributes is empty but UI-only pin fields are set. */
  public GraphSnapshotFiltersDto(
      List<String> applicationIds,
      Map<String, List<String>> nodeAttributes,
      Map<String, List<String>> nodeRefs,
      List<String> hiddenApplicationIds,
      Map<String, NodePositionDto> nodePositions) {
    this(
        applicationIds,
        nodeAttributes,
        nodeRefs,
        Map.of(),
        hiddenApplicationIds,
        nodePositions,
        null);
  }

  /** Convenience when legend is omitted. */
  public GraphSnapshotFiltersDto(
      List<String> applicationIds,
      Map<String, List<String>> nodeAttributes,
      Map<String, List<String>> nodeRefs,
      Map<String, List<String>> edgeAttributes,
      List<String> hiddenApplicationIds,
      Map<String, NodePositionDto> nodePositions) {
    this(
        applicationIds,
        nodeAttributes,
        nodeRefs,
        edgeAttributes,
        hiddenApplicationIds,
        nodePositions,
        null);
  }
}
