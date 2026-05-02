package com.enterprise.itmapping.feature.integrations.github.presentation;

import com.enterprise.itmapping.feature.integrations.github.application.GitHubReposService;
import com.enterprise.itmapping.feature.integrations.github.dto.GitHubRepoDto;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/integrations/github")
public class GitHubIntegrationController {

  private final GitHubReposService gitHubReposService;

  public GitHubIntegrationController(GitHubReposService gitHubReposService) {
    this.gitHubReposService = gitHubReposService;
  }

  /**
   * Proxies GitHub {@code GET /user/repos} using the server-configured token.
   */
  @GetMapping("/repos")
  public List<GitHubRepoDto> listRepos() {
    return gitHubReposService.listUserRepos();
  }
}
