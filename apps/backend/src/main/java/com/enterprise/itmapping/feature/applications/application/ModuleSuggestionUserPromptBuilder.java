package com.enterprise.itmapping.feature.applications.application;

import java.util.List;
import org.springframework.util.StringUtils;

/**
 * Builds the user message for module suggestion: repository paths (evidence source) plus optional
 * README context at the end. Total size is capped by {@code maxUserPromptChars}.
 */
public final class ModuleSuggestionUserPromptBuilder {

  private static final String PATHS_HEADER =
      "## Repository paths (evidence source)\n\n"
          + "These paths are the ONLY acceptable targets for every \"evidence_paths\" entry in your "
          + "JSON (exact path or directory prefix per the system rules). Do not cite paths that "
          + "appear only outside this list.\n\n";

  private static final String README_HEADER =
      "## README (context only)\n\n"
          + "The text below is optional documentation. Use it only to choose clearer "
          + "business-facing module names and short descriptions. It is NOT an evidence source.\n\n"
          + "Every \"evidence_paths\" value must still refer to the \"Repository paths\" section "
          + "above (never to a sentence in the README alone).\n\n";

  private static final int SAFETY = 80;

  private ModuleSuggestionUserPromptBuilder() {}

  public static String build(List<String> paths, String readmePlaintextOrNull, int maxUserPromptChars) {
    int maxTotal = Math.max(0, maxUserPromptChars);
    String readmeBlock = "";
    if (StringUtils.hasText(readmePlaintextOrNull)) {
      readmeBlock = README_HEADER + readmePlaintextOrNull.trim() + "\n\n";
    }
    int maxPathsSection = maxTotal - readmeBlock.length();
    if (maxPathsSection < PATHS_HEADER.length() + 200) {
      readmeBlock = "";
      maxPathsSection = maxTotal;
    }

    StringBuilder sb = new StringBuilder();
    sb.append(PATHS_HEADER);
    boolean truncated = false;
    for (String p : paths) {
      if (p == null) {
        continue;
      }
      String line = p + '\n';
      if (sb.length() + line.length() + SAFETY > maxPathsSection) {
        truncated = true;
        break;
      }
      sb.append(line);
    }
    if (truncated) {
      sb.append("\n... (paths truncated for prompt size limit)\n");
    }
    sb.append(readmeBlock);
    return sb.toString();
  }
}
