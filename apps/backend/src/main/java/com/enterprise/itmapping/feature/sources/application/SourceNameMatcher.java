package com.enterprise.itmapping.feature.sources.application;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Suggests which source key stands for which application, comparing names without punctuation. */
public final class SourceNameMatcher {

  private SourceNameMatcher() {}

  public static String normalize(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
  }

  /**
   * @param applicationNames application id to name
   * @return application id to source key, only where exactly one key matches
   */
  public static Map<String, String> suggest(
      Map<String, String> applicationNames, List<String> sourceKeys) {
    Map<String, List<String>> keysByNormalized = new HashMap<>();
    for (String key : sourceKeys) {
      keysByNormalized.computeIfAbsent(normalize(key), k -> new ArrayList<>()).add(key);
    }
    Map<String, String> suggestions = new HashMap<>();
    applicationNames.forEach(
        (id, name) -> {
          List<String> matches = keysByNormalized.get(normalize(name));
          if (matches != null && matches.size() == 1) {
            suggestions.put(id, matches.get(0));
          }
        });
    return suggestions;
  }
}
