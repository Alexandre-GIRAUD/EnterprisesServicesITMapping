package com.enterprise.itmapping.feature.applications.application;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Verbatim quotes checked against a stored detection document. */
public final class DocumentExcerpt {

  public static final int MAX_CHARACTERS = 80_000;

  private static final Pattern WHITESPACE = Pattern.compile("\\s+");

  private DocumentExcerpt() {}

  public static boolean contains(String body, String excerpt) {
    String needle = compact(excerpt);
    return !needle.isEmpty() && compact(body).contains(needle);
  }

  public static List<String> matching(String body, List<String> excerpts) {
    if (excerpts == null || excerpts.isEmpty()) {
      return List.of();
    }
    List<String> kept = new ArrayList<>();
    for (String raw : excerpts) {
      if (raw == null) {
        continue;
      }
      String quote = raw.trim();
      if (quote.isEmpty() || kept.contains(quote) || !contains(body, quote)) {
        continue;
      }
      kept.add(quote);
      if (kept.size() == AiDecisionSourceService.MAX_SOURCE_FILES) {
        break;
      }
    }
    return List.copyOf(kept);
  }

  private static String compact(String value) {
    if (value == null) {
      return "";
    }
    return WHITESPACE.matcher(value.trim()).replaceAll(" ");
  }
}
