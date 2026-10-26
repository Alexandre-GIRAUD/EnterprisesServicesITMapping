package com.enterprise.itmapping.feature.applications.presentation.dto;

/** Optional body for {@code POST /applications/{id}/modules/suggest-from-github}. */
public record SuggestModulesFromGithubRequest(
    /** Overrides owner/repo when the application {@code name} is not {@code login/repo}. */
    String fullName,
    /** When true, existing modules are removed and the scan runs again. */
    Boolean replaceExisting
) {
  public SuggestModulesFromGithubRequest(String fullName) {
    this(fullName, null);
  }
}
