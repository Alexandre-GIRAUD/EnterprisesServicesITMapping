package com.enterprise.itmapping.feature.integrations.github.application;

import com.enterprise.itmapping.feature.integrations.github.GithubTreePathFilter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Picks a single root-level README path present in a known path set (coherent with the filtered
 * GitHub tree used for {@code evidence_paths} validation).
 */
public final class GitHubRootReadmePathSelector {

  private static final Pattern ROOT_README_FILENAME =
      Pattern.compile("(?i)^readme(\\.md|\\.markdown|\\.mdx)?$");

  private GitHubRootReadmePathSelector() {}

  /**
   * Root-only: path must have no {@code /} (single segment relative to repo root).
   *
   * @param knownPaths normalized paths (see {@link GithubTreePathFilter#normalizePath})
   */
  public static Optional<String> selectRootReadmePath(Set<String> knownPaths) {
    if (knownPaths == null || knownPaths.isEmpty()) {
      return Optional.empty();
    }
    List<String> matches = new ArrayList<>();
    for (String p : knownPaths) {
      String n = GithubTreePathFilter.normalizePath(p);
      if (n.isEmpty() || n.contains("/")) {
        continue;
      }
      if (ROOT_README_FILENAME.matcher(n).matches()) {
        matches.add(n);
      }
    }
    if (matches.isEmpty()) {
      return Optional.empty();
    }
    matches.sort(Comparator.comparingInt(GitHubRootReadmePathSelector::priority));
    return Optional.of(matches.get(0));
  }

  /** Lower is better (preferred filename). */
  static int priority(String filename) {
    String f = filename != null ? filename : "";
    if ("README.md".equals(f)) {
      return 0;
    }
    if ("readme.md".equals(f)) {
      return 1;
    }
    if ("Readme.md".equals(f)) {
      return 2;
    }
    String lower = f.toLowerCase(Locale.ROOT);
    if (lower.endsWith(".md")) {
      return 3;
    }
    if (lower.endsWith(".markdown")) {
      return 4;
    }
    if (lower.endsWith(".mdx")) {
      return 5;
    }
    if (lower.equals("readme")) {
      return 6;
    }
    return 7;
  }
}
