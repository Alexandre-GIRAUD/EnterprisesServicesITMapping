package com.enterprise.itmapping.feature.changedetection.application;

import com.enterprise.itmapping.feature.applications.application.GithubRepoIdentityResolver;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationGraphNodeProjection;
import com.enterprise.itmapping.feature.applications.infrastructure.persistence.ApplicationRepository;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Resolves a GitHub {@code owner/repo} to a Neo4j Application id. */
@Component
public class LinkedApplicationResolver {

  private final ApplicationRepository applicationRepository;

  public LinkedApplicationResolver(ApplicationRepository applicationRepository) {
    this.applicationRepository = applicationRepository;
  }

  public Optional<ApplicationGraphNodeProjection> findByRepoFullName(String repoFullName) {
    if (repoFullName == null || repoFullName.isBlank()) {
      return Optional.empty();
    }
    String wanted = repoFullName.trim().toLowerCase(Locale.ROOT);
    for (ApplicationGraphNodeProjection row : applicationRepository.findAllForGraph()) {
      Optional<String> linked =
          GithubRepoIdentityResolver.resolveFullName(row.getName(), row.getDescription(), null);
      if (linked.isPresent() && linked.get().equalsIgnoreCase(wanted)) {
        return Optional.of(row);
      }
      if (row.getName() != null && row.getName().trim().equalsIgnoreCase(wanted)) {
        return Optional.of(row);
      }
    }
    return Optional.empty();
  }
}
