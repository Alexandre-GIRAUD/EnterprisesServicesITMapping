package com.enterprise.itmapping.feature.integrations.github.presentation;

import com.enterprise.itmapping.feature.integrations.github.application.GitHubAccountService;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubConnectionStatus;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubReposService;
import com.enterprise.itmapping.feature.integrations.github.dto.GitHubRepoDto;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/integrations/github")
public class GitHubIntegrationController {

  private final GitHubReposService gitHubReposService;
  private final GitHubAccountService accounts;

  public GitHubIntegrationController(
      GitHubReposService gitHubReposService,
      GitHubAccountService accounts) {
    this.gitHubReposService = gitHubReposService;
    this.accounts = accounts;
  }

  @GetMapping("/connection")
  public GitHubConnectionStatus connection() {
    return accounts.status();
  }

  @PutMapping("/connection")
  @PreAuthorize("hasRole('ADMIN')")
  public GitHubConnectionStatus saveToken(@RequestBody GitHubTokenRequest body) {
    return accounts.saveToken(body == null ? null : body.token());
  }

  @DeleteMapping("/connection")
  @PreAuthorize("hasRole('ADMIN')")
  public void disconnect() {
    accounts.disconnect();
  }

  /**
   * Proxies GitHub {@code GET /user/repos} using the workspace connection token.
   */
  @GetMapping("/repos")
  public List<GitHubRepoDto> listRepos() {
    return gitHubReposService.listUserRepos();
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> githubError(ResponseStatusException ex) {
    String message = ex.getReason() == null ? "" : ex.getReason();
    return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", message));
  }
}

record GitHubTokenRequest(String token) {}
