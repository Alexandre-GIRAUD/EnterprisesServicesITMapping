package com.enterprise.itmapping.feature.applications.application;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.util.StringUtils;

/**
 * Derives {@code owner/repo} for GitHub-backed {@link com.enterprise.itmapping.domain.Application}
 * rows created by import (description contains {@code github.com/owner/repo}, or a legacy name).
 * ModuleSuggestionService appelle ce resolver avant d’appeler l’API GitHub (owner + repo pour récupérer l’arbre du dépôt). 
 * Sans owner/repo, le flux « suggestion de modules depuis GitHub » ne saurait pas quel dépôt interroger, 
 * tout en restant sans exposer de token au client
 */
public final class GithubRepoIdentityResolver {

  private static final Pattern GITHUB_URL =
      Pattern.compile(
          "github\\.com[/:]([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\\.git)?(?:[/?#\\s]|$)",
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
    return parseGitHubUrl(description);
  }

  /** Every {@code owner/repo} stored on the application, in description order. */
  public static List<String> resolveAllFullNames(String applicationName, String description) {
    LinkedHashSet<String> names = new LinkedHashSet<>();
    if (StringUtils.hasText(applicationName) && applicationName.contains("/")) {
      names.add(normalizeFullName(applicationName.trim()));
    }
    if (StringUtils.hasText(description)) {
      Matcher matcher = GITHUB_URL.matcher(description);
      while (matcher.find()) {
        names.add(normalizeFullName(matcher.group(1) + "/" + matcher.group(2)));
      }
    }
    return List.copyOf(names);
  }

  /** True when {@code peerName} is this application or one of its repositories. */
  public static boolean namesOwnRepository(String peerName, List<String> fullNames) {
    if (!StringUtils.hasText(peerName) || fullNames == null) {
      return false;
    }
    String peer = peerName.trim();
    for (String fullName : fullNames) {
      if (fullName.equalsIgnoreCase(peer)) {
        return true;
      }
      int slash = fullName.lastIndexOf('/');
      String repo = slash >= 0 ? fullName.substring(slash + 1) : fullName;
      if (repo.equalsIgnoreCase(peer)) {
        return true;
      }
    }
    return false;
  }

  /** First {@code owner/repo} present in both lists, ignoring case. */
  public static String firstOverlap(List<String> incoming, List<String> existing) {
    if (incoming == null || existing == null) {
      return null;
    }
    for (String name : incoming) {
      for (String other : existing) {
        if (name.equalsIgnoreCase(other)) {
          return name;
        }
      }
    }
    return null;
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
