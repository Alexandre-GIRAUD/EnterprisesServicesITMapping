package com.enterprise.itmapping.feature.integrations.github;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Filters Git repository tree paths before sending them to an LLM. Pure functions for unit testing.
 *
 * <p>Strategy: exclude known noise directories, common binaries by extension, and paths whose depth
 * exceeds {@link #DEFAULT_MAX_DEPTH}. Caps output to {@code maxPaths}.
 */
public final class GithubTreePathFilter {

  public static final int DEFAULT_MAX_DEPTH = 14;

  private static final Pattern BINARY_EXTENSIONS =
      Pattern.compile(
          "\\.(?:png|jpg|jpeg|gif|webp|ico|pdf|zip|tar|gz|7z|rar|exe|dll|so|dylib|bin|wasm|woff2?|ttf|eot|svg|mp4|mp3|mov|dmg|pkg|class|jar|pak|lock)$",
          Pattern.CASE_INSENSITIVE);

  private static final Set<String> DIRECTORY_EXACT =
      Set.of(
          ".git",
          "node_modules",
          "dist",
          "target",
          "build",
          "out",
          ".gradle",
          ".idea",
          ".vscode",
          "coverage",
          "__pycache__",
          ".pytest_cache");

  private GithubTreePathFilter() {}

  /**
   * @param normalizedPath POSIX-style path relative to repo root, no leading slash
   */
  public static boolean shouldExcludePath(String normalizedPath, int maxDepth) {
    if (normalizedPath == null || normalizedPath.isEmpty()) return true;
    String p = normalizedPath.trim();
    if (p.startsWith("/")) {
      p = p.substring(1);
    }

    String[] parts = p.split("/");
    if (parts.length > maxDepth) {
      return true;
    }

    for (String part : parts) {
      if (part.isEmpty()) continue;
      if (part.startsWith(".") && !part.equals(".github")) {
        return true;
      }
      String lower = part.toLowerCase(Locale.ROOT);
      if (DIRECTORY_EXACT.contains(lower)) {
        return true;
      }
    }

    if (BINARY_EXTENSIONS.matcher(p).find()) {
      return true;
    }
    return false;
  }

  /**
   * @param paths stream of POSIX paths
   * @param maxPaths cap after filtering (stable order preserved from input)
   */
  public static java.util.List<String> filterAndCap(
      java.util.List<String> paths, int maxDepth, int maxPaths) {
    return paths.stream()
        .map(GithubTreePathFilter::normalizePath)
        .filter(p -> !shouldExcludePath(p, maxDepth))
        .distinct()
        .limit(Math.max(0, maxPaths))
        .toList();
  }

  public static String normalizePath(String path) {
    if (path == null) return "";
    String p = path.trim().replace('\\', '/');
    while (p.startsWith("/")) {
      p = p.substring(1);
    }
    return p;
  }

  /** Prefer top-level meaning: {@code apps/}, {@code packages/}, {@code src/} if present. */
  public static java.util.List<String> prioritizeMonorepoRoots(java.util.List<String> paths) {
    java.util.Set<String> roots =
        Set.of("apps/", "packages/", "src/", "lib/", "services/", "modules/");
    java.util.List<String> priority = new java.util.ArrayList<>();
    java.util.List<String> rest = new java.util.ArrayList<>();
    for (String p : paths) {
      String n = normalizePath(p);
      boolean hit = roots.stream().anyMatch(r -> n.equals(r) || n.startsWith(r));
      if (hit) {
        priority.add(n);
      } else {
        rest.add(n);
      }
    }
    return Stream.concat(priority.stream(), rest.stream()).distinct().toList();
  }
}
