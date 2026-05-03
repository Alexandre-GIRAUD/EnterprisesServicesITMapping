package com.enterprise.itmapping.feature.applications.application;

import com.enterprise.itmapping.feature.integrations.github.GithubTreePathFilter;
import java.util.List;
import java.util.Set;

/**
 * Ensures IA "evidence_paths" tie back to observed repository paths (no hallucinated paths).
 */
public final class ModuleSuggestionEvidenceValidator {

  private ModuleSuggestionEvidenceValidator() {}

  /** True when every evidence path is supported by at least one known tree path. */
  public static boolean allEvidenceMatches(List<String> evidencePaths, Set<String> knownPaths) {
    if (evidencePaths == null || evidencePaths.isEmpty()) {
      return false;
    }
    for (String raw : evidencePaths) {
      if (!evidenceMatchesOne(raw, knownPaths)) {
        return false;
      }
    }
    return true;
  }

  public static boolean evidenceMatchesOne(String evidenceRaw, Set<String> knownPaths) {
    String e = GithubTreePathFilter.normalizePath(evidenceRaw);
    if (e.isEmpty()) {
      return false;
    }
    if (knownPaths.contains(e)) {
      return true;
    }
    String dirPrefix = e.endsWith("/") ? e : e + "/";
    for (String p : knownPaths) {
      String pn = GithubTreePathFilter.normalizePath(p);
      if (pn.startsWith(dirPrefix)) {
        return true;
      }
    }
    return false;
  }
}
