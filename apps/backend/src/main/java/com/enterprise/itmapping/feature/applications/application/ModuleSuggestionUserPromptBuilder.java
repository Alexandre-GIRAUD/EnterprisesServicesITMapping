package com.enterprise.itmapping.feature.applications.application;

import java.util.List;
import java.util.Map;
import org.springframework.util.StringUtils;

/**
 * Builds the user message for module suggestion: repository paths, optional README context, and
 * (optionally) the content of files the LLM asked to read. Total size is capped by {@code
 * maxUserPromptChars}; file contents are placed last so they are the first to be truncated.
 */
public final class ModuleSuggestionUserPromptBuilder {

  private static final String PATHS_HEADER =
      "## Repository paths\n\n"
          + "Folder and file layout of the repository (use this to infer module boundaries).\n\n";

  private static final String README_HEADER =
      "## README (context only)\n\n"
          + "Optional documentation. Use it to choose clearer business-facing module names and "
          + "short descriptions.\n\n";

  private static final String FILE_CONTENTS_HEADER =
      "## File contents\n\n"
          + "Selected source files (possibly truncated). Use them to refine module boundaries, "
          + "names and descriptions.\n\n";

  private static final int SAFETY = 80;

  private ModuleSuggestionUserPromptBuilder() {}

  public static String build(List<String> paths, String readmePlaintextOrNull, int maxUserPromptChars) {
    return build(paths, readmePlaintextOrNull, Map.of(), maxUserPromptChars);
  }

  /**
   * @param fileContents ordered map {@code path -> content}; appended last and truncated first
   */
  public static String build(
      List<String> paths,
      String readmePlaintextOrNull,
      Map<String, String> fileContents,
      int maxUserPromptChars) {
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
    appendFileContents(sb, fileContents, maxTotal);
    return sb.toString();
  }

  private static void appendFileContents(
      StringBuilder sb, Map<String, String> fileContents, int maxTotal) {
    if (fileContents == null || fileContents.isEmpty()) {
      return;
    }
    if (sb.length() + FILE_CONTENTS_HEADER.length() + SAFETY > maxTotal) {
      return;
    }
    sb.append(FILE_CONTENTS_HEADER);
    boolean truncated = false;
    for (Map.Entry<String, String> e : fileContents.entrySet()) {
      String path = e.getKey();
      String content = e.getValue() != null ? e.getValue() : "";
      String entry = "=== " + path + " ===\n" + content + "\n\n";
      if (sb.length() + entry.length() + SAFETY > maxTotal) {
        truncated = true;
        break;
      }
      sb.append(entry);
    }
    if (truncated) {
      sb.append("... (file contents truncated for prompt size limit)\n");
    }
  }
}
