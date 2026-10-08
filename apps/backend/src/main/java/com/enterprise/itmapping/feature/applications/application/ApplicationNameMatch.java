package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.applications.application.ApplicationCatalogQuery.CatalogRow;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Ranks catalogue applications against a user wording. Spaces, underscores, and case do not count.
 * A short edit distance counts as a typo. Names that are only similarly close stay tied so the
 * caller can ask instead of guessing.
 */
public final class ApplicationNameMatch {

  private static final int UNRELATED = Integer.MAX_VALUE;

  private ApplicationNameMatch() {}

  public static List<CatalogRow> closest(String query, List<CatalogRow> catalogue, int limit) {
    if (query == null || query.isBlank() || catalogue == null || catalogue.isEmpty() || limit < 1) {
      return List.of();
    }
    List<Scored> scored = new ArrayList<>();
    for (CatalogRow row : catalogue) {
      int score = score(query, row);
      if (score < UNRELATED) {
        scored.add(new Scored(row, score));
      }
    }
    scored.sort(Comparator.comparingInt(Scored::score).thenComparing(item -> item.row().name()));
    boolean hasExact = scored.stream().anyMatch(item -> item.score() == 0);
    if (hasExact) {
      scored.removeIf(item -> item.score() != 0);
    }
    int size = Math.min(limit, scored.size());
    List<CatalogRow> closest = new ArrayList<>();
    for (int i = 0; i < size; i++) {
      closest.add(scored.get(i).row());
    }
    return closest;
  }

  /** The single nearest application, or null when none is close or several are equally close. */
  public static CatalogRow uniqueClosest(String query, List<CatalogRow> catalogue) {
    List<CatalogRow> closest = closest(query, catalogue, 2);
    if (closest.isEmpty()) {
      return null;
    }
    if (closest.size() == 1) {
      return closest.get(0);
    }
    if (score(query, closest.get(0)) < score(query, closest.get(1))) {
      return closest.get(0);
    }
    return null;
  }

  private static int score(String query, CatalogRow row) {
    return Math.min(scoreOne(query, row.name()), scoreOne(query, row.id()));
  }

  private static int scoreOne(String query, String candidate) {
    String wording = compact(query);
    String stored = compact(candidate);
    if (wording.isEmpty() || stored.isEmpty()) {
      return UNRELATED;
    }
    if (wording.equals(stored)) {
      return 0;
    }
    if (wording.length() >= 3 && (stored.contains(wording) || wording.contains(stored))) {
      return 1;
    }
    int edits = editDistance(wording, stored);
    if (edits <= maxTypos(wording.length())) {
      return 2 + edits;
    }
    return UNRELATED;
  }

  private static int maxTypos(int length) {
    if (length < 4) {
      return 0;
    }
    if (length < 8) {
      return 1;
    }
    return 2;
  }

  private static String compact(String value) {
    if (value == null) {
      return "";
    }
    StringBuilder compact = new StringBuilder();
    for (int i = 0; i < value.length(); i++) {
      char character = value.charAt(i);
      if (character == ' ' || character == '_') {
        continue;
      }
      compact.append(Character.toLowerCase(character));
    }
    return compact.toString();
  }

  private static int editDistance(String left, String right) {
    int[] previous = new int[right.length() + 1];
    int[] current = new int[right.length() + 1];
    for (int column = 0; column <= right.length(); column++) {
      previous[column] = column;
    }
    for (int row = 1; row <= left.length(); row++) {
      current[0] = row;
      for (int column = 1; column <= right.length(); column++) {
        int replace = previous[column - 1] + (left.charAt(row - 1) == right.charAt(column - 1) ? 0 : 1);
        current[column] = Math.min(replace, Math.min(current[column - 1] + 1, previous[column] + 1));
      }
      int[] swap = previous;
      previous = current;
      current = swap;
    }
    return previous[right.length()];
  }

  private record Scored(CatalogRow row, int score) {}
}
