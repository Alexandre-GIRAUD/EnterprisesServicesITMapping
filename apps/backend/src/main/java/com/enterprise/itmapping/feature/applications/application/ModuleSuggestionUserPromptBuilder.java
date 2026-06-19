package com.enterprise.itmapping.feature.applications.application;

import java.util.List;
import org.springframework.util.StringUtils;

/**
 * Builds the user message for module suggestion: repository paths plus optional README context at
 * the end. Total size is capped by {@code maxUserPromptChars}.
 */
public final class ModuleSuggestionUserPromptBuilder {

  private static final String PATHS_HEADER =
      "## Repository paths\n\n"
          + "Folder and file layout of the repository (use this to infer module boundaries).\n\n";

  private static final String README_HEADER =
      "## README (context only)\n\n"
          + "Optional documentation. Use it to choose clearer business-facing module names and "
          + "short descriptions.\n\n";

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
