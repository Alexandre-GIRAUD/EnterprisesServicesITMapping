package com.enterprise.itmapping.feature.applications.application;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.util.StringUtils;

/**
 * Derives {@code owner/repo} for GitHub-backed {@link com.enterprise.itmapping.domain.Application}
 * rows created by import (name = full name) or description {@code GitHub: https://...}.
 * ModuleSuggestionService appelle ce resolver avant d’appeler l’API GitHub (owner + repo pour récupérer l’arbre du dépôt). 
 * Sans owner/repo, le flux « suggestion de modules depuis GitHub » ne saurait pas quel dépôt interroger, 
 * tout en restant sans exposer de token au client
 */
public final class GithubRepoIdentityResolver {

  private static final Pattern GITHUB_URL =
      Pattern.compile(
          "github\\.com[/:]([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\\.git)?(?:[/?#]|$)",
          Pattern.CASE_INSENSITIVE);

  private GithubRepoIdentityResolver() {}

  public static Optional<String> resolveFullName(
      String applicationName, String description, String requestOverride) {
    if (StringUtils.hasText(requestOverride)) {
      return Optional.of(normalizeFullName(requestOverride.trim()));
    }
    if (StringUtils.hasText(applicationName) && applicationName.contains("/")) {
      return Optional.of(normalizeFullName(applicationName.trim()));
    }
    if (!StringUtils.hasText(description)) {
      return Optional.empty();
    }
    String d = description.trim();
    if (d.regionMatches(true, 0, "GitHub:", 0, "GitHub:".length())) {
      String url = d.substring("GitHub:".length()).trim();
      return parseGitHubUrl(url);
    }
    return Optional.empty();
  }

  private static Optional<String> parseGitHubUrl(String url) {
    if (!StringUtils.hasText(url)) {
      return Optional.empty();
    }
    Matcher m = GITHUB_URL.matcher(url);
    if (m.find()) {
      return Optional.of(normalizeFullName(m.group(1) + "/" + m.group(2)));
    }
    return Optional.empty();
  }

  private static String normalizeFullName(String full) {
    String f = full.replace('\\', '/').trim();
    while (f.startsWith("/")) {
      f = f.substring(1);
    }
    return f;
  }
}
