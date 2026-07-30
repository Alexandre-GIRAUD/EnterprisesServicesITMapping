package com.enterprise.itmapping.feature.graphsnapshot.presentation.dto;

import java.util.List;
import java.util.Map;

/**
 * Pinned graph filter set.
 *
 * <p>Breaking change: the legacy {@code year}, {@code businessUnitIds} and {@code regionCodes}
 * dimensions no longer exist. Legacy fields sent by stale clients are ignored, and snapshots saved
 * before the migration come back with empty {@code nodeAttributes} / {@code nodeRefs}.
 *
 * @param applicationIds graph identity filter (OR on application ids)
 * @param nodeAttributes Data Model {@code target=NODE} key → selected values (OR inside a key, AND
 *     across keys)
 * @param nodeRefs Data Model {@code target=NODE_REF} key → selected catalogue ref ids
 */
public record GraphSnapshotFiltersDto(
    List<String> applicationIds,
    Map<String, List<String>> nodeAttributes,
    Map<String, List<String>> nodeRefs) {

  public GraphSnapshotFiltersDto {
    applicationIds = applicationIds != null ? List.copyOf(applicationIds) : List.of();
    nodeAttributes = nodeAttributes != null ? Map.copyOf(nodeAttributes) : Map.of();
    nodeRefs = nodeRefs != null ? Map.copyOf(nodeRefs) : Map.of();
  }

  /** Backward-compatible constructor when nodeRefs are empty. */
  public GraphSnapshotFiltersDto(
      List<String> applicationIds, Map<String, List<String>> nodeAttributes) {
    this(applicationIds, nodeAttributes, Map.of());
  }
}
