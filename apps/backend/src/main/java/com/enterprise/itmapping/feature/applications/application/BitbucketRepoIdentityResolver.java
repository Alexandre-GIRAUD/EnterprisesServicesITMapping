package com.enterprise.itmapping.feature.applications.application;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** {@code workspace/repo} taken from a Bitbucket Cloud URL stored on an application. */
public final class BitbucketRepoIdentityResolver {

  private static final Pattern BITBUCKET_URL =
      Pattern.compile(
          "bitbucket\\.org[/:]([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\\.git)?(?:[/?#\\s]|$)",
          Pattern.CASE_INSENSITIVE);

  private BitbucketRepoIdentityResolver() {}

  public static List<String> resolveAllFullNames(String applicationName, String description) {
    LinkedHashSet<String> names = new LinkedHashSet<>();
    if (description == null || description.isBlank()) {
      return List.of();
    }
    Matcher matcher = BITBUCKET_URL.matcher(description);
    while (matcher.find()) {
      names.add(matcher.group(1) + "/" + matcher.group(2));
    }
    return List.copyOf(names);
  }
}
